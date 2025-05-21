import { useSync } from "@tldraw/sync";
import { TLUserPreferences, Tldraw, useTldrawUser } from "tldraw";
import { createBookmarkPreviewHandler } from "./getBookmarkPreview";
import {
  multiplayerAssetStore,
  setAuthToken as setGlobalAuthToken,
} from "./multiplayerAssetStore";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";

// Array of fun animal names for random user names (used with tldraw's built-in user settings)
const animalNames = [
  "Alligator",
  "Anteater",
  "Armadillo",
  "Badger",
  "Bat",
  "Beaver",
  "Buffalo",
  "Camel",
  "Capybara",
  "Chameleon",
  "Cheetah",
  "Chipmunk",
  "Coyote",
  "Crow",
  "Dolphin",
  "Duck",
  "Elephant",
  "Ferret",
  "Fox",
  "Frog",
  "Giraffe",
  "Gopher",
  "Hedgehog",
  "Hippo",
  "Kangaroo",
  "Koala",
  "Lemur",
  "Leopard",
  "Llama",
  "Manatee",
  "Monkey",
  "Moose",
  "Narwhal",
  "Otter",
  "Panda",
  "Penguin",
  "Platypus",
  "Rabbit",
  "Raccoon",
  "Rhino",
  "Sheep",
  "Squirrel",
  "Tiger",
  "Turtle",
  "Walrus",
  "Wolf",
  "Wombat",
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

  const randomName = useMemo(() => {
    const adjectives = [
      "Happy",
      "Sleepy",
      "Grumpy",
      "Sneezy",
      "Dopey",
      "Bashful",
      "Doc",
    ];
    const randomAdjective =
      adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomAnimal =
      animalNames[Math.floor(Math.random() * animalNames.length)];
    return `${randomAdjective} ${randomAnimal}`;
  }, []);

  const initialAnonymousId = useMemo(
    () => `anonymous-${Math.random().toString(36).substring(2, 9)}`,
    [],
  );

  const [userPreferences, setUserPreferencesState] =
    useState<TLUserPreferences>(() => ({
      id: initialAnonymousId,
      name: randomName, // Default to randomName for anonymous user
      color: "blue",
      colorScheme: "light",
    }));

  // Load user preferences from Clerk metadata when user logs in or out
  useEffect(() => {
    async function loadUserPreferences() {
      if (user) {
        let prefsToApply: TLUserPreferences;
        const metadata = user.unsafeMetadata;

        if (metadata && metadata.tldrawPreferences) {
          const savedPrefs = metadata.tldrawPreferences as any;
          prefsToApply = {
            id: user.id, // Use Clerk user ID
            name:
              savedPrefs.name || user.fullName || user.username || randomName,
            color: savedPrefs.color || "blue",
            colorScheme: (savedPrefs.colorScheme || "light") as
              | "light"
              | "dark"
              | "system",
          };
          console.log("Applying preferences loaded from Clerk:", prefsToApply);
        } else {
          prefsToApply = {
            id: user.id, // Use Clerk user ID
            name: user.fullName || user.username || randomName,
            color: "blue",
            colorScheme: "light" as "light",
          };
          console.log(
            "Applying default preferences for logged-in user:",
            prefsToApply,
          );
        }

        setUserPreferencesState((currentState) => {
          if (
            currentState.id !== prefsToApply.id ||
            currentState.name !== prefsToApply.name ||
            currentState.color !== prefsToApply.color ||
            currentState.colorScheme !== prefsToApply.colorScheme
          ) {
            return prefsToApply;
          }
          return currentState;
        });
      } else {
        // User logged out or not yet available, set/reset to anonymous state
        setUserPreferencesState((currentState) => {
          const anonymousPrefs: TLUserPreferences = {
            id: initialAnonymousId,
            name: randomName,
            color: "blue", // Default anonymous color
            colorScheme: "light", // Default anonymous scheme
          };
          if (
            currentState.id !== anonymousPrefs.id ||
            currentState.name !== anonymousPrefs.name ||
            currentState.color !== anonymousPrefs.color ||
            currentState.colorScheme !== anonymousPrefs.colorScheme
          ) {
            console.log(
              "User logged out or not present, resetting to anonymous preferences:",
              anonymousPrefs,
            );
            return anonymousPrefs;
          }
          return currentState;
        });
      }
    }

    loadUserPreferences();
  }, [user, randomName, initialAnonymousId]);

  const saveTimeoutRef = useRef<number | null>(null);

  const handleSetUserPreferencesByTldraw = useCallback(
    (newPreferencesFromTldraw: TLUserPreferences) => {
      let valuesActuallyChanged = false;

      setUserPreferencesState((currentLocalPreferences) => {
        if (
          currentLocalPreferences.id !== newPreferencesFromTldraw.id ||
          currentLocalPreferences.name !== newPreferencesFromTldraw.name ||
          currentLocalPreferences.color !== newPreferencesFromTldraw.color ||
          currentLocalPreferences.colorScheme !==
            newPreferencesFromTldraw.colorScheme
        ) {
          valuesActuallyChanged = true;
          console.log(
            "Preferences changed by tldraw UI, updating local state:",
            newPreferencesFromTldraw,
          );
          return newPreferencesFromTldraw;
        }
        console.log(
          "Preferences change from tldraw UI, but values are the same as local state.",
        );
        return currentLocalPreferences;
      });

      if (valuesActuallyChanged && user) {
        if (saveTimeoutRef.current !== null) {
          window.clearTimeout(saveTimeoutRef.current);
        }
        console.log("Scheduling save to Clerk for:", newPreferencesFromTldraw);
        saveTimeoutRef.current = window.setTimeout(() => {
          if (user) {
            console.log(
              "Saving user preferences to Clerk metadata:",
              newPreferencesFromTldraw,
            );
            user
              .update({
                unsafeMetadata: {
                  tldrawPreferences: {
                    name: newPreferencesFromTldraw.name,
                    color: newPreferencesFromTldraw.color,
                    colorScheme: newPreferencesFromTldraw.colorScheme,
                  },
                },
              })
              .then(() => {
                console.log("Successfully saved user preferences to Clerk.");
              })
              .catch((error) => {
                console.error("Error saving user preferences to Clerk:", error);
              });
          }
          saveTimeoutRef.current = null;
        }, 1000); // 1 second delay
      }
    },
    [user],
  );

  const tldrawUser = useTldrawUser({
    userPreferences,
    setUserPreferences: handleSetUserPreferencesByTldraw,
  });

  useEffect(() => {
    async function fetchToken() {
      setIsLoading(true); // Ensure loading state is true at the start
      try {
        const token = await getToken();
        setAuthToken(token);
        setGlobalAuthToken(token);
      } catch (error) {
        console.error("Error fetching auth token:", error);
        setAuthToken(null); // Ensure auth token is null on error
        setGlobalAuthToken(null);
      } finally {
        setIsLoading(false);
      }
    }

    if (user) {
      // Only fetch token if user is available (signed in)
      fetchToken();
    } else {
      setAuthToken(null); // Clear token if no user
      setGlobalAuthToken(null);
      setIsLoading(false); // No user, not loading token
    }
  }, [getToken, user]); // Add user to dependency array

  const wsUri = authToken
    ? `${WORKER_URL}/connect/${roomId}?auth=${authToken}`
    : "";

  const store = useSync({
    uri: wsUri, // uri can be empty initially, useSync handles this
    assets: multiplayerAssetStore,
    userInfo: userPreferences,
  });

  const bookmarkPreviewHandler = createBookmarkPreviewHandler(getToken);

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
      <p>Please sign in to collaborate.</p>
      <SignInButton mode="modal" />
    </div>
  );

  if (isLoading) {
    return loadingUI;
  }

  if (!user || !authToken) {
    // If not loading, and no user or no token, show sign-in
    // This handles the case where user is signed out, or token fetch failed, or user just arrived
    return authRequiredUI;
  }

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        store={store}
        user={tldrawUser}
        onMount={(editor) => {
          editor.registerExternalAssetHandler("url", bookmarkPreviewHandler);
          return () => {
            // Unmount cleanup
            if (saveTimeoutRef.current !== null) {
              window.clearTimeout(saveTimeoutRef.current);
              saveTimeoutRef.current = null;
            }
            if (user) {
              // Check user again, as it might have changed by the time of unmount
              try {
                console.log(
                  "Saving user preferences to Clerk metadata on unmount:",
                  userPreferences,
                );
                // Use user from the outer scope; if it changed, this update might be for the old user or fail.
                // For safety, it's better if this logic could somehow get the "current" user if it's critical.
                // However, user.update is an instance method, so it pertains to the 'user' instance captured by this effect.
                user
                  .update({
                    unsafeMetadata: {
                      tldrawPreferences: {
                        name: userPreferences.name,
                        color: userPreferences.color,
                        colorScheme: userPreferences.colorScheme,
                      },
                    },
                  })
                  .then(() => {
                    console.log(
                      "Saved user preferences to Clerk metadata on unmount",
                    );
                  })
                  .catch((error) => {
                    console.error(
                      "Error saving user preferences to Clerk on unmount:",
                      error,
                    );
                  });
              } catch (error) {
                console.error(
                  "Error updating Clerk metadata on unmount:",
                  error,
                );
              }
            }
          };
        }}
      />
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
        {/* SignedOut button is part of authRequiredUI, not usually shown when Tldraw is active */}
      </div>
    </div>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={VITE_CLERK_PUBLISHABLE_KEY}>
      <SignedIn>
        {" "}
        {/* Ensures TldrawWithClerkAuth only renders when truly signed in and user object is available */}
        <TldrawWithClerkAuth />
      </SignedIn>
      <SignedOut>
        {/* Simplified SignedOut view: TldrawWithClerkAuth will handle its authRequiredUI */}
        {/* Or provide a global sign-in prompt here */}
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
          <p>Please sign in to use the Tldraw app.</p>
          <SignInButton mode="modal" />
        </div>
      </SignedOut>
    </ClerkProvider>
  );
}

export default App;
