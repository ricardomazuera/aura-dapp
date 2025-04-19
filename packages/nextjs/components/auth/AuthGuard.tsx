'use client';

import { AuthRedirect } from './AuthRedirect';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthRedirect protectedRoute={true} redirectPath="/">
      {children}
    </AuthRedirect>
  );
}