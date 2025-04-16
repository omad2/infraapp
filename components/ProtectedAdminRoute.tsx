import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({ children }) => {
  const { isAdmin } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isAdmin) {
      router.replace('/'); // Redirect to home if not admin
    }
  }, [isAdmin, router]);

  if (!isAdmin) {
    return null; // Return nothing while redirecting
  }

  return <>{children}</>;
};

export default ProtectedAdminRoute; 