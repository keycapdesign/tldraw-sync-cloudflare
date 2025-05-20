import { handleUnfurlRequest } from 'cloudflare-workers-unfurl'
import { AutoRouter, cors, error, IRequest } from 'itty-router'
import { handleAssetDownload, handleAssetUpload } from './assetUploads'
import { requireAuth } from './authMiddleware'
import { Environment } from './types'

// make sure our sync durable object is made available to cloudflare
export { TldrawDurableObject } from './TldrawDurableObject'

// we use itty-router (https://itty.dev/) to handle routing. in this example we turn on CORS because
// we're hosting the worker separately to the client. you should restrict this to your own domain.
const { preflight, corsify } = cors({ origin: '*' })
const router = AutoRouter<IRequest, [env: Environment, ctx: ExecutionContext]>({
	before: [preflight],
	finally: [corsify],
	catch: (e) => {
		console.error(e)
		return error(e)
	},
})
	// Public endpoint to check if auth is required
	.get('/auth-status', (_, env) => {
		return new Response(JSON.stringify({
			authRequired: !!env.CLERK_SECRET_KEY,
		}), {
			headers: { 'Content-Type': 'application/json' }
		})
	})

	// requests to /connect are routed to the Durable Object, and handle realtime websocket syncing
	.get('/connect/:roomId', async (request, env) => {
		// Check if auth token is provided in the query parameter
		const url = new URL(request.url);
		const authToken = url.searchParams.get('auth');

		// Create a new headers object with the auth token if provided
		const headers = new Headers(request.headers);
		if (authToken) {
			headers.set('Authorization', `Bearer ${authToken}`);
		}

		// Create a new request with the updated headers
		const authenticatedRequest = new Request(request.url, {
			method: request.method,
			headers: headers,
			body: request.body,
		});

		// Add the params from the original request
		(authenticatedRequest as any).params = request.params;

		// Check authentication before allowing connection
		const authResult = await requireAuth(authenticatedRequest, env)
		if (authResult instanceof Response) {
			return authResult
		}

		const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId)
		const room = env.TLDRAW_DURABLE_OBJECT.get(id)

		// Pass the user ID to the Durable Object if available
		if (authenticatedRequest.userId) {
			headers.set('X-User-ID', authenticatedRequest.userId)
		}

		return room.fetch(request.url, { headers, body: request.body })
	})

	// assets can be uploaded to the bucket under /uploads:
	.post('/uploads/:uploadId', async (request, env) => {
		// Create a new headers object from the request
		const headers = new Headers(request.headers);

		// Create a new request with the headers
		const authenticatedRequest = new Request(request.url, {
			method: request.method,
			headers: headers,
			body: request.body,
		});

		// Add the params from the original request
		(authenticatedRequest as any).params = request.params;

		// Check authentication before allowing upload
		const authResult = await requireAuth(authenticatedRequest, env)
		if (authResult instanceof Response) {
			return authResult
		}

		return handleAssetUpload(request, env)
	})

	// they can be retrieved from the bucket too (public access):
	.get('/uploads/:uploadId', handleAssetDownload)

	// bookmarks need to extract metadata from pasted URLs:
	.get('/unfurl', handleUnfurlRequest)

// export our router for cloudflare
export default router
