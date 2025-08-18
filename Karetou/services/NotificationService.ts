import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, collection, query, where, orderBy, limit, getDoc, getDocs } from 'firebase/firestore';

// Configure how notifications should be handled when the app is running
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  data?: any;
  type: 'business_approval' | 'business_rejection' | 'new_post' | 'promotion' | 'general' | 'new_review' | 'post_like' | 'post_comment' | 'business_reply' | 'new_place';
  userId: string;
  read: boolean;
  createdAt: string;
}

class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;
  private notificationListeners: (() => void)[] = [];

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Initialize push notifications
  async initializePushNotifications(userId: string): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.log('Must use physical device for Push Notifications');
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });

      this.expoPushToken = token.data;

      // Save the token to Firestore for the user
      await this.saveTokenToFirestore(userId, token.data);

      // Configure notification channels for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });

        await Notifications.setNotificationChannelAsync('business-updates', {
          name: 'Business Updates',
          importance: Notifications.AndroidImportance.HIGH,
          description: 'Notifications about your business status and updates',
          vibrationPattern: [0, 250, 250, 250],
        });

        await Notifications.setNotificationChannelAsync('social-updates', {
          name: 'Social Updates',
          importance: Notifications.AndroidImportance.DEFAULT,
          description: 'New posts, likes, and social interactions',
        });
      }

      return token.data;
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      return null;
    }
  }

  // Save push token to Firestore
  private async saveTokenToFirestore(userId: string, token: string) {
    try {
      await setDoc(doc(db, 'userTokens', userId), {
        pushToken: token,
        updatedAt: new Date().toISOString(),
        platform: Platform.OS,
        deviceId: Constants.deviceId || 'unknown',
      }, { merge: true });
    } catch (error) {
      console.error('Error saving token to Firestore:', error);
    }
  }

  // Send local notification
  async sendLocalNotification(title: string, body: string, data?: any) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null, // Show immediately
    });
  }

  // Set up real-time listeners for notifications
  setupNotificationListeners(
    userId: string,
    onNewNotification?: (notification: NotificationData) => void
  ) {
    // Listen for new notifications for this user (simplified query)
    const notificationsRef = collection(db, 'notifications');
    const notificationQuery = query(
      notificationsRef,
      where('userId', '==', userId),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      notificationQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const notificationData = {
              id: change.doc.id,
              ...change.doc.data()
            } as NotificationData;

            // Only show notification if it's unread
            if (!notificationData.read) {
              // Show local notification
              this.sendLocalNotification(
                notificationData.title,
                notificationData.body,
                notificationData.data
              );

              // Call callback if provided
              if (onNewNotification) {
                onNewNotification(notificationData);
              }
            }
          }
        });
      },
      (error) => {
        console.error('Error listening to notifications:', error);
      }
    );

    this.notificationListeners.push(unsubscribe);
    return unsubscribe;
  }

  // Set up business status listener
  setupBusinessStatusListener(
    userId: string,
    onStatusChange?: (business: any) => void,
    onShowModal?: (status: string, businessName: string) => void
  ) {
    const businessesRef = collection(db, 'businesses');
    const businessQuery = query(
      businessesRef,
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      businessQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'modified') {
            const businessData = {
              id: change.doc.id,
              ...change.doc.data()
            } as any;

            const oldData = change.doc.metadata.fromCache ? null : change.doc.data();
            
            // Check if status changed
            if (oldData && oldData.status !== businessData.status) {
              let title = '';
              let body = '';
              
              switch (businessData.status) {
                case 'approved':
                  title = '🎉 Business Approved!';
                  body = `Your business "${businessData.businessName || 'application'}" has been approved and is now live!`;
                  break;
                case 'rejected':
                  title = '❌ Business Application Rejected';
                  body = `Unfortunately, your business "${businessData.businessName || 'application'}" was not approved. Please contact support for details.`;
                  break;
                case 'pending':
                  title = '⏳ Business Under Review';
                  body = `Your business "${businessData.businessName || 'application'}" is being reviewed by our team.`;
                  break;
              }

              if (title) {
                this.sendLocalNotification(title, body, {
                  type: 'business_status',
                  businessId: businessData.id,
                  status: businessData.status
                });

                // Trigger modal callback if provided
                if (onShowModal) {
                  onShowModal(businessData.status, businessData.businessName || 'Your Business');
                }
              }
            }

            if (onStatusChange) {
              onStatusChange(businessData);
            }
          }
        });
      },
      (error) => {
        console.error('Error listening to business status:', error);
      }
    );

    this.notificationListeners.push(unsubscribe);
    return unsubscribe;
  }

  // Set up general data listeners for auto-refresh
  setupDataListeners(userId: string, callbacks: {
    onBusinessUpdate?: (businesses: any[]) => void;
    onPostUpdate?: (posts: any[]) => void;
    onPromotionUpdate?: (promotions: any[]) => void;
  }) {
    const unsubscribers: (() => void)[] = [];

    // Listen for business updates
    if (callbacks.onBusinessUpdate) {
      const businessQuery = query(
        collection(db, 'businesses'),
        where('userId', '==', userId)
      );

      const businessUnsub = onSnapshot(businessQuery, (snapshot) => {
        const businesses = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callbacks.onBusinessUpdate!(businesses);
      });

      unsubscribers.push(businessUnsub);
    }

    // Listen for posts (if you have a posts collection) - simplified query
    if (callbacks.onPostUpdate) {
      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', '==', userId),
        limit(50)
      );

      const postsUnsub = onSnapshot(postsQuery, (snapshot) => {
        const posts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).sort((a: any, b: any) => {
          // Sort manually in JavaScript instead of using orderBy
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
        callbacks.onPostUpdate!(posts);
      });

      unsubscribers.push(postsUnsub);
    }

    // Listen for promotions - simplified query
    if (callbacks.onPromotionUpdate) {
      const promotionsQuery = query(
        collection(db, 'promotions'),
        where('userId', '==', userId)
      );

      const promotionsUnsub = onSnapshot(promotionsQuery, (snapshot) => {
        const promotions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).sort((a: any, b: any) => {
          // Sort manually in JavaScript instead of using orderBy
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
        callbacks.onPromotionUpdate!(promotions);
      });

      unsubscribers.push(promotionsUnsub);
    }

    // Store all unsubscribers
    this.notificationListeners.push(...unsubscribers);
    
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: string) {
    try {
      await setDoc(doc(db, 'notifications', notificationId), {
        read: true,
        readAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Create a notification in Firestore (for admin to send to users)
  async createNotification(notification: Omit<NotificationData, 'id' | 'createdAt'>) {
    try {
      const notificationRef = doc(collection(db, 'notifications'));
      await setDoc(notificationRef, {
        ...notification,
        createdAt: new Date().toISOString()
      });
      return notificationRef.id;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Clean up all listeners
  cleanup() {
    this.notificationListeners.forEach(unsubscribe => unsubscribe());
    this.notificationListeners = [];
  }

  // Get push token
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  // Send notification to business owner about new review
  async notifyBusinessOwnerOfNewReview(businessId: string, reviewerName: string, rating: number, comment?: string) {
    try {
      // First, get the business to find the owner's userId
      const businessDoc = await getDoc(doc(db, 'businesses', businessId));
      if (!businessDoc.exists()) {
        console.error('Business not found:', businessId);
        return;
      }

      const businessData = businessDoc.data();
      const businessOwnerId = businessData.userId;
      const businessName = businessData.businessName || 'Your Business';

      if (!businessOwnerId) {
        console.error('Business owner ID not found for business:', businessId);
        return;
      }

      // Create the notification
      const title = '⭐ New Review Received!';
      const body = `${reviewerName} left a ${rating}-star review for ${businessName}${comment ? ': "' + comment.substring(0, 50) + (comment.length > 50 ? '..."' : '"') : ''}`;

      await this.createNotification({
        title,
        body,
        type: 'new_review',
        userId: businessOwnerId,
        read: false,
        data: {
          businessId,
          businessName,
          reviewerName,
          rating,
          comment
        }
      });

      console.log('✅ Review notification sent to business owner:', businessOwnerId);
    } catch (error) {
      console.error('Error sending review notification:', error);
    }
  }

  // Send notification when someone likes a post
  async notifyPostLike(postId: string, postOwnerId: string, likerName: string, businessName: string) {
    try {
      // Don't notify if user likes their own post
      if (postOwnerId === likerName) return;

      const title = '❤️ Someone liked your post!';
      const body = `${likerName} liked your post from ${businessName}`;

      await this.createNotification({
        title,
        body,
        type: 'post_like',
        userId: postOwnerId,
        read: false,
        data: {
          postId,
          businessName,
          likerName,
          action: 'like'
        }
      });

      console.log('✅ Like notification sent to post owner:', postOwnerId);
    } catch (error) {
      console.error('Error sending like notification:', error);
    }
  }

  // Send notification when someone comments on a post
  async notifyPostComment(postId: string, postOwnerId: string, commenterName: string, businessName: string, commentText: string) {
    try {
      // Don't notify if user comments on their own post
      if (postOwnerId === commenterName) return;

      const title = '💬 New comment on your post!';
      const body = `${commenterName} commented on your post from ${businessName}: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`;

      await this.createNotification({
        title,
        body,
        type: 'post_comment',
        userId: postOwnerId,
        read: false,
        data: {
          postId,
          businessName,
          commenterName,
          commentText: commentText.substring(0, 100),
          action: 'comment'
        }
      });

      console.log('✅ Comment notification sent to post owner:', postOwnerId);
    } catch (error) {
      console.error('Error sending comment notification:', error);
    }
  }

  // Send notification when business owner replies to a comment on their post
  async notifyBusinessReply(postId: string, originalCommenterId: string, businessName: string, replyText: string) {
    try {
      const title = '🏢 Business owner replied!';
      const body = `${businessName} replied to your comment: "${replyText.substring(0, 50)}${replyText.length > 50 ? '...' : ''}"`;

      await this.createNotification({
        title,
        body,
        type: 'business_reply',
        userId: originalCommenterId,
        read: false,
        data: {
          postId,
          businessName,
          replyText: replyText.substring(0, 100),
          action: 'reply'
        }
      });

      console.log('✅ Business reply notification sent to commenter:', originalCommenterId);
    } catch (error) {
      console.error('Error sending business reply notification:', error);
    }
  }

  // Send notification when a new business/place is approved and registered
  async notifyNewPlace(businessName: string, businessType: string, businessAddress: string) {
    try {
      const title = '🎉 New place registered!';
      const body = `${businessName} (${businessType}) has joined PawSafety in ${businessAddress}`;

      // Get all regular users (not business owners) to notify them
      const usersRef = collection(db, 'users');
      const usersQuery = query(usersRef, where('userType', '!=', 'business'));
      const usersSnapshot = await getDocs(usersQuery);

      const notifications: Promise<string>[] = [];
      usersSnapshot.forEach((userDoc) => {
        notifications.push(this.createNotification({
          title,
          body,
          type: 'new_place',
          userId: userDoc.id,
          read: false,
          data: {
            businessName,
            businessType,
            businessAddress,
            action: 'new_place'
          }
        }));
      });

      await Promise.all(notifications);
      console.log(`✅ New place notifications sent to ${notifications.length} users`);
    } catch (error) {
      console.error('Error sending new place notifications:', error);
    }
  }

  // Send notification when a new post/feed is created
  async notifyNewPost(postId: string, businessName: string, businessType: string, postContent: string, businessOwnerId: string) {
    try {
      const title = '📝 New post from a business!';
      const body = `${businessName} posted: "${postContent.substring(0, 50)}${postContent.length > 50 ? '...' : ''}"`;

      // Get all regular users (not business owners and not the post creator) to notify them
      const usersRef = collection(db, 'users');
      const usersQuery = query(usersRef, where('userType', '!=', 'business'));
      const usersSnapshot = await getDocs(usersQuery);

      const notifications: Promise<string>[] = [];
      usersSnapshot.forEach((userDoc) => {
        // Don't notify the business owner who created the post
        if (userDoc.id !== businessOwnerId) {
          notifications.push(this.createNotification({
            title,
            body,
            type: 'new_post',
            userId: userDoc.id,
            read: false,
            data: {
              postId,
              businessName,
              businessType,
              postContent: postContent.substring(0, 100),
              action: 'new_post'
            }
          }));
        }
      });

      await Promise.all(notifications);
      console.log(`✅ New post notifications sent to ${notifications.length} users`);
    } catch (error) {
      console.error('Error sending new post notifications:', error);
    }
  }
}

export default NotificationService; 