import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, query, collection, getDocs, where } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface UserRole {
  uid: string;
  email: string;
  role: 'superadmin' | 'admin';
  isActive: boolean;
  createdAt: string;
  createdBy?: string;
  id: string;
}

interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = useCallback(async (uid: string) => {
    try {
      console.log('🔍 Fetching user role for UID:', uid);
      
      // Query adminUsers collection by uid field (not document ID)
      const adminQuery = query(collection(db, 'adminUsers'), where('uid', '==', uid));
      const adminSnapshot = await getDocs(adminQuery);
      
      if (!adminSnapshot.empty) {
        const adminDoc = adminSnapshot.docs[0];
        const data = adminDoc.data();
        console.log('✅ Found admin user document:', data);
        
        // Check if admin is active
        if (!data.isActive) {
          console.log('❌ Admin account is inactive');
          throw new Error('Your admin account has been deactivated. Please contact a superadmin.');
        }
        
        setUserRole({...data, id: adminDoc.id} as UserRole);
        return;
      }

      // Check if it's a superadmin (you can add superadmin UIDs here)
      const superAdminUids = ['6uKpHlHh5Kgi9xLqy4PptW8RD2W2']; // Add actual superadmin UIDs
      console.log('🔍 Checking superadmin UIDs:', superAdminUids);
      console.log('🔍 Current UID:', uid);
      console.log('🔍 Is superadmin?', superAdminUids.includes(uid));
      
      if (superAdminUids.includes(uid)) {
        const superAdminRole = {
          id: uid,
          uid,
          email: user?.email || '',
          role: 'superadmin' as const,
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        console.log('🛡️ Setting superadmin role:', superAdminRole);
        setUserRole(superAdminRole);
        return;
      }

      console.log('❌ User is not a superadmin or admin');
      throw new Error('Access denied. You do not have admin privileges.');
    } catch (error) {
      console.error('❌ Error fetching user role:', error);
      setUserRole(null);
      throw error;
    }
  }, [user?.email]);

  // Set up real-time listener for current admin's status
  useEffect(() => {
    let unsubscribeAdminDoc: (() => void) | null = null;

    if (user && userRole && userRole.role === 'admin' && userRole.id) {
      console.log('👁️ Setting up real-time listener for admin status');
      
      // Listen for changes to the current admin's document using the correct document ID
      unsubscribeAdminDoc = onSnapshot(
        doc(db, 'adminUsers', userRole.id),
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            console.log('📋 Admin document updated:', data);
            
            // If admin was deactivated, sign them out immediately
            if (!data.isActive && userRole.isActive) {
              console.log('🚫 Admin account was deactivated - signing out');
              signOut(auth);
            }
          }
        },
        (error) => {
          console.error('Error listening to admin document:', error);
        }
      );
    }

    return () => {
      if (unsubscribeAdminDoc) {
        unsubscribeAdminDoc();
      }
    };
  }, [user, userRole]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔄 Auth state changed:', user?.uid, user?.email);
      
      if (user) {
        try {
          await fetchUserRole(user.uid);
          setUser(user);
        } catch (error: any) {
          // If user role fetch fails (inactive admin or unauthorized), sign out
          console.log('🚫 Signing out due to role fetch error:', error.message);
          try {
            await signOut(auth);
          } catch (signOutError) {
            console.error('Error signing out:', signOutError);
          }
          setUser(null);
          setUserRole(null);
          // The error will be shown in the login page if this was during login
          // For existing sessions, the user will be redirected to login automatically
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [fetchUserRole]);

  const login = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('🔑 Firebase authentication successful');
      
      // Check user role and active status
      await fetchUserRole(result.user.uid);
      
    } catch (error: any) {
      console.error('❌ Login error:', error);
      // Sign out if there was an error during role verification
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error('Error signing out after failed login:', signOutError);
      }
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUserRole(null);
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    userRole,
    loading,
    login,
    logout,
    isSuperAdmin: userRole?.role === 'superadmin',
    isAdmin: userRole?.role === 'admin' || userRole?.role === 'superadmin',
  };

  // Debug logging
  useEffect(() => {
    if (user) {
      console.log('🔍 Current user UID:', user.uid);
      console.log('🔍 Current user email:', user.email);
      console.log('🔍 Current userRole:', userRole);
    }
  }, [user, userRole]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 