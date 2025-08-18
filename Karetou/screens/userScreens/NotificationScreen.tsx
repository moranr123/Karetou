import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { db } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { NotificationData } from '../../services/NotificationService';

const { width: screenWidth } = Dimensions.get('window');
 
const NotificationScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);

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

    // Handle navigation based on notification type
    switch (notification.type) {
      case 'new_place':
        // Navigate to home screen to see new places
        (navigation as any).navigate('Main', { screen: 'Home' });
        break;
      case 'new_post':
        // Navigate to feed screen to see new posts
        (navigation as any).navigate('Main', { screen: 'Feed' });
        break;
      case 'business_reply':
      case 'post_comment':
        // Navigate to feed screen to see the post with comments
        (navigation as any).navigate('Main', { screen: 'Feed' });
        break;
      case 'business_approval':
      case 'business_rejection':
        // For business notifications, navigate to business screen if available
        if (notification.data?.businessId) {
          (navigation as any).navigate('MyBusinessScreen');
        }
        break;
      default:
        // Default navigation to home
        (navigation as any).navigate('Main', { screen: 'Home' });
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

  const renderNotification = ({ item }: { item: any }) => {
    const icon = getNotificationIcon(item.type);
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !item.read && styles.unreadCard
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationContent}>
          <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
            <Ionicons name={icon.name as any} size={24} color={icon.color} />
          </View>
          
          <View style={styles.textContainer}>
            <Text style={[styles.notificationTitle, !item.read && styles.unreadTitle]}>
              {item.title}
            </Text>
            <Text style={styles.notificationBody} numberOfLines={2}>
              {item.body}
            </Text>
            <Text style={styles.notificationTime}>
              {formatDate(item.createdAt)}
            </Text>
          </View>
          
          <View style={styles.notificationActions}>
            {!item.read && <View style={styles.unreadDot} />}
            
            <View style={styles.menuContainer}>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowDropdown(showDropdown === item.id ? null : item.id);
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color="#888" />
              </TouchableOpacity>
              
              {showDropdown === item.id && (
                <View style={styles.dropdown}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={(e) => {
                      e.stopPropagation();
                      deleteNotification(item.id);
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#e91e63" />
                    <Text style={[styles.dropdownText, { color: '#e91e63' }]}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={(e) => {
                      e.stopPropagation();
                      setShowDropdown(null);
                    }}
                  >
                    <Ionicons name="close-outline" size={16} color="#888" />
                    <Text style={styles.dropdownText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-outline" size={80} color="#ccc" />
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptySubtitle}>
        You'll see notifications about your business status and other updates here
      </Text>
    </View>
  );

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
          
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilterMenu(!showFilterMenu)}
            >
              <Ionicons name="filter" size={24} color="#fff" />
            </TouchableOpacity>
            
            {showFilterMenu && (
              <View style={styles.filterDropdown}>
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
                  >
                    <Text style={[
                      styles.filterText,
                      filterType === option.value && styles.filterTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                
                {/* Separator */}
                <View style={styles.filterSeparator} />
                
                {/* Delete All Option */}
                <TouchableOpacity
                  style={styles.deleteAllItem}
                  onPress={deleteAllNotifications}
                >
                  <Ionicons name="trash-outline" size={16} color="#e91e63" />
                  <Text style={styles.deleteAllText}>
                    Delete All {filterType !== 'all' ? `(${filteredNotifications.length})` : `(${notifications.length})`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Notifications List */}
        <View style={styles.listContainer}>
          <FlatList
            data={filteredNotifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#667eea"
                colors={['#667eea']}
              />
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
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
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginTop: 10,
  },
  listContent: {
    padding: 20,
    flexGrow: 1,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
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
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  unreadTitle: {
    fontWeight: 'bold',
    color: '#000',
  },
  notificationBody: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
    position: 'absolute',
    top: 5,
    right: 5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 40,
  },
  headerActions: {
    position: 'relative',
  },
  filterButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  filterDropdown: {
    position: 'absolute',
    top: 45,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 150,
    zIndex: 1000,
  },
  filterItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterItemActive: {
    backgroundColor: '#f8f9ff',
  },
  filterText: {
    fontSize: 14,
    color: '#333',
  },
  filterTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  notificationActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuContainer: {
    position: 'relative',
    marginLeft: 8,
  },
  menuButton: {
    padding: 8,
    borderRadius: 20,
  },
  dropdown: {
    position: 'absolute',
    top: 35,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 120,
    zIndex: 1000,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  filterSeparator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  deleteAllItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff5f5',
  },
  deleteAllText: {
    fontSize: 14,
    color: '#e91e63',
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default NotificationScreen; 