'use client';

import { AuthRedirect } from './AuthRedirect';

export function HomeRedirect({ children }: { children: React.ReactNode }) {
  return (
    <AuthRedirect protectedRoute={false} redirectPath="/dashboard">
      {children}
    </AuthRedirect>
  );
}