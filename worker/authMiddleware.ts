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

  try {
    // Initialize Clerk with the secret key
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

    // Get the session from the request
    // This automatically checks for the Authorization header or the clerk-session-id cookie
    const requestState = await clerk.authenticateRequest(request as unknown as Request);

    // Get the auth object from the request state
    const auth = requestState.toAuth();

    // If no userId is found, return unauthorized
    if (!auth?.userId) {
      return new Response('Unauthorized: No valid session found', { status: 401 });
    }

    // Add the user ID to the request for later use
    request.userId = auth.userId;

  } catch (error) {
    console.error('Authentication error:', error);
    return new Response('Unauthorized: Invalid session', { status: 401 });
  }
};
