import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Get the worker URL from the environment variable
  const workerUrl =
    env.TLDRAW_WORKER_URL ||
    env.VITE_TLDRAW_WORKER_URL ||
    (mode === "production"
      ? "https://tldraw-worker.andrew-eca.workers.dev"
      : "http://localhost:5172");

  // Get the Clerk publishable key from the environment variable
  const clerkPublishableKey = env.VITE_CLERK_PUBLISHABLE_KEY
  
  console.log("Using worker URL:", workerUrl);
  if (clerkPublishableKey) {
    console.log("Clerk publishable key found");
  } else {
    console.log("No Clerk publishable key found");
  }

  return {
    plugins: [react()],
    define: {
      // Use Vite's environment variable format
      "import.meta.env.VITE_TLDRAW_WORKER_URL": JSON.stringify(workerUrl),
      "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY":
        JSON.stringify(clerkPublishableKey),
    },
  };
});
