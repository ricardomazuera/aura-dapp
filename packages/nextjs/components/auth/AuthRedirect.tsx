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
  const { user, isLoading, checkSession, getToken } = useAuthStore();
  const [checkComplete, setCheckComplete] = useState(false);

  // Verify if the user should be redirected based on authentication state
  const shouldRedirect = protectedRoute ? !user : !!user;
  
  useEffect(() => {
    let isMounted = true;
    
    const checkAndRedirect = async () => {
      try {
        // Quick first check: verify if there's a token in localStorage
        const token = getToken();
        
        // If it's a public route (HomeRedirect) and there's a token, redirect immediately without waiting
        if (!protectedRoute && token) {
          console.log('AuthRedirect: Token found in localStorage, redirecting immediately');
          router.replace(redirectPath);
          return;
        }
        
        // If it's a protected route and there's no token, redirect immediately to login
        if (protectedRoute && !token) {
          console.log('AuthRedirect: No token found for protected route, redirecting immediately');
          router.replace(redirectPath);
          return;
        }
        
        console.log(`AuthRedirect (${protectedRoute ? 'protected' : 'public'}): Checking session`);
        
        // Verify session to get updated data
        await checkSession();
        
        if (!isMounted) return;
        
        console.log(`AuthRedirect (${protectedRoute ? 'protected' : 'public'}): Session check complete, user:`, !!user);
        setCheckComplete(true);
        
        // Check if we should redirect after verifying the session
        if (shouldRedirect) {
          console.log(`AuthRedirect (${protectedRoute ? 'protected' : 'public'}): Redirecting to ${redirectPath}`);
          router.replace(redirectPath); // Use replace instead of push to avoid history issues
        }
      } catch (error) {
        console.error(`Error in AuthRedirect (${protectedRoute ? 'protected' : 'public'}):`, error);
        setCheckComplete(true);
      }
    };
    
    // Only verify if the check hasn't been completed yet
    if (!checkComplete) {
      checkAndRedirect();
    } 
    // If verification is complete and we should redirect, do it
    else if (shouldRedirect) {
      router.replace(redirectPath);
    }
    
    return () => {
      isMounted = false;
    };
  }, [protectedRoute, redirectPath, router, user, checkSession, checkComplete, shouldRedirect, getToken]);

  // If we're loading or checking the session, show spinner
  if (isLoading || !checkComplete) {
    return renderLoadingSpinner();
  }

  // If we should redirect but it hasn't completed yet, show spinner
  if (shouldRedirect) {
    return renderLoadingSpinner();
  }
  
  // If everything is in order and we don't need to redirect, show the content
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