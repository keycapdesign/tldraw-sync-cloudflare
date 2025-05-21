import {
  ClerkProvider as BaseClerkProvider,
  SignIn,
  SignedIn,
  SignedOut,
} from "@clerk/clerk-react";
import { ReactNode } from "react";

// Get the publishable key from the environment variables
const PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "your_publishable_key";

interface ClerkProviderProps {
  children: ReactNode;
}

export function ClerkProvider({ children }: ClerkProviderProps) {
  return (
    <BaseClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            flexDirection: "column",
            backgroundColor: "#fefefe",
          }}
        >
          <SignIn />
        </div>
      </SignedOut>
    </BaseClerkProvider>
  );
}
