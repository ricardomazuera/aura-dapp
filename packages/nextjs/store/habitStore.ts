import { create } from 'zustand';
import { getHabits, createHabit, updateHabitProgress } from '../lib/api';
import { useAuthStore } from './authStore';

export interface Habit {
  id: string;
  name: string;
  daysCompleted: number;
  completed: boolean;
  createdAt: string;
  lastTrackedDate?: string;
}

interface HabitState {
  habits: Habit[];
  isLoading: boolean;
  error: string | null;
  fetchHabits: () => Promise<void>;
  addHabit: (name: string) => Promise<Habit | null>;
  updateProgress: (habitId: string) => Promise<Habit | null>;
  canCreateHabit: () => boolean;
  getHabitLimitInfo: () => { canCreate: boolean; message: string; habitsLeft: number };
  clearError: () => void;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  isLoading: false,
  error: null,
  
  clearError: () => set({ error: null }),
  
  fetchHabits: async () => {
    const { user, getToken } = useAuthStore.getState();
    
    if (!user) {
      console.warn('Attempting to fetch habits without authentication');
      set({ error: 'User not authenticated' });
      return;
    }
    
    try {
      set({ isLoading: true, error: null });
      
      const token = getToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const habits = await getHabits(token);
      
      set({ habits });
    } catch (error) {
      console.error('Error fetching habits:', error);
      set({ error: (error as Error).message || 'Failed to load habits' });
    } finally {
      set({ isLoading: false });
    }
  },
  
  addHabit: async (name: string) => {
    const { user, getToken } = useAuthStore.getState();
    if (!user) {
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
      
      const token = getToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const newHabit = await createHabit(name, token);
      
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
    const { user, getToken } = useAuthStore.getState();
    if (!user) {
      console.warn('Attempting to update habit without authentication');
      set({ error: 'User not authenticated' });
      return null;
    }
    
    try {
      set({ isLoading: true, error: null });
      
      const token = getToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const updatedHabit = await updateHabitProgress(habitId, token);
      
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
    
    // For free users, the limit remains at 1
    if (user.role === 'free') return habits.length < 1;
    
    // For Pro users:
    // - Initial maximum: 5 habits
    // - For each completed habit, an additional space is unlocked
    if (user.role === 'pro') {
      const baseLimit = 5;
      const completedHabits = habits.filter(habit => habit.completed).length;
      const activeHabits = habits.filter(habit => !habit.completed).length;
      
      // Instead of comparing all habits, we only consider active (uncompleted) ones
      // and verify if they are within the limit (base + completed)
      return activeHabits < baseLimit;
    }
    
    return false;
  },

  // New function to get informative messages about habit limits
  getHabitLimitInfo: () => {
    const { user } = useAuthStore.getState();
    const { habits } = get();
    
    if (!user) return { canCreate: false, message: '', habitsLeft: 0 };
    
    if (user.role === 'free') {
      const habitsLeft = Math.max(0, 1 - habits.length);
      return {
        canCreate: habitsLeft > 0,
        message: habitsLeft > 0 ? '' : 'Upgrade to Premium to create more habits',
        habitsLeft
      };
    }
    
    if (user.role === 'pro') {
      const baseLimit = 5;
      const activeHabits = habits.filter(habit => !habit.completed).length;
      const habitsLeft = Math.max(0, baseLimit - activeHabits);
      
      return {
        canCreate: habitsLeft > 0,
        message: habitsLeft > 0 ? 
          `You can create ${habitsLeft} more habit${habitsLeft !== 1 ? 's' : ''}` : 
          'Complete one of your current habits to unlock an additional space',
        habitsLeft
      };
    }
    
    return { canCreate: false, message: '', habitsLeft: 0 };
  }
}));