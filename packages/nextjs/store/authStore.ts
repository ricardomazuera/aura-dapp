import { create } from 'zustand';
import { supabase } from '~~/lib/supabase';
import { getUserRole, createOrGetUserWallet } from '~~/lib/api';

interface AuthState {
  user: {
    id: string;
    email: string;
    role: 'free' | 'pro' | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  session: any;
  isLoading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
  handleAuthRedirect: () => Promise<void>;
  isWalletCreated: boolean;
  getToken: () => string | null;
  isCheckingSession: boolean;
  lastSessionCheck: number;
  refetchUser: () => Promise<void>;
  updateRoleUser: (role: 'free' | 'pro') => Promise<boolean>;
}

// Helper to save the token in localStorage
const saveTokenToStorage = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('aura_token', token);
  }
};

// Helper to get token from localStorage
const getTokenFromStorage = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('aura_token');
  }
  return null;
};

// Helper to remove token from localStorage
const removeTokenFromStorage = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('aura_token');
  }
};

// Minimum time between session checks (5 seconds)
const SESSION_CHECK_COOLDOWN = 5000;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: false,
  error: null,
  isWalletCreated: false,
  isCheckingSession: false,
  lastSessionCheck: 0,
  
  // Method to get the current token
  getToken: () => getTokenFromStorage(),
  
  // New method to reload user data from the server
  refetchUser: async (): Promise<void> => {
    try {
      const token = getTokenFromStorage();
      if (!token) {
        console.error('No authentication token found for refetching user data');
        return;
      }
      
      console.log('Refetching user data after subscription update');
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No active session found');
        return;
      }
      
      // Get updated user data including their role
      const userWithRole = await getUserRole(token);
      
      // Update state with fresh data
      set({ 
        user: {
          id: userWithRole.id,
          email: userWithRole.email,
          role: userWithRole.role,
          firstName: userWithRole.firstName,
          lastName: userWithRole.lastName
        },
        session 
      });
      
      console.log('User data refreshed successfully, new role:', userWithRole.role);
    } catch (error) {
      console.error('Error refetching user data:', error);
      // We don't update the error state to avoid breaking the user experience
    }
  },
  
  // Function to update the user's role
  updateRoleUser: async (role: 'free' | 'pro'): Promise<boolean> => {
    try {
      const token = getTokenFromStorage();
      if (!token) {
        console.error('No authentication token found');
        return false;
      }
      
      // Immediately update local state to improve UX
      if (get().user) {
        set({ 
          user: {
            ...get().user as any,
            role: role 
          }
        });
      }
      
      // Call the backend endpoint to update the user's role
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/user/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role })
      });
      
      if (!response.ok) {
        console.error(`Error updating user role: ${response.statusText}`);
        
        // Revert the local change if the operation failed
        if (get().user) {
          set({ 
            user: {
              ...get().user as any,
              role: get().user.role
            }
          });
        }
        return false;
      }
      
      const data = await response.json();
      console.log('User role updated successfully:', data);
      
      // Reload user data to ensure we have the most up-to-date information
      await get().refetchUser();
      
      return true;
    } catch (error) {
      console.error('Error updating user role:', error);
      
      // Revert the local change if the operation failed
      if (get().user) {
        set({ 
          user: {
            ...get().user as any,
            role: get().user.role
          }
        });
      }
      
      return false;
    }
  },
  
  // Function to handle auth redirects and new user setup
  handleAuthRedirect: async () => {
    try {
      set({ isLoading: true, error: null });
      
      // Get current authentication state after redirect
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;
      
      if (!session) {
        set({ user: null, session: null });
        return;
      }
      
      // Save token in localStorage
      if (session.access_token) {
        saveTokenToStorage(session.access_token);
      }
      
      try {
        // Single call to getUserRole
        const userWithRole = await getUserRole(session.access_token);
        set({ 
          user: {
            id: userWithRole.id,
            email: userWithRole.email,
            role: userWithRole.role,
            firstName: userWithRole.firstName,
            lastName: userWithRole.lastName
          },
          session 
        });
        
        // Single call to createOrGetUserWallet using cache internally
        const walletResponse = await createOrGetUserWallet(
          userWithRole.id, 
          userWithRole.email, 
          session.access_token
        );
        
        // If the response was successful, mark wallet as created
        if (walletResponse.success) {
          set({ isWalletCreated: true });
          console.log('Wallet ready');
        }
        
        // Redirect to dashboard after everything is set up
        window.location.href = `${window.location.origin}/dashboard`;
      } catch (error) {
        console.error('Error in auth redirect flow:', error);
        // Redirect to dashboard even if there are errors, to avoid blocking the user
        window.location.href = `${window.location.origin}/dashboard`;
      }
    } catch (error) {
      set({ error: (error as Error).message });
      console.error('Error handling auth redirect:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  signInWithGoogle: async () => {
    try {
      set({ isLoading: true, error: null });
      // Change redirect to an auth callback page instead of directly to dashboard
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });
      
      if (error) throw error;
    } catch (error) {
      set({ error: (error as Error).message });
      console.error('Error signing in with Google:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  signOut: async () => {
    try {
      set({ isLoading: true, error: null });
      const { error } = await supabase.auth.signOut({
        options: {
          redirectTo: `${window.location.origin}`,
        }
      });
      if (error) throw error;
      
      // Remove token from localStorage when signing out
      removeTokenFromStorage();
      
      set({ user: null, session: null });
    } catch (error) {
      set({ error: (error as Error).message });
      console.error('Error signing out:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  checkSession: async () => {
    // Prevent multiple simultaneous session checks
    if (get().isCheckingSession) {
      return;
    }
    
    // Prevent too frequent session checks
    const now = Date.now();
    if (now - get().lastSessionCheck < SESSION_CHECK_COOLDOWN) {
      return;
    }
    
    try {
      set({ isCheckingSession: true, lastSessionCheck: now });
      
      // Only set isLoading if we don't have user data yet
      if (!get().user) {
        set({ isLoading: true });
      }
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;
      
      if (session) {
        // Update token in localStorage with each valid session
        if (session.access_token) {
          saveTokenToStorage(session.access_token);
        }
        
        // If we already have user data and the ID matches, we don't need to reload the profile
        if (get().user && get().user.id === session.user.id) {
          // Only update the session
          set({ session });
          return;
        }
        
        try {
          // Single call to get the role and save in cache
          const userWithRole = await getUserRole(session.access_token);
          set({ 
            user: {
              id: userWithRole.id,
              email: userWithRole.email,
              role: userWithRole.role,
              firstName: userWithRole.firstName,
              lastName: userWithRole.lastName
            },
            session 
          });
          
          // Check wallet status (will use cache if available)
          try {
            const walletResponse = await createOrGetUserWallet(
              userWithRole.id, 
              userWithRole.email, 
              session.access_token
            );
            
            set({ isWalletCreated: walletResponse.success });
          } catch (walletError) {
            console.error('Error checking wallet status:', walletError);
          }
        } catch (roleError) {
          console.error('Error getting user role:', roleError);
          
          // Basic user information if we can't get the role
          set({ 
            user: {
              id: session.user.id,
              email: session.user.email as string,
              role: 'free',
              firstName: null,
              lastName: null
            },
            session 
          });
        }
      } else {
        removeTokenFromStorage();
        set({ user: null, session: null });
      }
    } catch (error) {
      set({ error: (error as Error).message });
      console.error('Error checking session:', error);
    } finally {
      set({ isLoading: false, isCheckingSession: false });
    }
  }
}));