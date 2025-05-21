import { useAuth } from '@clerk/clerk-react';

// Custom hook to get the authentication token
export function useAuthToken() {
  const { getToken, isSignedIn } = useAuth();
  
  // Function to get the auth headers for API requests
  const getAuthHeaders = async (): Promise<HeadersInit> => {
    if (!isSignedIn) {
      return {};
    }
    
    try {
      const token = await getToken({ template: 'backend' });
      if (token) {
        return {
          Authorization: `Bearer ${token}`,
        };
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    
    return {};
  };
  
  return { getAuthHeaders, isSignedIn };
}
