import { useSync } from "@tldraw/sync";
import { TLUserPreferences, Tldraw, useTldrawUser } from "tldraw";
import { createBookmarkPreviewHandler } from "./getBookmarkPreview";
import { multiplayerAssetStore, setAuthToken as setGlobalAuthToken } from "./multiplayerAssetStore";
import { useEffect, useMemo, useState } from "react";

// Array of fun animal names for random user names (used with tldraw's built-in user settings)
const animalNames = [
  "Alligator", "Anteater", "Armadillo", "Badger", "Bat", "Beaver", "Buffalo", "Camel", "Capybara",
  "Chameleon", "Cheetah", "Chipmunk", "Coyote", "Crow", "Dolphin", "Duck", "Elephant", "Ferret",
  "Fox", "Frog", "Giraffe", "Gopher", "Hedgehog", "Hippo", "Kangaroo", "Koala", "Lemur", "Leopard",
  "Llama", "Manatee", "Monkey", "Moose", "Narwhal", "Otter", "Panda", "Penguin", "Platypus",
  "Rabbit", "Raccoon", "Rhino", "Sheep", "Squirrel", "Tiger", "Turtle", "Walrus", "Wolf", "Wombat"
];

// We're using tldraw's built-in user settings UI

import {
  ClerkProvider,
  useAuth,
  useUser,
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
  const { getToken } = useAuth();
  const { user } = useUser();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Generate a random name for the user
  const randomName = useMemo(() => {
    const adjectives = ["Happy", "Sleepy", "Grumpy", "Sneezy", "Dopey", "Bashful", "Doc"];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomAnimal = animalNames[Math.floor(Math.random() * animalNames.length)];
    return `${randomAdjective} ${randomAnimal}`;
  }, []);

  // Create user preferences from Clerk user data or random values
  // We're using a default color that's visible against white background
  const [userPreferences, setUserPreferences] = useState<TLUserPreferences>({
    id: user?.id || `anonymous-${Math.random().toString(36).substring(2, 9)}`,
    name: user?.fullName || user?.username || randomName,
    color: "blue", // Default color
    colorScheme: 'light', // Default color scheme
  });

  // Update user preferences when Clerk user changes
  useEffect(() => {
    if (user) {
      setUserPreferences(prev => ({
        id: user.id,
        name: user.fullName || user.username || randomName,
        color: prev.color, // Keep the same color
        colorScheme: prev.colorScheme,
      }));
    }
  }, [user, randomName]);

  // Create the tldraw user object
  const tldrawUser = useTldrawUser({
    userPreferences,
    setUserPreferences,
  });

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
    : '';  // Empty string when no token

  // Create the sync store with user info
  // Always call useSync at the top level, even if wsUri is empty
  const store = useSync({
    uri: wsUri || '',
    assets: multiplayerAssetStore,
    userInfo: userPreferences,
  });

  // Create the handler by passing getToken to the factory function
  const bookmarkPreviewHandler = createBookmarkPreviewHandler(getToken);

  // Prepare UI states
  const loadingUI = (
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

  const authRequiredUI = (
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
      <p>Authentication required. Please sign in to continue.</p>
      <SignInButton mode="modal" />
    </div>
  );

  // Determine which UI to show
  // const showLoadingUI = isLoading;
  // const showAuthRequiredUI = !isLoading && !authToken;

  // No need for user settings modal state since tldraw has built-in UI for this

  // Main app content
  const mainContent = (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        store={store}
        user={tldrawUser}
        onMount={(editor) => {
          // Pass the already created handler instance
          editor.registerExternalAssetHandler("url", bookmarkPreviewHandler);
        }}
      />

      {/* Clerk UI - moved to bottom right */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          zIndex: 1000,
          backgroundColor: "white",
          padding: "8px",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
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

  // Return the appropriate UI based on state
  return (
    <>
      {isLoading ? loadingUI : null}
      {!isLoading && !authToken ? authRequiredUI : null}
      {!isLoading && authToken ? mainContent : null}
    </>
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
