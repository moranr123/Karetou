import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, query, collection, getDocs, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { logActivity } from '../utils/activityLogger';
import { logAdminAction } from '../utils/logAdminAction';

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
      const adminQuery = query(collection(db, 'adminUsers'), where('uid', '==', uid));
      const adminSnapshot = await getDocs(adminQuery);
      
      if (!adminSnapshot.empty) {
        const adminDoc = adminSnapshot.docs[0];
        const data = adminDoc.data();
        
        if (!data.isActive) {
          throw new Error('Your admin account has been deactivated. Please contact a superadmin.');
        }
        
        setUserRole({...data, id: adminDoc.id} as UserRole);
        return;
      }

      const superAdminUidsEnv = process.env.REACT_APP_SUPERADMIN_UIDS;
      const superAdminUids = superAdminUidsEnv ? superAdminUidsEnv.split(',').map(u => u.trim()) : [];
      
      if (superAdminUids.includes(uid)) {
        const superAdminRole = {
          id: uid,
          uid,
          email: user?.email || '',
          role: 'superadmin' as const,
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        setUserRole(superAdminRole);
        return;
      }

      throw new Error('Access denied. You do not have admin privileges.');
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole(null);
      throw error;
    }
  }, [user?.email]);

  useEffect(() => {
    let unsubscribeAdminDoc: (() => void) | null = null;

    if (user && userRole && userRole.role === 'admin' && userRole.id) {
      unsubscribeAdminDoc = onSnapshot(
        doc(db, 'adminUsers', userRole.id),
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            
            if (!data.isActive && userRole.isActive) {
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
      if (user) {
        try {
          await fetchUserRole(user.uid);
          setUser(user);
        } catch (error: any) {
          try {
            await signOut(auth);
          } catch (signOutError) {
            console.error('Error signing out:', signOutError);
          }
          setUser(null);
          setUserRole(null);
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
      await fetchUserRole(result.user.uid);
      
      // Log login activity (only for admins/superadmins)
      try {
        const superAdminUidsEnv = process.env.REACT_APP_SUPERADMIN_UIDS;
        const superAdminUids = superAdminUidsEnv ? superAdminUidsEnv.split(',').map(u => u.trim()) : [];
        const isSuperAdmin = superAdminUids.includes(result.user.uid);
        
        // Check if user is admin (either superadmin or regular admin)
        let userRoleForLog: 'superadmin' | 'admin' | null = null;
        if (isSuperAdmin) {
          userRoleForLog = 'superadmin';
        } else {
          const adminQuery = query(collection(db, 'adminUsers'), where('uid', '==', result.user.uid));
          const adminSnapshot = await getDocs(adminQuery);
          if (!adminSnapshot.empty) {
            userRoleForLog = 'admin';
          }
        }
        
        // Only log if user is an admin
        if (userRoleForLog) {
          await logActivity({
            type: 'login',
            title: 'Admin Login',
            description: `${isSuperAdmin ? 'Super admin' : 'Admin'} logged in`,
            performedBy: {
              uid: result.user.uid,
              email: result.user.email || email,
              role: userRoleForLog,
            },
          });

          // Log to history log for regular admins
          if (userRoleForLog === 'admin') {
            await logAdminAction({
              action: 'Logged In',
              actionType: 'login',
              targetType: 'admin',
              targetName: result.user.email || email,
              targetId: result.user.uid,
              adminEmail: result.user.email || email,
              adminId: result.user.uid,
              details: 'You logged into the admin panel',
            });
          }
        }
      } catch (logError) {
        // Don't fail login if activity logging fails
        console.error('Error logging login activity:', logError);
      }
    } catch (error: any) {
      console.error('Login error:', error);
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
      // Log logout activity before signing out
      if (user && userRole) {
        await logActivity({
          type: 'logout',
          title: 'Admin Logout',
          description: `${userRole.role === 'superadmin' ? 'Super admin' : 'Admin'} logged out`,
          performedBy: {
            uid: user.uid,
            email: user.email || '',
            role: userRole.role,
          },
        });

        // Log to history log for regular admins
        if (userRole.role === 'admin') {
          try {
            await logAdminAction({
              action: 'Logged Out',
              actionType: 'logout',
              targetType: 'admin',
              targetName: user.email || '',
              targetId: user.uid,
              adminEmail: user.email || '',
              adminId: user.uid,
              details: 'You logged out of the admin panel',
            });
          } catch (logError) {
            // Don't fail logout if logging fails
            console.error('Error logging logout action:', logError);
          }
        }
      }
      
      await signOut(auth);
      setUser(null);
      setUserRole(null);
    } catch (error) {
      console.error('Error logging out:', error);
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

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 