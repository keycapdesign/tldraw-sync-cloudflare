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
    // Get the Authorization header from the request
    const authHeader = request.headers?.get?.('Authorization') ||
                       (request as unknown as Request).headers?.get?.('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized: No valid token provided', { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return new Response('Unauthorized: No valid token provided', { status: 401 });
    }

    // Initialize Clerk with the secret key
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

    // Verify the token with Clerk
    const session = await clerk.verifyToken(token);

    if (!session || !session.sub) {
      return new Response('Unauthorized: Invalid token', { status: 401 });
    }

    // Add the user ID to the request for later use
    request.userId = session.sub;

  } catch (error) {
    console.error('Authentication error:', error);
    return new Response('Unauthorized: Invalid token', { status: 401 });
  }
};
