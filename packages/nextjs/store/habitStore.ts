import { create } from 'zustand';
import { getHabits, createHabit, updateHabitProgress } from '../lib/api';
import { useAuthStore } from './authStore';

export interface Habit {
  id: string;
  name: string;
  daysCompleted: number;
  completed: boolean;
  createdAt: string;
}

interface HabitState {
  habits: Habit[];
  isLoading: boolean;
  error: string | null;
  fetchHabits: () => Promise<void>;
  addHabit: (name: string) => Promise<Habit | null>;
  updateProgress: (habitId: string) => Promise<Habit | null>;
  canCreateHabit: () => boolean;
  clearError: () => void;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  isLoading: false,
  error: null,
  
  clearError: () => set({ error: null }),
  
  fetchHabits: async () => {
    const { session } = useAuthStore.getState();
    
    if (!session) {
      console.warn('Attempting to fetch habits without authentication');
      set({ error: 'User not authenticated' });
      return;
    }
    
    try {
      set({ isLoading: true, error: null });
      console.log('Fetching habits with token:', session.access_token);
      
      const habits = await getHabits(session.access_token);
      console.log('Habits received:', habits);
      
      set({ habits });
    } catch (error) {
      console.error('Error fetching habits:', error);
      set({ error: (error as Error).message || 'Failed to load habits' });
    } finally {
      set({ isLoading: false });
    }
  },
  
  addHabit: async (name: string) => {
    const { session } = useAuthStore.getState();
    if (!session) {
      console.warn('Attempting to add habit without authentication');
      set({ error: 'User not authenticated' });
      return null;
    }
    
    try {
      set({ isLoading: true, error: null });
      
      if (!get().canCreateHabit()) {
        set({ error: 'You have reached the maximum number of habits for your plan' });
        return null;
      }
      
      const newHabit = await createHabit(session.access_token, name);
      console.log('New habit created:', newHabit);
      
      // Update the habits list with the new one
      set(state => ({ habits: [...state.habits, newHabit] }));
      return newHabit;
    } catch (error) {
      console.error('Error creating habit:', error);
      set({ error: (error as Error).message || 'Failed to create habit' });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },
  
  updateProgress: async (habitId: string) => {
    const { session } = useAuthStore.getState();
    if (!session) {
      console.warn('Attempting to update habit without authentication');
      set({ error: 'User not authenticated' });
      return null;
    }
    
    try {
      set({ isLoading: true, error: null });
      const updatedHabit = await updateHabitProgress(session.access_token, habitId);
      console.log('Habit progress updated:', updatedHabit);
      
      // Update the habit in the store
      set(state => ({
        habits: state.habits.map(habit => 
          habit.id === updatedHabit.id ? updatedHabit : habit
        )
      }));
      
      return updatedHabit;
    } catch (error) {
      console.error('Error updating habit progress:', error);
      set({ error: (error as Error).message || 'Failed to update habit progress' });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },
  
  canCreateHabit: () => {
    const { user } = useAuthStore.getState();
    const { habits } = get();
    
    if (!user) return false;
    
    const maxHabits = user.role === 'pro' ? 5 : 1;
    return habits.length < maxHabits;
  }
}));