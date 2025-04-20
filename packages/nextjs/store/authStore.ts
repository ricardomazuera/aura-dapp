import { create } from 'zustand';
import { supabase } from '~~/lib/supabase';
import { getUserRole, createOrGetUserWallet } from '~~/lib/api';

interface AuthState {
  user: {
    id: string;
    email: string;
    role: 'free' | 'pro' | null;
  } | null;
  session: any;
  isLoading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
  handleAuthRedirect: () => Promise<void>;
  isWalletCreated: boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: false,
  error: null,
  isWalletCreated: false,
  
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
      
      try {
        const userWithRole = await getUserRole(session.access_token);
        set({ 
          user: {
            id: userWithRole.id,
            email: userWithRole.email,
            role: userWithRole.role
          },
          session 
        });
        
        // Call the backend endpoint to create or get the user's wallet

        const walletResponse = await createOrGetUserWallet(
          userWithRole.id, 
          userWithRole.email, 
          session.access_token
        );
        
        // If the response was successful, mark the wallet as created

        if (walletResponse.success) {
          set({ isWalletCreated: true });
          
            // If necessary, we could store more wallet information in the state here

          console.log('Wallet created or retrieved successfully:', walletResponse.wallet);
        }
        
        // Redirect to dashboard after everything is set up
        window.location.href = `${window.location.origin}/dashboard`;
      } catch (roleError) {
        console.error('Error getting user role:', roleError);
        set({ 
          user: {
            id: session.user.id,
            email: session.user.email as string,
            role: 'free'
          },
          session 
        });
        
        // Still try to create/get the wallet even if getting the role failed

        try {
          const walletResponse = await createOrGetUserWallet(
            session.user.id, 
            session.user.email as string, 
            session.access_token
          );
          
          if (walletResponse.success) {
            set({ isWalletCreated: true });
          }
        } catch (walletError) {
          console.error('Error creating/getting wallet:', walletError);
        }
        
        // Redirect to dashboard after everything is set up
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
      set({ user: null, session: null });
    } catch (error) {
      set({ error: (error as Error).message });
      console.error('Error signing out:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  checkSession: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;
      
      if (session) {
        try {
          const userWithRole = await getUserRole(session.access_token);
          set({ 
            user: {
              id: userWithRole.id,
              email: userWithRole.email,
              role: userWithRole.role
            },
            session 
          });
          
            // Check wallet status in the backend

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
          set({ 
            user: {
              id: session.user.id,
              email: session.user.email as string,
              role: 'free'
            },
            session 
          });
        }
      } else {
        set({ user: null, session: null });
      }
    } catch (error) {
      set({ error: (error as Error).message });
      console.error('Error checking session:', error);
    } finally {
      set({ isLoading: false });
    }
  }
}));