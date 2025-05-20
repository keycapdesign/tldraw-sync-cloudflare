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

	// Create store connected to multiplayer with authentication
	const store = useSync({
		// We need to know the websockets URI...
		uri: `${WORKER_URL}/connect/${roomId}`,
		// ...and how to handle static assets like images & videos
		assets: assetStore,
	})

	// Handle authentication after the store is created
	useEffect(() => {
		// Function to authenticate the connection
		const authenticateConnection = async () => {
			try {
				// Get the auth token
				const token = await getToken();
				if (token) {
					// In a real implementation, you would send the token with the WebSocket connection
					// or include it in API requests
					console.log('Authentication token obtained');
				}
			} catch (error) {
				console.error('Error getting auth token:', error);
			} finally {
				setIsConnecting(false);
			}
		};

		// Call the authentication function
		authenticateConnection();
	}, [getToken]);

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
