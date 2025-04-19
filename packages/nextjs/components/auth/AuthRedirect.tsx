'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '~~/store/authStore';

interface AuthRedirectProps {
  children: React.ReactNode;
  protectedRoute: boolean; // true for AuthGuard, false for HomeRedirect
  redirectPath: string; // path to redirect to when condition is met
}

export function AuthRedirect({ children, protectedRoute, redirectPath }: AuthRedirectProps) {
  const router = useRouter();
  const { user, isLoading, checkSession } = useAuthStore();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [checkComplete, setCheckComplete] = useState(false);

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        console.log(`AuthRedirect (${protectedRoute ? 'protected' : 'public'}): Checking session`);
        // Ensure that you have the most up-to-date user information
        await checkSession();
        
        console.log(`AuthRedirect (${protectedRoute ? 'protected' : 'public'}): Session check complete, user:`, !!user);
        setCheckComplete(true);
        
        // Determine if we should redirect based on the route type and user state
        const shouldRedirect = protectedRoute ? !user : !!user;
        
        if (shouldRedirect) {
          console.log(`AuthRedirect (${protectedRoute ? 'protected' : 'public'}): Redirecting to ${redirectPath}`);
          setIsRedirecting(true);
          router.push(redirectPath);
        }
      } catch (error) {
        console.error(`Error in AuthRedirect (${protectedRoute ? 'protected' : 'public'}):`, error);
        setCheckComplete(true);
      }
    };
    
    if (!checkComplete && !isRedirecting) {
      checkAuthentication();
    }
  }, [protectedRoute, redirectPath, router, user, checkSession, checkComplete, isRedirecting]);

  // Show spinner while checking authentication or loading
  if (isLoading || !checkComplete) {
    return renderLoadingSpinner();
  }

  // If redirecting, show spinner
  if (isRedirecting) {
    return renderLoadingSpinner();
  }

  // If the user state doesn't match what we expect for this route type,
  // try to redirect again if for some reason it didn't redirect before
  const shouldBeRedirected = protectedRoute ? !user : !!user;
  if (shouldBeRedirected) {
    if (!isRedirecting) {
      router.push(redirectPath);
      setIsRedirecting(true);
    }
    
    return renderLoadingSpinner();
  }
  
  // If the user state is as expected for this route type, show the content
  return <>{children}</>;
}

// Helper function to render the loading spinner
function renderLoadingSpinner() {
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-aura-primary"></div>
    </div>
  );
}