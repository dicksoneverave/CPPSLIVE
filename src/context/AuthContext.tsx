import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, UserProfile, UserGroup, signIn as supabaseSignIn, signOut as supabaseSignOut, getCurrentSession } from '../services/supabase';

interface AuthContextType {
  session: Session | null;
  profile: UserProfile | null;
  group: UserGroup | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any | null, data?: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [group, setGroup] = useState<UserGroup | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { session: currentSession, error } = await getCurrentSession();
        
        if (currentSession && !error) {
          setSession(currentSession);
          // Profile and group data will be restored from localStorage if needed
          const storedData = localStorage.getItem('userData');
          if (storedData) {
            const { profile: storedProfile, group: storedGroup } = JSON.parse(storedData);
            setProfile(storedProfile);
            setGroup(storedGroup);
          }
        } else {
          setSession(null);
          setProfile(null);
          setGroup(null);
          localStorage.removeItem('userData');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setSession(null);
        setProfile(null);
        setGroup(null);
        localStorage.removeItem('userData');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabaseSignIn(email, password);
      
      if (error) {
        console.error('Sign in error:', error);
        return { error };
      }

      if (data) {
        setSession(data.session);
        setProfile(data.profile);
        setGroup(data.group);
        
        // Store profile and group data
        localStorage.setItem('userData', JSON.stringify({
          profile: data.profile,
          group: data.group
        }));
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error signing in:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabaseSignOut();
      setSession(null);
      setProfile(null);
      setGroup(null);
      localStorage.removeItem('userData');
      localStorage.removeItem('session');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    session,
    profile,
    group,
    loading,
    signIn,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
