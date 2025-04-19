'use client';

import { useState, useRef, useEffect } from 'react';
import { UserCircle2, LogOut } from 'lucide-react';
import Image from 'next/image';
import { useAuthStore } from '~~/store/authStore';

export default function UserMenu() {
  const { user, signOut } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 bg-white rounded-full pl-3 pr-4 py-2 border border-gray-200 hover:border-gray-300 transition-colors"
      >
        <Image
          src="https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp"
          alt="User avatar"
          width={32}
          height={32}
          className="rounded-full"
        />
        <div className="flex items-center">
          <span className="text-sm font-medium text-gray-700">{user.email}</span>
          <span className="ml-2 text-xs px-2 py-0.5 bg-aura-light text-aura-primary rounded-full">
            {user.role === 'pro' ? 'Pro' : 'Free'}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 border border-gray-200">
          <button
            onClick={() => {
              setIsOpen(false);
              signOut();
            }}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}