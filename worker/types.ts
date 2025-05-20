// the contents of the environment should mostly be determined by wrangler.toml. These entries match
// the bindings defined there.
export interface Environment {
	TLDRAW_BUCKET: R2Bucket
	TLDRAW_DURABLE_OBJECT: DurableObjectNamespace
	CLERK_SECRET_KEY: string
	CLERK_PUBLISHABLE_KEY: string
	ENVIRONMENT?: string
}

// Extend the IRequest interface to include userId
declare module 'itty-router' {
	interface IRequest {
		userId?: string;
	}
}
