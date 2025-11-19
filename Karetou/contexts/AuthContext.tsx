import React, { createContext, useState, useContext, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { Appearance, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService, { NotificationData } from '../services/NotificationService';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

type Theme = 'light' | 'dark';
type UserType = 'user' | 'business' | null;

interface AuthContextType {
  user: User | null;
  userType: UserType;
  lastUserType: UserType;
  loading: boolean;
  theme: Theme;
  notifications: NotificationData[];
  unreadNotificationCount: number;
  modalVisible: boolean;
  modalStatus: 'approved' | 'rejected' | 'pending' | null;
  modalBusinessName: string;
  toggleTheme: () => void;
  setUserType: (type: UserType) => void;
  logout: () => void;
  markNotificationAsRead: (notificationId: string) => void;
  refreshData: () => void;
  closeModal: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userType: null,
  lastUserType: null,
  loading: true,
  theme: 'light',
  notifications: [],
  unreadNotificationCount: 0,
  modalVisible: false,
  modalStatus: null,
  modalBusinessName: '',
  toggleTheme: () => {},
  setUserType: () => {},
  logout: () => {},
  markNotificationAsRead: () => {},
  refreshData: () => {},
  closeModal: () => {},
});

export const useAuth = (): AuthContextType => {
  return useContext(AuthContext);
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<UserType>(null);
  const [lastUserType, setLastUserType] = useState<UserType>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<Theme>(Appearance.getColorScheme() || 'light');
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [dataRefreshTrigger, setDataRefreshTrigger] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalStatus, setModalStatus] = useState<'approved' | 'rejected' | 'pending' | null>(null);
  const [modalBusinessName, setModalBusinessName] = useState('');

  const notificationService = NotificationService.getInstance();

  // Load lastUserType from AsyncStorage on app start
  useEffect(() => {
    const loadLastUserType = async () => {
      try {
        const savedLastUserType = await AsyncStorage.getItem('lastUserType');
        if (savedLastUserType) {
          setLastUserType(savedLastUserType as UserType);
        }
      } catch (error) {
        console.error('Error loading lastUserType:', error);
      }
    };
    loadLastUserType();
  }, []);

  // Save lastUserType to AsyncStorage whenever it changes
  useEffect(() => {
    const saveLastUserType = async () => {
      try {
        if (lastUserType) {
          await AsyncStorage.setItem('lastUserType', lastUserType);
        } else {
          await AsyncStorage.removeItem('lastUserType');
        }
      } catch (error) {
        console.error('Error saving lastUserType:', error);
      }
    };
    saveLastUserType();
  }, [lastUserType]);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  const logout = useCallback(async () => {
    try {
      // Store current user type as last user type before logout
      console.log('🔓 Logging out. Current userType:', userType, 'Setting as lastUserType');
      setLastUserType(userType);
      
      // Update lastLogin (logout time) for users
      if (user?.uid) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
            lastLogin: new Date().toISOString(), // Store logout time
          });
        } catch (updateError) {
          console.error('Error updating user lastLogin on logout:', updateError);
        }
      }
      
      // Clean up notification listeners before logout
      notificationService.cleanup();
      
      await signOut(auth);
      setUser(null);
      setUserType(null);
      setNotifications([]);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [userType, user]);

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markNotificationAsRead(notificationId);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read: true }
            : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  const refreshData = useCallback(() => {
    setDataRefreshTrigger(prev => prev + 1);
  }, []);

  // Calculate unread notification count
  const unreadNotificationCount = useMemo(() => {
    return notifications.filter(notif => !notif.read).length;
  }, [notifications]);

  // Set up notification service when user is authenticated
  useEffect(() => {
    if (user?.uid) {
      console.log('🔔 Setting up notification service for user:', user.uid);

      // Initialize push notifications
      notificationService.initializePushNotifications(user.uid).then(token => {
        if (token) {
          console.log('✅ Push notifications initialized with token:', token);
        }
      });

      // Set up notification listeners
      const unsubscribeNotifications = notificationService.setupNotificationListeners(
        user.uid,
        (newNotification) => {
          console.log('📨 New notification received:', newNotification);
          setNotifications(prev => [newNotification, ...prev]);
        }
      );

      // Set up business status listener (for business users)
      const unsubscribeBusiness = notificationService.setupBusinessStatusListener(
        user.uid,
        (businessData) => {
          console.log('🏢 Business status updated:', businessData);
          // Trigger a data refresh
          setDataRefreshTrigger(prev => prev + 1);
        },
        (status, businessName) => {
          console.log('🎯 Showing modal for status:', status, businessName);
          setModalStatus(status as 'approved' | 'rejected' | 'pending');
          setModalBusinessName(businessName);
          setModalVisible(true);
        }
      );

      // Set up general data listeners for auto-refresh
      const unsubscribeData = notificationService.setupDataListeners(user.uid, {
        onBusinessUpdate: (businesses) => {
          console.log('🔄 Business data updated:', businesses.length, 'businesses');
          setDataRefreshTrigger(prev => prev + 1);
        },
        onPostUpdate: (posts) => {
          console.log('🔄 Posts data updated:', posts.length, 'posts');
          setDataRefreshTrigger(prev => prev + 1);
        },
        onPromotionUpdate: (promotions) => {
          console.log('🔄 Promotions data updated:', promotions.length, 'promotions');
          setDataRefreshTrigger(prev => prev + 1);
        }
      });

      // Cleanup function
      return () => {
        unsubscribeNotifications();
        unsubscribeBusiness();
        unsubscribeData();
      };
    } else {
      // Clean up when user logs out
      notificationService.cleanup();
      setNotifications([]);
    }
  }, [user?.uid]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      // Reset user type when user changes
      setUserType(null);
      
      // Check if user account is active
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const isActive = userData?.isActive !== undefined ? userData.isActive : true;
            
            if (!isActive) {
              console.log('❌ AuthContext - User account is deactivated, signing out');
              await signOut(auth);
              Alert.alert(
                'Account Deactivated',
                'Your account has been deactivated. Please contact support for assistance.'
              );
              setUser(null);
              setUserType(null);
            }
          }
        } catch (error) {
          console.error('Error checking user status:', error);
        }
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo(() => ({
    user,
    userType,
    lastUserType,
    loading,
    theme,
    notifications,
    unreadNotificationCount,
    modalVisible,
    modalStatus,
    modalBusinessName,
    toggleTheme,
    setUserType,
    logout,
    markNotificationAsRead,
    refreshData,
    closeModal: () => {
      setModalVisible(false);
      setModalStatus(null);
      setModalBusinessName('');
    },
  }), [user, userType, lastUserType, loading, theme, notifications, unreadNotificationCount, modalVisible, modalStatus, modalBusinessName, toggleTheme, logout, markNotificationAsRead, refreshData]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 