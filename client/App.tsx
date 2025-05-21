import { useSync } from "@tldraw/sync";
import { Tldraw } from "tldraw";
import { createBookmarkPreviewHandler } from "./getBookmarkPreview";
import { multiplayerAssetStore, setAuthToken as setGlobalAuthToken } from "./multiplayerAssetStore";
import { useEffect, useState } from "react";

import {
  ClerkProvider,
  useAuth,
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";

const WORKER_URL = import.meta.env.VITE_TLDRAW_WORKER_URL;
const VITE_CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!VITE_CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY from .env");
}

const roomId = "test-room";

function TldrawWithClerkAuth() {
  const { getToken } = useAuth(); // Call useAuth at the top level
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the auth token when the component mounts
  useEffect(() => {
    async function fetchToken() {
      try {
        const token = await getToken();

        // Update the state
        setAuthToken(token);

        // Also update the global token for asset store
        // This makes the token available for asset uploads and retrievals
        setGlobalAuthToken(token);
      } catch (error) {
        console.error("Error fetching auth token:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchToken();
  }, [getToken]);

  // Create the WebSocket URI with the auth token
  const wsUri = authToken
    ? `${WORKER_URL}/connect/${roomId}?auth=${authToken}`
    : null;

  // Create the store only when we have the auth token
  const store = wsUri
    ? useSync({
        uri: wsUri,
        assets: multiplayerAssetStore,
      })
    : null;

  // Create the handler by passing getToken to the factory function
  const bookmarkPreviewHandler = createBookmarkPreviewHandler(getToken);

  // Show loading state while fetching the token
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "1.5rem",
        }}
      >
        Loading...
      </div>
    );
  }

  // If we don't have a store yet, show an error
  if (!store) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "1.5rem",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <p>Failed to connect to the server. Please try again.</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        store={store}
        onMount={(editor) => {
          // Pass the already created handler instance
          editor.registerExternalAssetHandler("url", bookmarkPreviewHandler);
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 1000,
          backgroundColor: "white",
          padding: "5px",
          borderRadius: "5px",
          boxShadow: "0 0 5px rgba(0,0,0,0.2)",
        }}
      >
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal" />
        </SignedOut>
      </div>
    </div>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={VITE_CLERK_PUBLISHABLE_KEY}>
      <TldrawWithClerkAuth />
    </ClerkProvider>
  );
}

export default App;
