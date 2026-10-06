import React, { createContext, useContext, useState, useEffect } from 'react';
import { Member, ClubNotification } from '../types';
import { liveSync } from '../services/liveSync';

interface RegisterData {
  fullName: string;
  studentId?: string;
  email: string;
  password: string;
  phone?: string;
  faculty: string;
  yearOfStudy: 'Year 1' | 'Year 2' | 'Year 3' | 'Year 4' | 'Postgraduate' | 'Alumni';
  role: 'member' | 'executive' | 'alumni';
  executivePosition?: string;
  bio?: string;
}

interface AuthContextType {
  currentUser: Member | null;
  allMembers: Member[];
  isLoggedIn: boolean;
  authLoading: boolean;
  isFreshDatabase: boolean;
  notifications: ClubNotification[];
  unreadCount: number;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  registerAccount: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  reinitializeDatabase: (withSeed: boolean) => Promise<void>;
  refreshAllData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'gluk_dc_auth_token_v2';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isFreshDatabase, setIsFreshDatabase] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<ClubNotification[]>([]);

  // Fetch notifications for active user
  const fetchNotifications = async (token?: string) => {
    const activeToken = token || localStorage.getItem(TOKEN_KEY);
    if (!activeToken) return;

    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Could not fetch notifications:', err);
    }
  };

  // Fetch all members pool
  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/members');
      if (res.ok) {
        const data = await res.json();
        setAllMembers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Could not fetch members:', err);
    }
  };

  // Check system status (fresh vs populated)
  const checkSystemStatus = async () => {
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const data = await res.json();
        setIsFreshDatabase(data.isFresh);
      }
    } catch (err) {
      console.warn('Could not check system status:', err);
    }
  };

  // Initialize session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      setAuthLoading(true);
      await checkSystemStatus();
      await fetchMembers();

      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });

          if (res.ok) {
            const user = await res.json();
            setCurrentUser(user);
            await fetchNotifications(storedToken);
          } else {
            localStorage.removeItem(TOKEN_KEY);
            setCurrentUser(null);
          }
        } catch (err) {
          console.warn('Error restoring session:', err);
        }
      }
      setAuthLoading(false);
    };

    initializeAuth();
  }, []);

  // Listen to live Server-Sent Events (SSE) across the entire system!
  useEffect(() => {
    const unsubscribe = liveSync.subscribe((event) => {
      // Whenever database updates, live refresh!
      if (
        event.type === 'MEMBER_REGISTERED' ||
        event.type === 'DUES_VERIFIED' ||
        event.type === 'MPESA_SUBMITTED'
      ) {
        fetchMembers();
      }

      if (event.type === 'NOTIFICATION_NEW') {
        const newNotif = event.payload as ClubNotification;
        setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
      }

      if (event.type === 'SYSTEM_REINITIALIZED') {
        checkSystemStatus();
        fetchMembers();
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithCredentials = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    setCurrentUser(data.user);
    setIsFreshDatabase(false);
    await fetchNotifications(data.token);
    await fetchMembers();
  };

  const registerAccount = async (data: RegisterData) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(resData.error || 'Registration failed');
    }

    localStorage.setItem(TOKEN_KEY, resData.token);
    setCurrentUser(resData.user);
    setIsFreshDatabase(false);
    await fetchNotifications(resData.token);
    await fetchMembers();
  };

  const logout = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setCurrentUser(null);
    setNotifications([]);
  };

  // Google sign in simulation/connection for instant sign-in
  const loginWithGoogle = async () => {
    const emailPrompt = window.prompt(
      'Enter your Google account email to sign in to GLUK Debate Club:',
      'juliusgachoki26@gmail.com'
    );
    if (!emailPrompt) return;

    // Check if user exists by email, else register
    const existing = allMembers.find((m) => m.email.toLowerCase() === emailPrompt.toLowerCase());
    if (existing) {
      // Login with default password
      try {
        await loginWithCredentials(existing.email, 'gluk2026');
      } catch (e) {
        // Fallback login
        setCurrentUser(existing);
      }
    } else {
      await registerAccount({
        fullName: emailPrompt.split('@')[0].replace(/[._]/g, ' '),
        email: emailPrompt,
        password: 'GoogleLogin2026!',
        faculty: 'Faculty of Arts and Social Sciences',
        yearOfStudy: 'Year 1',
        role: 'member',
      });
    }
  };

  const markNotificationRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    fetch(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
  };

  const reinitializeDatabase = async (withSeed: boolean) => {
    const res = await fetch('/api/system/reinitialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ withSeed }),
    });
    if (res.ok) {
      logout();
      await checkSystemStatus();
      await fetchMembers();
    }
  };

  const refreshAllData = async () => {
    await fetchMembers();
    await fetchNotifications();
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allMembers,
        isLoggedIn: Boolean(currentUser),
        authLoading,
        isFreshDatabase,
        notifications,
        unreadCount,
        loginWithCredentials,
        registerAccount,
        logout,
        loginWithGoogle,
        markNotificationRead,
        reinitializeDatabase,
        refreshAllData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
