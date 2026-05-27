import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
  phone_number?: string | null;
}

export interface UserGroup {
  id: number;
  title: string;
}

export interface Session {
  user: {
    id: string;
    email: string;
  };
  expires_at: number;
}

// Auth functions
export async function getCurrentSession(): Promise<{ session: Session | null; error: any }> {
  try {
    const storedSession = localStorage.getItem('session');
    if (!storedSession) {
      return { session: null, error: null };
    }

    const session = JSON.parse(storedSession);
    if (session.expires_at < Date.now()) {
      localStorage.removeItem('session');
      return { session: null, error: null };
    }

    return { session, error: null };
  } catch (error) {
    console.error('Error getting current session:', error);
    return { session: null, error };
  }
}

export async function signIn(email: string, password: string) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    console.log('Attempting sign in for:', normalizedEmail);

    // Query user from public.users table
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, password, name, group_id')
      .eq('email', normalizedEmail);

    if (userError) {
      console.error('Error fetching user:', userError);
      return { data: null, error: new Error('Database error while fetching user') };
    }

    if (!users || users.length === 0) {
      console.log('No user found with email:', normalizedEmail);
      return { data: null, error: new Error('User not found') };
    }

    const user = users[0];
    console.log('Found user:', user.email);

    // Compare password using bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log('Password mismatch for user:', normalizedEmail);
      return { data: null, error: new Error('Invalid password') };
    }

    console.log('Password verified for user:', normalizedEmail);

    // Create session
    const session: Session = {
      user: {
        id: user.id,
        email: user.email
      },
      expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
    };

    // Fetch user profile
    let profile = null;
    let group = null;

    try {
      // Fetch user profile
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id);

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else {
        profile = profiles && profiles.length > 0 ? profiles[0] : null;
        console.log('Profile found:', profile ? 'yes' : 'no');
      }

      // Fetch user group
      if (user.group_id) {
        const { data: groups, error: groupError } = await supabase
          .from('owc_usergroups')
          .select('*')
          .eq('id', user.group_id);

        if (groupError) {
          console.error('Error fetching group:', groupError);
        } else {
          group = groups && groups.length > 0 ? groups[0] : null;
          console.log('Group found:', group ? group.title : 'no');
        }
      }
    } catch (err) {
      console.error('Error fetching profile or group details:', err);
      // Continue with sign-in even if profile/group fetch fails
    }

    // Store session in localStorage
    localStorage.setItem('session', JSON.stringify(session));

    return {
      data: {
        session,
        profile,
        group
      },
      error: null
    };
  } catch (error) {
    console.error('Sign in error:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('An unexpected error occurred')
    };
  }
}

export async function signOut() {
  try {
    localStorage.removeItem('session');
    localStorage.removeItem('userData');
    return { error: null };
  } catch (error) {
    console.error('Error signing out:', error);
    return { error };
  }
}

// Helper function to check Supabase connectivity
export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('form1112master').select('count').limit(1);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Supabase connection check failed:', error);
    return false;
  }
};
