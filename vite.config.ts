import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	// Get the worker URL from the environment variable
	const workerUrl = process.env.TLDRAW_WORKER_URL || process.env.VITE_TLDRAW_WORKER_URL ||
		(mode === 'production' ? 'https://tldraw-worker.andrew-eca.workers.dev' : '`http://${location.hostname}:5172`')

	console.log('Using worker URL:', workerUrl)

	return {
		plugins: [react()],
		define: {
			// Use Vite's environment variable format
			'import.meta.env.VITE_TLDRAW_WORKER_URL': JSON.stringify(workerUrl),
		},
	}
})
