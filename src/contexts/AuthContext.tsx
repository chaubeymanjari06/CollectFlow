import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { authService } from '../services/authService';
import { UserProfile } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<FirebaseUser>;
  register: (email: string, pass: string, name: string, mobile?: string) => Promise<{ user: FirebaseUser; profile: UserProfile }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const profile = await authService.getUserProfile(uid);
      setUserProfile(profile);
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const user = await authService.login(email, pass);
    await fetchProfile(user.uid);
    return user;
  };

  const register = async (email: string, pass: string, name: string, mobile?: string) => {
    const res = await authService.register(email, pass, name, mobile);
    setUserProfile(res.profile);
    return res;
  };

  const logout = async () => {
    await authService.logout();
    setUserProfile(null);
    setCurrentUser(null);
  };

  const resetPassword = async (email: string) => {
    await authService.sendPasswordReset(email);
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await fetchProfile(currentUser.uid);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        login,
        register,
        logout,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
