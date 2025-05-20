import { Clerk } from '@clerk/clerk-sdk-node';
import { IRequest } from 'itty-router';
import { Environment } from './types';

// Initialize Clerk with your secret key
const createClerkClient = (secretKey: string) => {
  return Clerk({ secretKey });
};

// Middleware to verify authentication
export const requireAuth = async (request: IRequest, env: Environment) => {
  // Skip auth check in development mode if no secret key is provided
  if (!env.CLERK_SECRET_KEY && process.env.NODE_ENV !== 'production') {
    console.warn('No Clerk secret key provided, skipping authentication check');
    return;
  }

  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized: No valid token provided', { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return new Response('Unauthorized: No valid token provided', { status: 401 });
    }

    // Verify the token with Clerk
    const clerk = createClerkClient(env.CLERK_SECRET_KEY);
    const { sub: userId } = await clerk.verifyToken(token);

    if (!userId) {
      return new Response('Unauthorized: Invalid token', { status: 401 });
    }

    // Add the user ID to the request for later use
    request.userId = userId;
    
  } catch (error) {
    console.error('Authentication error:', error);
    return new Response('Unauthorized: Invalid token', { status: 401 });
  }
};
