import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	// Get the worker URL from the environment variable
	const workerUrl = process.env.TLDRAW_WORKER_URL ||
		(mode === 'production' ? undefined : '`http://${location.hostname}:5172`')

	if (mode === 'production' && !workerUrl) {
		throw new Error('TLDRAW_WORKER_URL must be set in production')
	}

	return {
		plugins: [react()],
		define: {
			// Use Vite's environment variable format
			'import.meta.env.VITE_TLDRAW_WORKER_URL': JSON.stringify(workerUrl),
		},
	}
})
