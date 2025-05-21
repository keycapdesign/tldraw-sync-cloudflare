import { createClerkClient } from '@clerk/backend';
import { IRequest } from 'itty-router';
import { Environment } from './types';

// Middleware to verify authentication
export const requireAuth = async (request: IRequest, env: Environment) => {
  // Skip auth check if no secret key is provided
  if (!env.CLERK_SECRET_KEY) {
    console.warn('No Clerk secret key provided, skipping authentication check');
    return;
  }

  // Check if we're in development mode
  const headers = (request as unknown as Request).headers;
  const url = (request as unknown as Request).url;
  const urlObj = new URL(url);

  const isDevelopment = env.ENVIRONMENT === 'development' ||
                        headers.get('Origin')?.includes('localhost') ||
                        headers.get('Origin')?.includes('127.0.0.1');

  // For WebSocket connections, be more lenient
  const isWebSocketConnection = headers.get('Upgrade') === 'websocket';

  console.log('Authentication check', {
    isDevelopment,
    isWebSocketConnection,
    origin: headers.get('Origin'),
    url: url
  });

  // If we're in development mode and it's a WebSocket connection, allow it
  if (isDevelopment && isWebSocketConnection) {
    console.log('Development mode WebSocket connection, skipping authentication check');
    request.userId = 'dev-user';
    return;
  }

  try {
    // Initialize Clerk with the secret key and publishable key
    const clerk = createClerkClient({
      secretKey: env.CLERK_SECRET_KEY,
      publishableKey: env.CLERK_PUBLISHABLE_KEY
    });

    // Check for auth token in query parameter for WebSocket connections
    // This is needed because WebSocket connections can't easily set Authorization headers
    const authQueryParam = urlObj.searchParams.get('auth');

    // Create a new request with the auth token in the Authorization header if it exists in query params
    let requestToAuthenticate: Request = request as unknown as Request;

    if (isWebSocketConnection && authQueryParam) {
      // Clone the request and add the Authorization header
      const newHeaders = new Headers(headers);
      newHeaders.set('Authorization', `Bearer ${authQueryParam}`);

      requestToAuthenticate = new Request(url, {
        method: (request as unknown as Request).method,
        headers: newHeaders,
        body: (request as unknown as Request).body,
      });

      console.log('Using auth token from query parameter for WebSocket connection');
    }

    // Get the session from the request
    // This automatically checks for the Authorization header or the clerk-session-id cookie
    const requestState = await clerk.authenticateRequest(requestToAuthenticate);

    // Get the auth object from the request state
    const auth = requestState.toAuth();

    // If no userId is found, return unauthorized
    if (!auth?.userId) {
      console.warn('No valid session found');

      // In development mode, allow access even without authentication
      if (isDevelopment) {
        console.log('Development mode, allowing access without authentication');
        request.userId = 'dev-user';
        return;
      }

      return new Response('Unauthorized: No valid session found', { status: 401 });
    }

    // Add the user ID to the request for later use
    request.userId = auth.userId;
    console.log('Authentication successful', { userId: auth.userId });

  } catch (error) {
    console.error('Authentication error:', error);

    // In development mode, allow access even with authentication errors
    if (isDevelopment) {
      console.log('Development mode, allowing access despite authentication error');
      request.userId = 'dev-user';
      return;
    }

    return new Response('Unauthorized: Invalid session', { status: 401 });
  }
};
