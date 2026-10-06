import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  onAuthStateChanged,
  FirebaseUser,
} from '../lib/firebase';
import { Member } from '../types';
import { storage } from '../services/storage';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  currentUser: Member;
  allMembers: Member[];
  isLoggedInWithGoogle: boolean;
  authLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  logoutGoogle: () => Promise<void>;
  switchUserPersona: (member: Member) => void;
  updateMemberProfile: (member: Member) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>(() => storage.getMembers());
  const [currentUserId, setCurrentUserId] = useState<string>(() => storage.getCurrentUserId());
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Sync members changes with storage
  useEffect(() => {
    storage.saveMembers(allMembers);
  }, [allMembers]);

  useEffect(() => {
    storage.saveCurrentUserId(currentUserId);
  }, [currentUserId]);

  // Listen to real Firebase Google auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);

      if (user && user.email) {
        // Find existing member by email
        const existing = allMembers.find(
          (m) => m.email.toLowerCase() === user.email?.toLowerCase()
        );

        if (existing) {
          setCurrentUserId(existing.id);
        } else {
          // Auto-provision student profile for newly signed-in Google account
          const newMember: Member = {
            id: `mem-google-${user.uid.slice(0, 8)}`,
            fullName: user.displayName || 'GLUK Debater',
            studentId: `GLUK/ST/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`,
            email: user.email,
            phone: user.phoneNumber || '+254 700 000 000',
            role: 'member',
            yearOfStudy: 'Year 1',
            faculty: 'General Studies & Civic Engagement',
            membershipStatus: 'Pending',
            duesAmountKes: 500,
            joinedDate: new Date().toISOString().split('T')[0],
            attendanceRate: 100,
            debatesAttendedCount: 1,
            totalDebatesCount: 1,
            speakerPointsAvg: 75.0,
            bio: 'New GLUK Debate Club member signed in via Google Account.',
          };

          setAllMembers((prev) => [newMember, ...prev]);
          setCurrentUserId(newMember.id);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      setAuthLoading(true);
      await signInWithGoogle();
    } catch (err) {
      console.error('Google Sign-in failed:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const logoutGoogle = async () => {
    try {
      await signOutUser();
      setFirebaseUser(null);
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  const switchUserPersona = (member: Member) => {
    setCurrentUserId(member.id);
  };

  const updateMemberProfile = (updated: Member) => {
    setAllMembers((prev) =>
      prev.map((m) => (m.id === updated.id ? updated : m))
    );
  };

  const currentUser =
    allMembers.find((m) => m.id === currentUserId) || allMembers[0];

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        currentUser,
        allMembers,
        isLoggedInWithGoogle: Boolean(firebaseUser),
        authLoading,
        loginWithGoogle,
        logoutGoogle,
        switchUserPersona,
        updateMemberProfile,
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
