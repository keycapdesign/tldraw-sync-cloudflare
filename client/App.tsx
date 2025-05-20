import { useSync } from '@tldraw/sync'
import { Tldraw } from 'tldraw'
import { createBookmarkPreviewHandler } from './getBookmarkPreview'
import { createMultiplayerAssetStore } from './multiplayerAssetStore'
import { ClerkProvider } from './ClerkProvider'
import { useAuth } from '@clerk/clerk-react'
import { useState, useEffect } from 'react'

// Where is our worker located? Configure this in `vite.config.ts`
const WORKER_URL = import.meta.env.VITE_TLDRAW_WORKER_URL

// In this example, the room ID is hard-coded. You can set this however you like though.
const roomId = 'test-room'

function TldrawApp() {
	// We'll use the user information in a future implementation
	// const { user } = useUser();
	const { getToken } = useAuth();
	const [isConnecting, setIsConnecting] = useState(true);

	// Create the authenticated asset store
	const assetStore = createMultiplayerAssetStore();

	// Create the authenticated bookmark preview handler
	const bookmarkPreviewHandler = createBookmarkPreviewHandler();

	// State to store the authentication token
	const [authToken, setAuthToken] = useState<string | null>(null);

	// Get the authentication token
	useEffect(() => {
		const getAuthenticationToken = async () => {
			try {
				console.log('Getting authentication token...');
				const token = await getToken();
				if (token) {
					console.log('Authentication token obtained');
					setAuthToken(token);
				} else {
					console.warn('No authentication token obtained');
				}
			} catch (error) {
				console.error('Error getting auth token:', error);
			} finally {
				// Set a short delay before setting isConnecting to false
				// to ensure the token is properly set before attempting to connect
				setTimeout(() => {
					setIsConnecting(false);
				}, 500);
			}
		};

		getAuthenticationToken();
	}, [getToken]);

	// Create a custom URI with the auth token as a query parameter
	const wsUri = authToken
		? `${WORKER_URL}/connect/${roomId}?auth=${encodeURIComponent(authToken)}`
		: `${WORKER_URL}/connect/${roomId}`;

	// Create store connected to multiplayer with authentication
	const store = useSync({
		// We need to know the websockets URI...
		uri: wsUri,
		// ...and how to handle static assets like images & videos
		assets: assetStore,
	})

	// Add a separate effect to handle WebSocket connection
	useEffect(() => {
		if (!store || isConnecting) return;

		// Get the WebSocket instance from the store
		const socket = (store as any).socket;

		if (socket) {
			console.log('WebSocket connected');

			// Send authentication token if available
			if (authToken) {
				console.log('Sending auth token');
				socket.send(JSON.stringify({ type: 'auth', token: authToken }));
			}

			// Add event listeners for debugging
			socket.addEventListener('error', (event: Event) => {
				console.error('WebSocket error:', event);
			});

			socket.addEventListener('close', (event: CloseEvent) => {
				console.log('WebSocket closed', { code: event.code, reason: event.reason });
			});

			socket.addEventListener('open', () => {
				console.log('WebSocket opened');
			});
		}

		return () => {
			// Clean up event listeners when the component unmounts
			if (socket) {
				socket.removeEventListener('error', () => {});
				socket.removeEventListener('close', () => {});
				socket.removeEventListener('open', () => {});
			}
		};
	}, [store, authToken, isConnecting]);

	// Show loading state while connecting
	if (isConnecting) {
		return (
			<div style={{
				position: 'fixed',
				inset: 0,
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				backgroundColor: '#f5f5f5'
			}}>
				<div>Connecting to whiteboard...</div>
			</div>
		)
	}

	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw
				// we can pass the connected store into the Tldraw component which will handle
				// loading states & enable multiplayer UX like cursors & a presence menu
				store={store}
				onMount={(editor) => {
					// when the editor is ready, we need to register our bookmark unfurling service
					editor.registerExternalAssetHandler('url', bookmarkPreviewHandler)
				}}
			/>
		</div>
	)
}

function App() {
	return (
		<ClerkProvider>
			<TldrawApp />
		</ClerkProvider>
	)
}

export default App
