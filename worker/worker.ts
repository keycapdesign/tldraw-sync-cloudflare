import { handleUnfurlRequest } from "cloudflare-workers-unfurl";
import { AutoRouter, cors, error, IRequest } from "itty-router";
import { handleAssetDownload, handleAssetUpload } from "./assetUploads";
import { requireAuth } from "./authMiddleware";
import { Environment } from "./types";

// make sure our sync durable object is made available to cloudflare
export { TldrawDurableObject } from "./TldrawDurableObject";

// we use itty-router (https://itty.dev/) to handle routing. in this example we turn on CORS because
// we're hosting the worker separately to the client. you should restrict this to your own domain.
const { preflight, corsify } = cors({ origin: "*" });
const router = AutoRouter<IRequest, [env: Environment, ctx: ExecutionContext]>({
  before: [preflight],
  finally: [corsify],
  catch: (e) => {
    console.error(e);
    return error(e);
  },
})
  // requests to /connect are routed to the Durable Object, and handle realtime websocket syncing
  .get("/connect/:roomId", async (request, env) => {
    // Authenticate the request
    const authResponse = await requireAuth(request, env);
    if (authResponse instanceof Response) return authResponse;

    // Get the Durable Object for this room
    const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params!.roomId);
    const room = env.TLDRAW_DURABLE_OBJECT.get(id);

    // Add the userId to the headers if it exists
    const req = request as unknown as Request;
    const headers = new Headers(req.headers);
    if (request.userId) {
      headers.set('X-User-ID', request.userId);
    }

    // Forward the request to the Durable Object
    return room.fetch(req.url, {
      headers,
      body: req.body,
    });
  })

  // assets can be uploaded to the bucket under /uploads:
  .post("/uploads/:uploadId", async (request, env) => {
    // Authenticate the request
    const authResponse = await requireAuth(request, env);
    if (authResponse instanceof Response) return authResponse;

    return handleAssetUpload(request, env);
  })

  // they can be retrieved from the bucket too:
  .get("/uploads/:uploadId", async (request, env, ctx) => {
    // Authenticate the request
    const authResponse = await requireAuth(request, env);
    if (authResponse instanceof Response) return authResponse;

    return handleAssetDownload(request, env, ctx);
  })

  // bookmarks need to extract metadata from pasted URLs:
  .get("/unfurl", async (request, env) => {
    // Authenticate the request
    const authResponse = await requireAuth(request, env);
    if (authResponse instanceof Response) return authResponse;

    // Pass the request to the unfurl handler
    return handleUnfurlRequest(request as unknown as Request);
  });

// export our router for cloudflare
export default router;
