"use client"
import { useState } from 'react';
import { useAuthStore } from '~~/store/authStore';
import { useHabitStore } from '~~/store/habitStore';
import LoginDialog from '~~/components/LoginDialog';

const Home = () => {
  const { user, signInWithGoogle } = useAuthStore();
  const [habitName, setHabitName] = useState('');
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const { addHabit, isLoading } = useHabitStore();

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setShowLoginDialog(true);
      return;
    }

    if (!habitName.trim()) return;

    const result = await addHabit(habitName);
    if (result) {
      setHabitName('');
    }
  };

  return (
    <div className="flex items-center flex-col flex-grow pt-10">
      <div className="px-5">
        <h1 className="text-center">
          <span className="block text-2xl mb-2">Welcome to</span>
          <span className="block text-4xl font-bold">Aura - Hábitos que transforman tu energía</span>
        </h1>
      </div>
      <div className="flex flex-col items-center justify-center w-full h-60">
        <div className="w-full max-w-md p-6">
        </div>
        </div>
      <div className='flex flex-col items-center justify-center w-full h-full'>
        <div className="w-full max-w-md p-6">
          <h1 className="text-4xl font-display text-center mb-8 text-aura-gray-800">
            Create your habit
          </h1>

          <form onSubmit={handleCreateHabit} className="space-y-4">
            <input
              type="text"
              value={habitName}
              onChange={(e) => setHabitName(e.target.value)}
              placeholder="Enter your habit name"
              className="input text-lg"
            />

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading ? 'Creating...' : 'Create Habit'}
            </button>
          </form>

          <LoginDialog
            isOpen={showLoginDialog}
            onClose={() => setShowLoginDialog(false)}
            onLogin={() => {
              signInWithGoogle();
              setShowLoginDialog(false);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Home;
