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

// Array of colors for random user colors (no white since it wouldn't be visible)
const userColors = [
  "red", "orange", "yellow", "green", "blue", "purple", "pink", "teal", "indigo", "violet",
  "cyan", "magenta", "lime", "darkorange", "forestgreen", "crimson", "royalblue", "darkviolet"
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

      {/* User settings button - moved to bottom right */}
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
          display: "flex",
          gap: "10px",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: "14px", color: "#666" }}>
          <span style={{
            display: "inline-block",
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: userPreferences.color || "blue",
            marginRight: "5px"
          }}></span>
          {userPreferences.name}
        </div>
        <button
          onClick={() => setShowUserSettings(true)}
          style={{
            background: "none",
            border: "1px solid #ddd",
            cursor: "pointer",
            padding: "6px 12px",
            borderRadius: "4px",
            backgroundColor: "#f8f8f8",
            fontSize: "13px",
            transition: "all 0.2s ease",
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f0f0f0"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#f8f8f8"}
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
              padding: "24px",
              borderRadius: "12px",
              width: "340px",
              maxWidth: "90%",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>User Settings</h2>
              <button
                onClick={() => setShowUserSettings(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "20px",
                  lineHeight: 1,
                  color: "#999",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "500",
                color: "#555"
              }}>
                Display Name
              </label>
              <input
                type="text"
                value={tempName}
                placeholder="Enter your display name"
                onChange={(e) => setTempName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "500",
                color: "#555"
              }}>
                Cursor Color
              </label>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: "8px",
                marginTop: "5px"
              }}>
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
                      width: "36px",
                      height: "36px",
                      backgroundColor: color,
                      borderRadius: "6px",
                      cursor: "pointer",
                      border: userPreferences.color === color ? "3px solid #333" : "1px solid #ddd",
                      transition: "transform 0.1s ease",
                      transform: userPreferences.color === color ? "scale(1.1)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={() => setShowUserSettings(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "6px",
                  border: "1px solid #ddd",
                  backgroundColor: "white",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "background-color 0.2s ease",
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "white"}
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
                  padding: "10px 16px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#0066ff",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "background-color 0.2s ease",
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#0052cc"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#0066ff"}
              >
                Save Changes
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
