import React, { useCallback, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAuth } from '../../../contexts/AuthContext';
import BusinessStatusModal from '../../../components/BusinessStatusModal';
import Constants from 'expo-constants';
import LoadingImage from '../../../components/LoadingImage';
import { db } from '../../../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type RootStackParamList = {
  RegisterBusiness: undefined;
  MyPosts: undefined;
  MyBusiness: undefined;
  Promotions: undefined;
  BusinessReviewsScreen: undefined;
};

// --- Component ---
const BusinessHomeScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user, refreshData, unreadNotificationCount, modalVisible, modalStatus, modalBusinessName, closeModal } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Always use light theme for business app
  const lightGradient = ['#667eea', '#764ba2'] as const;

  // Get all businesses owned by the current user
  useEffect(() => {
    if (!user?.uid) return;
    
    const businessQuery = query(
      collection(db, 'businesses'),
      where('userId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(businessQuery, (snapshot) => {
      const businessIds: string[] = [];
      snapshot.forEach(doc => {
        businessIds.push(doc.id);
        console.log('Found business owned by user:', doc.id, doc.data().businessName);
      });
      
      if (businessIds.length > 0) {
        console.log('Total businesses owned by user:', businessIds.length);
        setBusinessId(businessIds[0]); // Set first business ID for compatibility
        // Fetch reviews from ALL businesses
        fetchReviewsFromAllBusinesses(businessIds);
      } else {
        console.log('No businesses found for user:', user.uid);
        setBusinessId(null);
        setRecentReviews([]);
      }
    });
    
    return () => unsubscribe();
  }, [user?.uid]);

  // Function to generate a profile icon for users without uploaded photos
  const generateUserAvatar = (userName: string, userId: string) => {
    // Return null to indicate we should use an icon instead of an image
    return null;
  };

  // Function to fetch reviews from all user's businesses
  const fetchReviewsFromAllBusinesses = (businessIds: string[]) => {
    const unsubscribes: (() => void)[] = [];
    const allReviews: any[] = [];
    
    businessIds.forEach((bizId, index) => {
      console.log(`Setting up listener for business ${index + 1}:`, bizId);
      
      const reviewsRef = collection(db, 'businesses', bizId, 'reviews');
      
      const unsubscribe = onSnapshot(reviewsRef, (snapshot) => {
        console.log(`Business ${bizId} - reviews count:`, snapshot.size);
        
        // Clear previous reviews for this business
        const filteredReviews = allReviews.filter(review => review.businessId !== bizId);
        
        snapshot.forEach(doc => {
          const reviewData = doc.data();
          console.log(`Business ${bizId} - Review:`, doc.id, reviewData);
          
          // Handle different date formats
          let createdAt;
          if (reviewData.createdAt) {
            if (typeof reviewData.createdAt === 'string') {
              createdAt = new Date(reviewData.createdAt);
            } else if (reviewData.createdAt.toDate) {
              createdAt = reviewData.createdAt.toDate();
            } else {
              createdAt = new Date(reviewData.createdAt);
            }
          } else {
            createdAt = new Date();
          }
          
          const now = new Date();
          const diffInHours = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
          const diffInDays = Math.floor(diffInHours / 24);
          
          let timeText;
          if (diffInHours < 1) {
            timeText = 'Just now';
          } else if (diffInHours < 24) {
            timeText = `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
          } else if (diffInDays < 7) {
            timeText = `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
          } else {
            timeText = createdAt.toLocaleDateString();
          }
          
          // Use actual profile image if available, otherwise use icon
          const userAvatar = reviewData.userProfileImage || null;
          
          filteredReviews.push({
            id: doc.id,
            businessId: bizId,
            userName: reviewData.userName || 'Anonymous',
            userImage: userAvatar,
            rating: reviewData.rating || 0,
            comment: reviewData.comment || '',
            time: timeText,
            createdAt: createdAt,
          });
        });
        
        // Update allReviews array
        allReviews.length = 0;
        allReviews.push(...filteredReviews);
        
        // Sort by date (newest first) and limit to 3
        allReviews.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const limitedReviews = allReviews.slice(0, 3);
        
        console.log('Total reviews from all businesses:', allReviews.length);
        console.log('Displaying reviews:', limitedReviews.length);
        setRecentReviews([...limitedReviews]);
      });
      
      unsubscribes.push(unsubscribe);
    });
    
    // Return cleanup function
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  };

  const onRefresh = () => {
    setRefreshing(true);
    refreshData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={16}
          color="#FFD700"
        />
      );
    }
    return stars;
  };

  return (
    <LinearGradient colors={lightGradient} style={{flex: 1}}>
      <View style={styles.container}>
        {/* --- Fixed Header --- */}
        <View style={styles.header}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.headerLogo}
          />
          <View style={styles.headerIcons}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => (navigation as any).navigate('NotificationScreen')}
            >
              <Ionicons name="notifications-outline" size={screenWidth * 0.07} color="#fff" />
              {unreadNotificationCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.badgeText}>
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.iconButton}>
              <LoadingImage
                source={{ uri: 'https://randomuser.me/api/portraits/men/1.jpg' }}
                style={styles.profileIcon}
              />
            </View>
          </View>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#333"
            />
          }
        >
          {/* --- Quick Access --- */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: '#333' }]}>
              Quick Access
            </Text>
            <View style={styles.quickAccessContainer}>
              <TouchableOpacity
                style={styles.quickAccessButton}
                onPress={() => navigation.navigate('RegisterBusiness')}
              >
                <Ionicons name="briefcase-outline" size={screenWidth * 0.08} color="#fff" />
                <Text style={styles.quickAccessText}>Register Business</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAccessButton}
                onPress={() => navigation.navigate('MyPosts')}
              >
                <Ionicons name="newspaper-outline" size={screenWidth * 0.08} color="#fff" />
                <Text style={styles.quickAccessText}>My Posts</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.quickAccessContainer}>
              <TouchableOpacity
                style={styles.quickAccessButton}
                onPress={() => navigation.navigate('MyBusiness')}
              >
                <Ionicons name="storefront-outline" size={screenWidth * 0.08} color="#fff" />
                <Text style={styles.quickAccessText}>My Business</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAccessButton}
                onPress={() => navigation.navigate('Promotions')}
              >
                <Ionicons name="pricetag-outline" size={screenWidth * 0.08} color="#fff" />
                <Text style={styles.quickAccessText}>Promotions</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* --- Recent Reviews --- */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: '#333' }]}>
                Recent Reviews
              </Text>
              <TouchableOpacity 
                style={styles.seeAllButton}
                onPress={() => (navigation as any).navigate('Reviews')}
              >
                <Text style={styles.seeAllText}>See All</Text>
                <Ionicons name="chevron-forward" size={16} color="#333" />
              </TouchableOpacity>
            </View>
            {recentReviews.length > 0 ? (
              recentReviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  {review.userImage ? (
                    <LoadingImage source={{ uri: review.userImage }} style={styles.userImage} />
                  ) : (
                    <View style={styles.userIconContainer}>
                      <Ionicons name="person-circle" size={screenWidth * 0.12} color="#667eea" />
                    </View>
                  )}
                  <View style={styles.reviewContent}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.userName}>{review.userName}</Text>
                      <View style={styles.starContainer}>{renderStars(review.rating)}</View>
                    </View>
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                    <Text style={styles.reviewTime}>{review.time}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.noReviewsContainer}>
                <Ionicons name="chatbubble-outline" size={40} color="rgba(255,255,255,0.5)" />
                <Text style={styles.noReviewsText}>No reviews yet</Text>
                <Text style={styles.noReviewsSubtext}>Reviews from customers will appear here</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
      
      {/* Business Status Modal */}
      <BusinessStatusModal
        visible={modalVisible}
        onClose={closeModal}
        status={modalStatus as 'approved' | 'rejected' | 'pending'}
        businessName={modalBusinessName}
      />
    </LinearGradient>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Constants.statusBarHeight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenWidth * 0.05,
    paddingVertical: screenHeight * 0.015,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    borderLeftColor: '#ccc',
    borderRightColor: '#ccc',
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  headerLogo: {
    width: screenWidth * 0.1,
    height: screenWidth * 0.1,
    resizeMode: 'contain',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: screenWidth * 0.04,
  },
  profileIcon: {
    width: screenWidth * 0.1,
    height: screenWidth * 0.1,
    borderRadius: (screenWidth * 0.1) / 2,
  },
  logoutButton: {
    padding: 5,
  },
  section: {
    paddingHorizontal: screenWidth * 0.05,
    marginTop: screenHeight * 0.03,
    marginBottom: screenHeight * 0.03,
  },
  sectionTitle: {
    fontSize: screenWidth * 0.055,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenWidth * 0.05,
    marginBottom: screenHeight * 0.02,
  },
  quickAccessContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: screenWidth * 0.03,
  },
  quickAccessButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.03,
    width: '48.5%',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  quickAccessText: {
    color: '#fff',
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
    marginTop: screenHeight * 0.01,
    textAlign: 'center',
  },
  reviewCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: screenWidth * 0.04,
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.015,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userImage: {
    width: screenWidth * 0.12,
    height: screenWidth * 0.12,
    borderRadius: (screenWidth * 0.12) / 2,
    marginRight: screenWidth * 0.04,
  },
  reviewContent: {
    flex: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: screenHeight * 0.005,
  },
  userName: {
    fontSize: screenWidth * 0.04,
    fontWeight: 'bold',
    color: '#333',
  },
  starContainer: {
    flexDirection: 'row',
  },
  reviewComment: {
    fontSize: screenWidth * 0.035,
    color: '#555',
    lineHeight: screenHeight * 0.025,
    marginBottom: screenHeight * 0.01,
  },
  reviewTime: {
    fontSize: screenWidth * 0.03,
    color: '#999',
    alignSelf: 'flex-end',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'red',
    borderRadius: 10,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  badgeText: {
    color: 'white',
    fontSize: screenWidth * 0.03,
    fontWeight: 'bold',
  },
  noReviewsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: screenWidth * 0.04,
    padding: screenWidth * 0.08,
    alignItems: 'center',
    marginVertical: screenHeight * 0.02,
  },
  noReviewsText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    marginTop: screenHeight * 0.01,
    textAlign: 'center',
  },
  noReviewsSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: screenWidth * 0.035,
    textAlign: 'center',
    marginTop: screenHeight * 0.005,
  },
  userIconContainer: {
    width: screenWidth * 0.12,
    height: screenWidth * 0.12,
    borderRadius: (screenWidth * 0.12) / 2,
    marginRight: screenWidth * 0.04,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seeAllButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.01,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    color: '#333',
    fontSize: screenWidth * 0.035,
    fontWeight: '600',
    marginRight: screenWidth * 0.01,
  },
});

export default BusinessHomeScreen; 