'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import Image from 'next/image';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

export default function LoginDialog({ isOpen, onClose, onLogin }: LoginDialogProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div 
          className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-display text-aura-gray-800">Sign in required</h2>
            <button 
              onClick={onClose}
              className="text-aura-gray-500 hover:text-aura-gray-700 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <p className="text-aura-gray-600 mb-8">
            Please sign in with your Google account to create and track your habits.
          </p>
          
          <button
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-3 btn bg-white border border-gray-300 text-aura-gray-700 hover:bg-gray-50"
          >
            <Image
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              width={18}
              height={18}
            />
            Sign in with Google
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}