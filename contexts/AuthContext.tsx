// /contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const USER_KEY = 'firebase_user';

type UserRole = 'user' | 'admin' | 'moderator';

interface UserData extends User {
  role?: UserRole;
}

type AuthContextType = {
  user: UserData | null;
  loading: boolean;
  isAdmin: boolean;
  refreshUserRole: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  refreshUserRole: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Function to fetch user role from Firestore
  const fetchUserRole = async (firebaseUser: User) => {
    try {
      // Get user role from Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      const userData = userDoc.data();
      
      const userWithRole = {
        ...firebaseUser,
        role: userData?.role || 'user',
      } as UserData;
      
      setUser(userWithRole);
      setIsAdmin(userWithRole.role === 'admin' || userWithRole.role === 'moderator');
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userWithRole));
    } catch (error) {
      console.error('Error fetching user role:', error);
      // If there's an error, still set the user but with default role
      const userWithDefaultRole = {
        ...firebaseUser,
        role: 'user',
      } as UserData;
      
      setUser(userWithDefaultRole);
      setIsAdmin(false);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userWithDefaultRole));
    }
  };

  // Function to refresh user role
  const refreshUserRole = async () => {
    if (user) {
      await fetchUserRole(user);
    }
  };

  // Load user from AsyncStorage on startup
  useEffect(() => {
    const loadUser = async () => {
      const json = await AsyncStorage.getItem(USER_KEY);
      
      if (json) {
        try {
          const parsedUser = JSON.parse(json);
          setUser(parsedUser);
          setIsAdmin(parsedUser.role === 'admin' || parsedUser.role === 'moderator');
        } catch {
          await AsyncStorage.removeItem(USER_KEY);
        }
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  // Monitor auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUserRole(firebaseUser);
      } else {
        setUser(null);
        setIsAdmin(false);
        await AsyncStorage.removeItem(USER_KEY);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, refreshUserRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
