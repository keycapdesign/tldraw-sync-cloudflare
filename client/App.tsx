import { useSync } from "@tldraw/sync";
import { TLUserPreferences, Tldraw, useTldrawUser } from "tldraw";
import { createBookmarkPreviewHandler } from "./getBookmarkPreview";
import { multiplayerAssetStore, setAuthToken as setGlobalAuthToken } from "./multiplayerAssetStore";
import { useEffect, useMemo, useState } from "react";

// Array of fun animal names for random user names
const animalNames = [
  "Alligator", "Anteater", "Armadillo", "Auroch", "Axolotl", "Badger", "Bat", "Beaver", "Buffalo",
  "Camel", "Capybara", "Chameleon", "Cheetah", "Chinchilla", "Chipmunk", "Chupacabra", "Cormorant",
  "Coyote", "Crow", "Dingo", "Dinosaur", "Dolphin", "Duck", "Elephant", "Ferret", "Fox", "Frog",
  "Giraffe", "Gopher", "Grizzly", "Hedgehog", "Hippo", "Hyena", "Ibex", "Ifrit", "Iguana", "Jackal",
  "Kangaroo", "Koala", "Kraken", "Lemur", "Leopard", "Liger", "Llama", "Manatee", "Mink", "Monkey",
  "Moose", "Narwhal", "Nyan Cat", "Orangutan", "Otter", "Panda", "Penguin", "Platypus", "Pumpkin",
  "Python", "Quagga", "Rabbit", "Raccoon", "Rhino", "Sheep", "Shrew", "Skunk", "Squirrel", "Tiger",
  "Turtle", "Walrus", "Wolf", "Wolverine", "Wombat"
];

// Array of colors for random user colors
const userColors = [
  "red", "orange", "yellow", "green", "blue", "purple", "pink", "teal", "indigo", "violet",
  "cyan", "magenta", "lime", "amber", "emerald", "rose", "sky", "fuchsia"
];

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

  // Generate a random name and color for the user
  const randomName = useMemo(() => {
    const adjectives = ["Happy", "Sleepy", "Grumpy", "Sneezy", "Dopey", "Bashful", "Doc"];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomAnimal = animalNames[Math.floor(Math.random() * animalNames.length)];
    return `${randomAdjective} ${randomAnimal}`;
  }, []);

  const randomColor = useMemo(() => {
    return userColors[Math.floor(Math.random() * userColors.length)];
  }, []);

  // Create user preferences from Clerk user data or random values
  const [userPreferences, setUserPreferences] = useState<TLUserPreferences>({
    id: user?.id || `anonymous-${Math.random().toString(36).substring(2, 9)}`,
    name: user?.fullName || user?.username || randomName,
    color: randomColor,
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

  // State for user settings modal
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [tempName, setTempName] = useState('');

  // Update tempName when userPreferences.name changes or when modal opens
  useEffect(() => {
    if (showUserSettings) {
      setTempName(userPreferences.name || '');
    }
  }, [showUserSettings, userPreferences.name]);

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

      {/* User settings button */}
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
          display: "flex",
          gap: "8px",
        }}
      >
        <button
          onClick={() => setShowUserSettings(true)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "5px 10px",
            borderRadius: "4px",
            backgroundColor: "#f0f0f0",
          }}
        >
          Edit Profile
        </button>
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal" />
        </SignedOut>
      </div>

      {/* User settings modal */}
      {showUserSettings && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              width: "300px",
              maxWidth: "90%",
            }}
          >
            <h2 style={{ marginTop: 0 }}>User Settings</h2>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>
                Display Name:
              </label>
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>
                Color:
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {userColors.map((color) => (
                  <div
                    key={color}
                    onClick={() => {
                      setUserPreferences((prev) => ({
                        ...prev,
                        color,
                      }));
                    }}
                    style={{
                      width: "24px",
                      height: "24px",
                      backgroundColor: color,
                      borderRadius: "50%",
                      cursor: "pointer",
                      border: userPreferences.color === color ? "2px solid black" : "none",
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setShowUserSettings(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "#f0f0f0",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setUserPreferences((prev) => ({
                    ...prev,
                    name: tempName || randomName,
                  }));
                  setShowUserSettings(false);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "#0066ff",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
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
