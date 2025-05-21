import { RoomSnapshot, TLSocketRoom } from '@tldraw/sync-core'
import {
	TLRecord,
	createTLSchema,
	// defaultBindingSchemas,
	defaultShapeSchemas,
} from '@tldraw/tlschema'
import { AutoRouter, IRequest, error } from 'itty-router'
import throttle from 'lodash.throttle'
import { Environment } from './types'

// add custom shapes and bindings here if needed:
const schema = createTLSchema({
	shapes: { ...defaultShapeSchemas },
	// bindings: { ...defaultBindingSchemas },
})

// each whiteboard room is hosted in a DurableObject:
// https://developers.cloudflare.com/durable-objects/

// there's only ever one durable object instance per room. it keeps all the room state in memory and
// handles websocket connections. periodically, it persists the room state to the R2 bucket.
export class TldrawDurableObject {
	private r2: R2Bucket
	// the room ID will be missing while the room is being initialized
	private roomId: string | null = null
	// when we load the room from the R2 bucket, we keep it here. it's a promise so we only ever
	// load it once.
	private roomPromise: Promise<TLSocketRoom<TLRecord, void>> | null = null

	constructor(
		private readonly ctx: DurableObjectState,
		env: Environment
	) {
		this.r2 = env.TLDRAW_BUCKET

		ctx.blockConcurrencyWhile(async () => {
			this.roomId = ((await this.ctx.storage.get('roomId')) ?? null) as string | null
		})
	}

	private readonly router = AutoRouter({
		catch: (e) => {
			console.log(e)
			return error(e)
		},
	})
		// when we get a connection request, we stash the room id if needed and handle the connection
		.get('/connect/:roomId', async (request) => {
			if (!this.roomId) {
				await this.ctx.blockConcurrencyWhile(async () => {
					await this.ctx.storage.put('roomId', request.params.roomId)
					this.roomId = request.params.roomId
				})
			}
			return this.handleConnect(request)
		})

	// `fetch` is the entry point for all requests to the Durable Object
	fetch(request: Request): Response | Promise<Response> {
		return this.router.fetch(request)
	}

	// what happens when someone tries to connect to this room?
	async handleConnect(request: any): Promise<Response> {
		// extract query params from request
		const sessionId = (request as any).query.sessionId as string;
		if (!sessionId) return error(400, 'Missing sessionId')

		// Get user ID from the headers if available
		const userId = (request as any).headers.get('X-User-ID');

		// Get auth token from query params if available
		const url = new URL((request as any).url);
		const authToken = url.searchParams.get('auth');

		console.log('WebSocket connection request', {
			sessionId,
			hasUserId: !!userId,
			hasAuthToken: !!authToken,
			headers: JSON.stringify(Object.fromEntries([...(request as any).headers.entries()]))
		});

		// Create the websocket pair for the client
		const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair()
		serverWebSocket.accept()

		// load the room, or retrieve it if it's already loaded
		const room = await this.getRoom()

		// Set up message handler for authentication
		let authenticated = !!userId;

		console.log('WebSocket connection established', {
			sessionId,
			authenticated,
			hasUserId: !!userId
		});

		// Handle messages from the client
		serverWebSocket.addEventListener('message', async (event) => {
			try {
				const data = JSON.parse(event.data as string);
				console.log('WebSocket message received', { type: data.type });

				// Handle authentication message
				if (data.type === 'auth' && data.token) {
					console.log('Auth message received');
					const tokenParts = data.token.split('.');
					if (tokenParts.length === 3) {
						try {
							const payload = JSON.parse(atob(tokenParts[1]));
							if (payload.sub) {
								authenticated = true;
								console.log('Authentication successful', { userId: payload.sub });
								serverWebSocket.send(JSON.stringify({ type: 'auth-ok', userId: payload.sub }));
							}
						} catch (e) {
							console.error('Error parsing token:', e);
						}
					}
				}
			} catch (e) {
				console.error('Error handling WebSocket message:', e);
			}
		});

		// Add error and close event listeners for debugging
		serverWebSocket.addEventListener('error', (error) => {
			console.error('WebSocket error:', error);
		});

		serverWebSocket.addEventListener('close', (event) => {
			console.log('WebSocket closed', { code: event.code, reason: event.reason });
		});

		// connect the client to the room
		room.handleSocketConnect({
			sessionId,
			socket: serverWebSocket
		})

		console.log('Client connected to room', { roomId: this.roomId, sessionId });

		// return the websocket connection to the client
		return new Response(null, { status: 101, webSocket: clientWebSocket })
	}

	getRoom() {
		const roomId = this.roomId
		if (!roomId) throw new Error('Missing roomId')

		if (!this.roomPromise) {
			this.roomPromise = (async () => {
				// fetch the room from R2
				const roomFromBucket = await this.r2.get(`rooms/${roomId}`)

				// if it doesn't exist, we'll just create a new empty room
				const initialSnapshot = roomFromBucket
					? ((await roomFromBucket.json()) as RoomSnapshot)
					: undefined

				// create a new TLSocketRoom. This handles all the sync protocol & websocket connections.
				// it's up to us to persist the room state to R2 when needed though.
				return new TLSocketRoom<TLRecord, void>({
					schema,
					initialSnapshot,
					onDataChange: () => {
						// and persist whenever the data in the room changes
						this.schedulePersistToR2()
					},
				})
			})()
		}

		return this.roomPromise
	}

	// we throttle persistance so it only happens every 10 seconds
	schedulePersistToR2 = throttle(async () => {
		if (!this.roomPromise || !this.roomId) return
		const room = await this.getRoom()

		// convert the room to JSON and upload it to R2
		const snapshot = JSON.stringify(room.getCurrentSnapshot())
		await this.r2.put(`rooms/${this.roomId}`, snapshot)
	}, 10_000)
}
