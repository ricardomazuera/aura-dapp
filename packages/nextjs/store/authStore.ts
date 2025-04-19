import { create } from 'zustand';
import { supabase } from '~~/lib/supabase';
import { getUserRole } from '~~/lib/api';

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
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: false,
  error: null,
  
  signInWithGoogle: async () => {
    try {
      set({ isLoading: true, error: null });
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
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