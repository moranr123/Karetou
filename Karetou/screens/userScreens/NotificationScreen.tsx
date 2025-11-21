import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { db } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { NotificationData } from '../../services/NotificationService';
import { useResponsive } from '../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../components';

const NotificationScreen = () => {
  const navigation = useNavigation();
  const { user, userType, theme } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius: borderRadiusValues, dimensions, responsiveHeight, responsiveWidth } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);

  // Calculate responsive values
  const isSmallScreen = (dimensions?.width || 360) < 360;
  const isSmallDevice = dimensions?.isSmallDevice || false;
  const minTouchTarget = 44;
  
  // Calculate header padding
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const headerPaddingTop = Platform.OS === 'ios' 
    ? (spacing?.md || 12) + (isSmallDevice ? (spacing?.xs || 4) : (spacing?.sm || 8))
    : statusBarHeight + (spacing?.sm || 8);

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  // Set up real-time notifications listener
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    console.log('🔔 Setting up notifications listener for user:', user.uid);

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notificationsData: NotificationData[] = [];
        snapshot.forEach(doc => {
          notificationsData.push({ id: doc.id, ...doc.data() } as NotificationData);
        });
        
        console.log('📨 Loaded notifications:', notificationsData.length);
        setNotifications(notificationsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading notifications:', error);
        setLoading(false);
      }
    );

    return () => {
      console.log('🧹 Cleaning up notifications listener');
      unsubscribe();
    };
  }, [user?.uid]);

  const onRefresh = () => {
    setRefreshing(true);
    // The real-time listener will automatically refresh data
    setTimeout(() => setRefreshing(false), 1000);
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        readAt: new Date().toISOString()
      });
      
      // Update local state immediately for UI responsiveness
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
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
      
      // Update local state immediately
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
      setShowDropdown(null);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const deleteAllNotifications = async () => {
    const notificationsToDelete = filteredNotifications;
    
    if (notificationsToDelete.length === 0) {
      Alert.alert('No Notifications', 'There are no notifications to delete.');
      return;
    }

    const filterLabel = getFilterOptions().find(opt => opt.value === filterType)?.label || 'All';
    const message = filterType === 'all' 
      ? `Are you sure you want to delete all ${notificationsToDelete.length} notifications? This action cannot be undone.`
      : `Are you sure you want to delete all ${notificationsToDelete.length} "${filterLabel}" notifications? This action cannot be undone.`;

    Alert.alert(
      'Delete All Notifications',
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              setShowFilterMenu(false);
              
              // Delete from Firestore
              const deletePromises = notificationsToDelete.map(notification =>
                deleteDoc(doc(db, 'notifications', notification.id))
              );
              
              await Promise.all(deletePromises);
              
              // Update local state immediately
              const deletedIds = new Set(notificationsToDelete.map(n => n.id));
              setNotifications(prev => prev.filter(notif => !deletedIds.has(notif.id)));
              
              Alert.alert('Success', `Deleted ${notificationsToDelete.length} notifications.`);
            } catch (error) {
              console.error('Error deleting notifications:', error);
              Alert.alert('Error', 'Failed to delete some notifications. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleNotificationPress = (notification: any) => {
    // Close any open dropdown
    setShowDropdown(null);
    
    // Mark as read
    if (!notification.read) {
      markNotificationAsRead(notification.id);
    }

    // Debug logging
    console.log('🔔 Notification clicked:', {
      type: notification.type,
      userType: userType,
      notificationData: notification.data,
      notificationTitle: notification.title,
      notificationBody: notification.body
    });

    // Determine the correct main navigator name based on user type
    const mainNavigatorName = userType === 'business' ? 'BusinessMain' : 'Main';
    console.log('🧭 Main navigator name:', mainNavigatorName);

    // Handle navigation based on notification type
    switch (notification.type) {
      case 'new_place':
        // Navigate to home screen to see new places
        if (userType === 'business') {
          // Business users can see new places on their home screen
          (navigation as any).navigate(mainNavigatorName, { screen: 'Home' });
        } else {
          // Regular users navigate to home to see new places
          (navigation as any).navigate(mainNavigatorName, { screen: 'Home' });
        }
        break;
        
      case 'new_post':
        // Navigate to see new posts
        if (userType === 'business') {
          // Business users can view posts on their home screen or navigate to create post screen to see feed-like content
          (navigation as any).navigate(mainNavigatorName, { screen: 'Home' });
        } else {
          // Regular users navigate to Feed screen to see posts
          (navigation as any).navigate(mainNavigatorName, { screen: 'Feed' });
        }
        break;
        
      case 'business_reply':
      case 'post_comment':
        // Navigate to see post with comments
        console.log('🔔 Navigating for business_reply/post_comment notification');
        if (userType === 'business') {
          console.log('🧭 Business user - navigating to MyPosts screen to see commented post');
          (navigation as any).navigate('MyPosts');
        } else {
          console.log('🧭 Regular user - navigating to Feed to see post with comments');
          (navigation as any).navigate(mainNavigatorName, { screen: 'Feed' });
        }
        break;
        
      case 'new_review':
        // Navigate to reviews section
        console.log('🔔 Navigating for new_review notification');
        if (userType === 'business') {
          console.log('🧭 Business user - navigating to Reviews tab');
          (navigation as any).navigate(mainNavigatorName, { screen: 'Reviews' });
        } else {
          console.log('🧭 Regular user - navigating to Home');
          (navigation as any).navigate(mainNavigatorName, { screen: 'Home' });
        }
        break;
        
      case 'business_approval':
        // Business was approved - navigate to business management
        console.log('🔔 Navigating for business_approval notification');
        if (userType === 'business') {
          console.log('🧭 Business user - navigating to MyBusiness screen (stack screen)');
          (navigation as any).navigate('MyBusiness');
        } else {
          console.log('🧭 Regular user - navigating to Home');
          (navigation as any).navigate(mainNavigatorName, { screen: 'Home' });
        }
        break;
        
      case 'business_rejection':
        // Business was rejected - navigate to business management or settings
        console.log('🔔 Navigating for business_rejection notification');
        if (userType === 'business') {
          console.log('🧭 Business user - navigating to MyBusiness screen (stack screen)');
          (navigation as any).navigate('MyBusiness');
        } else {
          console.log('🧭 Regular user - navigating to Home');
          (navigation as any).navigate(mainNavigatorName, { screen: 'Home' });
        }
        break;
        
      case 'promotion':
        // Navigate to promotions
        console.log('🔔 Navigating for promotion notification');
        if (userType === 'business') {
          console.log('🧭 Business user - navigating to Promotions screen (stack screen)');
          (navigation as any).navigate('Promotions');
        } else {
          console.log('🧭 Regular user - navigating to Home');
          (navigation as any).navigate(mainNavigatorName, { screen: 'Home' });
        }
        break;
        
      case 'post_like':
        // Someone liked a business post
        console.log('🔔 Navigating for post_like notification');
        if (userType === 'business') {
          console.log('🧭 Business user - navigating to MyPosts screen (stack screen)');
          (navigation as any).navigate('MyPosts');
        } else {
          console.log('🧭 Regular user - navigating to Feed');
          (navigation as any).navigate(mainNavigatorName, { screen: 'Feed' });
        }
        break;
        
      default:
        // Default navigation based on user type
        console.log('🔔 Default navigation case triggered for notification type:', notification.type);
        if (userType === 'business') {
          console.log('🧭 Business user - default navigation to Home');
          (navigation as any).navigate(mainNavigatorName, { screen: 'Home' });
        } else {
          console.log('🧭 Regular user - default navigation to Home');
          (navigation as any).navigate(mainNavigatorName, { screen: 'Home' });
        }
        break;
    }
  };

  // Filter notifications based on selected type
  const filteredNotifications = notifications.filter(notification => {
    if (filterType === 'all') return true;
    if (filterType === 'unread') return !notification.read;
    return notification.type === filterType;
  });

  const getFilterOptions = () => [
    { label: 'All', value: 'all' },
    { label: 'Unread', value: 'unread' },
    { label: 'New Places', value: 'new_place' },
    { label: 'New Posts', value: 'new_post' },
    { label: 'Comments', value: 'post_comment' },
    { label: 'Business Replies', value: 'business_reply' },
    { label: 'Business Updates', value: 'business_approval' },
    { label: 'Likes', value: 'post_like' },
  ];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'business_approval':
        return { name: 'checkmark-circle', color: '#4CAF50' };
      case 'business_rejection':
        return { name: 'close-circle', color: '#F44336' };
      case 'new_post':
        return { name: 'newspaper', color: '#2196F3' };
      case 'new_place':
        return { name: 'location', color: '#9C27B0' };
      case 'business_reply':
        return { name: 'business', color: '#FF5722' };
      case 'promotion':
        return { name: 'pricetag', color: '#FF9800' };
      case 'new_review':
        return { name: 'star', color: '#FFD700' };
      case 'post_like':
        return { name: 'heart', color: '#e91e63' };
      case 'post_comment':
        return { name: 'chatbubble', color: '#667eea' };
      default:
        return { name: 'notifications', color: '#667eea' };
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recent';
    }
  };

  // Create responsive styles using useMemo
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      paddingTop: headerPaddingTop,
      paddingBottom: spacing?.sm || 8,
      backgroundColor: theme === 'light' ? '#F5F5F5' : '#232526',
      borderBottomWidth: 1,
      borderBottomColor: theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
    },
    backButton: {
      padding: spacing?.xs || 4,
      backgroundColor: theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
      borderRadius: borderRadiusValues?.lg || 20,
      minWidth: minTouchTarget,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: fontSizes?.xl || 22,
      fontWeight: 'bold',
      color: theme === 'light' ? '#000' : '#fff',
      flex: 1,
      textAlign: 'center',
    },
    headerActions: {
      position: 'relative',
      minWidth: minTouchTarget,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterButton: {
      padding: spacing?.xs || 4,
      backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
      borderRadius: borderRadiusValues?.lg || 20,
      minWidth: minTouchTarget,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterDropdown: {
      position: 'absolute',
      top: minTouchTarget + (spacing?.xs || 4),
      right: 0,
      backgroundColor: theme === 'light' ? '#fff' : '#333',
      borderRadius: borderRadiusValues?.md || 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
      minWidth: responsiveWidth(40) || 150,
      maxWidth: responsiveWidth(80) || 250,
      zIndex: 1000,
    },
    filterItem: {
      paddingHorizontal: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      paddingVertical: spacing?.sm || 8,
      borderBottomWidth: 1,
      borderBottomColor: theme === 'light' ? '#f0f0f0' : '#444',
      minHeight: minTouchTarget,
      justifyContent: 'center',
    },
    filterItemActive: {
      backgroundColor: theme === 'light' ? '#f8f9ff' : '#444',
    },
    filterText: {
      fontSize: fontSizes?.sm || 14,
      color: theme === 'light' ? '#333' : '#fff',
    },
    filterTextActive: {
      color: '#667eea',
      fontWeight: '600',
    },
    filterSeparator: {
      height: 1,
      backgroundColor: theme === 'light' ? '#e0e0e0' : '#555',
      marginVertical: spacing?.xs || 4,
    },
    deleteAllItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      paddingVertical: spacing?.sm || 8,
      backgroundColor: theme === 'light' ? '#fff5f5' : '#4a1f1f',
      minHeight: minTouchTarget,
      justifyContent: 'center',
    },
    deleteAllText: {
      fontSize: fontSizes?.sm || 14,
      color: '#e91e63',
      fontWeight: '600',
      marginLeft: spacing?.xs || 4,
    },
    listContainer: {
      flex: 1,
      backgroundColor: theme === 'light' ? '#f5f5f5' : '#1a1a1a',
      borderTopLeftRadius: borderRadiusValues?.xl || 25,
      borderTopRightRadius: borderRadiusValues?.xl || 25,
      marginTop: spacing?.xs || 4,
    },
    listContent: {
      padding: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      paddingBottom: spacing?.xl || 24,
      flexGrow: 1,
    },
    notificationCard: {
      backgroundColor: theme === 'light' ? '#fff' : '#2a2a2a',
      borderRadius: borderRadiusValues?.md || 15,
      padding: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      marginBottom: spacing?.sm || 8,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    unreadCard: {
      borderLeftWidth: 4,
      borderLeftColor: '#667eea',
    },
    notificationContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    iconContainer: {
      width: responsiveWidth(12) || 50,
      height: responsiveWidth(12) || 50,
      minWidth: 40,
      minHeight: 40,
      maxWidth: 60,
      maxHeight: 60,
      borderRadius: (responsiveWidth(12) || 50) / 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing?.sm || 8,
    },
    textContainer: {
      flex: 1,
      minWidth: 0, // Prevents flex overflow
    },
    notificationTitle: {
      fontSize: fontSizes?.md || 16,
      fontWeight: '600',
      color: theme === 'light' ? '#333' : '#fff',
      marginBottom: spacing?.xs || 4,
    },
    unreadTitle: {
      fontWeight: 'bold',
      color: theme === 'light' ? '#000' : '#fff',
    },
    notificationBody: {
      fontSize: fontSizes?.sm || 14,
      color: theme === 'light' ? '#666' : '#ccc',
      lineHeight: (fontSizes?.sm || 14) * 1.4,
      marginBottom: spacing?.xs || 4,
    },
    notificationTime: {
      fontSize: fontSizes?.xs || 12,
      color: theme === 'light' ? '#999' : '#888',
    },
    notificationActions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: spacing?.xs || 4,
    },
    menuContainer: {
      position: 'relative',
      marginLeft: spacing?.xs || 4,
    },
    menuButton: {
      padding: spacing?.xs || 4,
      borderRadius: borderRadiusValues?.lg || 20,
      minWidth: minTouchTarget,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dropdown: {
      position: 'absolute',
      top: minTouchTarget + (spacing?.xs || 4),
      right: 0,
      backgroundColor: theme === 'light' ? '#fff' : '#333',
      borderRadius: borderRadiusValues?.sm || 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
      minWidth: responsiveWidth(30) || 120,
      zIndex: 1000,
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      paddingVertical: spacing?.sm || 8,
      borderBottomWidth: 1,
      borderBottomColor: theme === 'light' ? '#f0f0f0' : '#444',
      minHeight: minTouchTarget,
      justifyContent: 'center',
    },
    dropdownText: {
      fontSize: fontSizes?.sm || 14,
      color: theme === 'light' ? '#333' : '#fff',
      marginLeft: spacing?.xs || 4,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: responsiveHeight(10) || 60,
      paddingHorizontal: spacing?.md || 12,
    },
    emptyTitle: {
      fontSize: fontSizes?.xl || 24,
      fontWeight: 'bold',
      color: theme === 'light' ? '#333' : '#fff',
      marginTop: spacing?.md || 12,
      marginBottom: spacing?.sm || 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: fontSizes?.md || 16,
      color: theme === 'light' ? '#666' : '#ccc',
      textAlign: 'center',
      lineHeight: (fontSizes?.md || 16) * 1.5,
      paddingHorizontal: spacing?.md || 12,
    },
  }), [spacing, fontSizes, iconSizes, borderRadiusValues, dimensions, isSmallScreen, isSmallDevice, minTouchTarget, headerPaddingTop, responsiveHeight, responsiveWidth, theme]);

  const renderNotification = ({ item }: { item: any }) => {
    const icon = getNotificationIcon(item.type);
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !item.read && styles.unreadCard
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <ResponsiveView style={styles.notificationContent}>
          <ResponsiveView style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
            <Ionicons 
              name={icon.name as any} 
              size={iconSizes?.md || 24} 
              color={icon.color} 
            />
          </ResponsiveView>
          
          <ResponsiveView style={styles.textContainer}>
            <ResponsiveText 
              size="md" 
              weight={!item.read ? 'bold' : '600'} 
              color={theme === 'light' ? (!item.read ? '#000' : '#333') : '#fff'}
              style={styles.notificationTitle}
            >
              {item.title}
            </ResponsiveText>
            <ResponsiveText 
              size="sm" 
              color={theme === 'light' ? '#666' : '#ccc'}
              style={styles.notificationBody}
              numberOfLines={2}
            >
              {item.body}
            </ResponsiveText>
            <ResponsiveText 
              size="xs" 
              color={theme === 'light' ? '#999' : '#888'}
              style={styles.notificationTime}
            >
              {formatDate(item.createdAt)}
            </ResponsiveText>
          </ResponsiveView>
          
          <ResponsiveView style={styles.notificationActions}>
            {!item.read && (
              <ResponsiveView style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#667eea',
                position: 'absolute',
                top: 5,
                right: 5,
              }} />
            )}
            
            <ResponsiveView style={styles.menuContainer}>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowDropdown(showDropdown === item.id ? null : item.id);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="ellipsis-horizontal" size={iconSizes?.sm || 20} color={theme === 'light' ? '#888' : '#aaa'} />
              </TouchableOpacity>
              
              {showDropdown === item.id && (
                <ResponsiveView style={styles.dropdown}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={(e) => {
                      e.stopPropagation();
                      deleteNotification(item.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={iconSizes?.xs || 16} color="#e91e63" />
                    <ResponsiveText size="sm" color="#e91e63" style={styles.dropdownText}>
                      Delete
                    </ResponsiveText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={(e) => {
                      e.stopPropagation();
                      setShowDropdown(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-outline" size={iconSizes?.xs || 16} color={theme === 'light' ? '#888' : '#aaa'} />
                    <ResponsiveText size="sm" color={theme === 'light' ? '#333' : '#fff'} style={styles.dropdownText}>
                      Cancel
                    </ResponsiveText>
                  </TouchableOpacity>
                </ResponsiveView>
              )}
            </ResponsiveView>
          </ResponsiveView>
        </ResponsiveView>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <ResponsiveView style={styles.emptyContainer}>
      <Ionicons 
        name="notifications-outline" 
        size={iconSizes?.xxxxl || 80} 
        color={theme === 'light' ? '#ccc' : '#555'} 
      />
      <ResponsiveText size="xl" weight="bold" color={theme === 'light' ? '#333' : '#fff'} style={styles.emptyTitle}>
        No Notifications
      </ResponsiveText>
      <ResponsiveText 
        size="md" 
        color={theme === 'light' ? '#666' : '#ccc'}
        style={styles.emptySubtitle}
      >
        You'll see notifications about your business status and other updates here
      </ResponsiveText>
    </ResponsiveView>
  );

  return (
    <LinearGradient 
      colors={theme === 'light' ? lightGradient : darkGradient} 
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <ResponsiveView style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={iconSizes?.md || 24} color={theme === 'light' ? '#000' : '#fff'} />
          </TouchableOpacity>
          <ResponsiveText size="xl" weight="bold" color={theme === 'light' ? '#000' : '#fff'} style={styles.title}>
            Notifications
          </ResponsiveText>
          
          <ResponsiveView style={styles.headerActions}>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilterMenu(!showFilterMenu)}
              activeOpacity={0.7}
            >
              <Ionicons name="filter" size={iconSizes?.md || 24} color={theme === 'light' ? '#000' : '#fff'} />
            </TouchableOpacity>
            
            {showFilterMenu && (
              <ResponsiveView style={styles.filterDropdown}>
                {getFilterOptions().map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.filterItem,
                      filterType === option.value && styles.filterItemActive
                    ]}
                    onPress={() => {
                      setFilterType(option.value);
                      setShowFilterMenu(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <ResponsiveText 
                      size="sm" 
                      weight={filterType === option.value ? '600' : 'normal'}
                      color={filterType === option.value ? '#667eea' : (theme === 'light' ? '#333' : '#fff')}
                      style={styles.filterText}
                    >
                      {option.label}
                    </ResponsiveText>
                  </TouchableOpacity>
                ))}
                
                {/* Separator */}
                <ResponsiveView style={styles.filterSeparator} />
                
                {/* Delete All Option */}
                <TouchableOpacity
                  style={styles.deleteAllItem}
                  onPress={deleteAllNotifications}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={iconSizes?.xs || 16} color="#e91e63" />
                  <ResponsiveText size="sm" weight="600" color="#e91e63" style={styles.deleteAllText}>
                    Delete All {filterType !== 'all' ? `(${filteredNotifications.length})` : `(${notifications.length})`}
                  </ResponsiveText>
                </TouchableOpacity>
              </ResponsiveView>
            )}
          </ResponsiveView>
        </ResponsiveView>

        {/* Notifications List */}
        <ResponsiveView style={styles.listContainer}>
          <FlatList
            data={filteredNotifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme === 'light' ? '#667eea' : '#fff'}
                colors={['#667eea']}
              />
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </ResponsiveView>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default NotificationScreen;
