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
  SafeAreaView,
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
import { useResponsive } from '../../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../../components';

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
  const { user, theme, refreshData, unreadNotificationCount, modalVisible, modalStatus, modalBusinessName, closeModal } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius, getResponsiveWidth, getResponsiveHeight, dimensions } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;
  
  const isSmallScreen = dimensions.width < 360;
  const isTablet = dimensions.isTablet;

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
          size={iconSizes.sm}
          color="#FFD700"
        />
      );
    }
    return stars;
  };

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={{flex: 1}}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* --- Fixed Header --- */}
          <View style={styles.header}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View style={styles.headerIcons}>
              <TouchableOpacity 
                style={styles.iconButton}
                onPress={() => (navigation as any).navigate('NotificationScreen')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="notifications-outline" size={iconSizes.lg} color={theme === 'dark' ? '#FFF' : '#000'} />
                {unreadNotificationCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <ResponsiveText size="xs" weight="600" color="#fff" style={styles.badgeText}>
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </ResponsiveText>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme === 'dark' ? '#FFF' : '#333'}
              />
            }
          >
          {/* --- Quick Access --- */}
          <ResponsiveView style={styles.section}>
            <ResponsiveText size="lg" weight="600" color={theme === 'dark' ? '#FFF' : '#333'} style={styles.sectionTitle}>
              Quick Access
            </ResponsiveText>
            <View style={styles.quickAccessContainer}>
              <TouchableOpacity
                style={styles.quickAccessButton}
                onPress={() => navigation.navigate('RegisterBusiness')}
                activeOpacity={0.7}
              >
                <Ionicons name="briefcase-outline" size={iconSizes.xl} color="#fff" />
                <ResponsiveText size="sm" weight="600" color="#fff" style={styles.quickAccessText}>
                  Register Business
                </ResponsiveText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAccessButton}
                onPress={() => navigation.navigate('MyPosts')}
                activeOpacity={0.7}
              >
                <Ionicons name="newspaper-outline" size={iconSizes.xl} color="#fff" />
                <ResponsiveText size="sm" weight="600" color="#fff" style={styles.quickAccessText}>
                  My Posts
                </ResponsiveText>
              </TouchableOpacity>
            </View>
            <View style={styles.quickAccessContainer}>
              <TouchableOpacity
                style={styles.quickAccessButton}
                onPress={() => navigation.navigate('MyBusiness')}
                activeOpacity={0.7}
              >
                <Ionicons name="storefront-outline" size={iconSizes.xl} color="#fff" />
                <ResponsiveText size="sm" weight="600" color="#fff" style={styles.quickAccessText}>
                  My Business
                </ResponsiveText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAccessButton}
                onPress={() => navigation.navigate('Promotions')}
                activeOpacity={0.7}
              >
                <Ionicons name="pricetag-outline" size={iconSizes.xl} color="#fff" />
                <ResponsiveText size="sm" weight="600" color="#fff" style={styles.quickAccessText}>
                  Promotions
                </ResponsiveText>
              </TouchableOpacity>
            </View>
          </ResponsiveView>

          {/* --- Transaction History --- */}
          <ResponsiveView style={styles.section}>
            <TouchableOpacity
              style={[styles.transactionHistoryCard, { backgroundColor: theme === 'dark' ? '#2a2a2a' : '#fff' }]}
              onPress={() => (navigation as any).navigate('BusinessTransactionHistoryScreen')}
              activeOpacity={0.7}
            >
              <View style={styles.transactionHistoryIcon}>
                <Ionicons name="receipt" size={iconSizes.lg} color="#667eea" />
              </View>
              <View style={styles.transactionHistoryInfo}>
                <ResponsiveText size="md" weight="600" color={theme === 'dark' ? '#FFF' : '#333'} style={styles.transactionHistoryTitle}>
                  Transaction History
                </ResponsiveText>
                <ResponsiveText size="sm" color={theme === 'dark' ? '#AAA' : '#666'} style={styles.transactionHistorySubtitle}>
                  View received points
                </ResponsiveText>
              </View>
              <Ionicons name="chevron-forward" size={iconSizes.md} color="#667eea" />
            </TouchableOpacity>
          </ResponsiveView>

          {/* --- Recent Reviews --- */}
          <ResponsiveView style={styles.section}>
            <View style={styles.sectionHeader}>
              <ResponsiveText size="lg" weight="600" color={theme === 'dark' ? '#FFF' : '#333'} style={styles.sectionTitle}>
                Recent Reviews
              </ResponsiveText>
              <TouchableOpacity 
                style={styles.seeAllButton}
                onPress={() => (navigation as any).navigate('Reviews')}
                activeOpacity={0.7}
              >
                <ResponsiveText size="sm" weight="600" color="#667eea" style={styles.seeAllText}>
                  See All
                </ResponsiveText>
                <Ionicons name="chevron-forward" size={iconSizes.sm} color="#667eea" />
              </TouchableOpacity>
            </View>
            {recentReviews.length > 0 ? (
              recentReviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  {review.userImage ? (
                    <LoadingImage 
                      source={{ uri: review.userImage }} 
                      style={styles.userImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.userIconContainer}>
                      <Ionicons name="person-circle" size={getResponsiveWidth(12)} color="#667eea" />
                    </View>
                  )}
                  <View style={styles.reviewContent}>
                    <View style={styles.reviewHeader}>
                      <ResponsiveText size="md" weight="600" color="#333" style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
                        {review.userName}
                      </ResponsiveText>
                      <View style={styles.starContainer}>{renderStars(review.rating)}</View>
                    </View>
                    <ResponsiveText size="sm" color="#555" style={styles.reviewComment} numberOfLines={3} ellipsizeMode="tail">
                      {review.comment}
                    </ResponsiveText>
                    <ResponsiveText size="xs" color="#999" style={styles.reviewTime}>
                      {review.time}
                    </ResponsiveText>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.noReviewsContainer}>
                <Ionicons name="chatbubble-outline" size={iconSizes.xxxxl} color="#999" />
                <ResponsiveText size="md" weight="600" color="#333" style={styles.noReviewsText}>
                  No reviews yet
                </ResponsiveText>
                <ResponsiveText size="sm" color="#666" style={styles.noReviewsSubtext}>
                  Reviews from customers will appear here
                </ResponsiveText>
              </View>
            )}
          </ResponsiveView>
        </ScrollView>
      </View>
      
      {/* Business Status Modal */}
      <BusinessStatusModal
        visible={modalVisible}
        onClose={closeModal}
        status={modalStatus as 'approved' | 'rejected' | 'pending'}
        businessName={modalBusinessName}
      />
      </SafeAreaView>
    </LinearGradient>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: Constants.statusBarHeight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: '5%',
    paddingVertical: '2%',
    minHeight: 60,
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
    width: '10%',
    minWidth: 40,
    maxWidth: 60,
    aspectRatio: 1,
    resizeMode: 'contain',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: '4%',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  profileIcon: {
    width: '10%',
    minWidth: 40,
    maxWidth: 60,
    aspectRatio: 1,
    borderRadius: 999,
  },
  logoutButton: {
    padding: 5,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 120,
    flexGrow: 1,
  },
  section: {
    paddingHorizontal: '5%',
    marginTop: '3%',
    marginBottom: '3%',
  },
  sectionTitle: {
    marginBottom: '2%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: '5%',
    marginBottom: '2%',
    flexWrap: 'wrap',
  },
  quickAccessContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: '3%',
    gap: '2%',
  },
  quickAccessButton: {
    backgroundColor: '#667eea',
    borderRadius: 16,
    paddingVertical: '4%',
    minHeight: 80,
    flex: 1,
    maxWidth: '48.5%',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickAccessText: {
    color: '#fff',
    marginTop: '2%',
    textAlign: 'center',
    paddingHorizontal: '2%',
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: '4%',
    marginBottom: '2%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userImage: {
    width: '12%',
    minWidth: 40,
    maxWidth: 60,
    aspectRatio: 1,
    borderRadius: 999,
    marginRight: '4%',
  },
  reviewContent: {
    flex: 1,
    minWidth: 0,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1%',
    flexWrap: 'wrap',
  },
  userName: {
    flex: 1,
    marginRight: '2%',
    minWidth: 0,
  },
  starContainer: {
    flexDirection: 'row',
    flexShrink: 0,
  },
  reviewComment: {
    marginBottom: '2%',
    lineHeight: 20,
  },
  reviewTime: {
    alignSelf: 'flex-end',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'red',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: 'white',
    fontWeight: 'bold',
  },
  noReviewsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: '8%',
    alignItems: 'center',
    marginVertical: '2%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  noReviewsText: {
    marginTop: '2%',
    textAlign: 'center',
  },
  noReviewsSubtext: {
    textAlign: 'center',
    marginTop: '1%',
    paddingHorizontal: '4%',
  },
  userIconContainer: {
    width: '12%',
    minWidth: 40,
    maxWidth: 60,
    aspectRatio: 1,
    borderRadius: 999,
    marginRight: '4%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seeAllButton: {
    backgroundColor: '#fff',
    paddingHorizontal: '4%',
    paddingVertical: '1.5%',
    minHeight: 36,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  seeAllText: {
    color: '#667eea',
    marginRight: '2%',
  },
  transactionHistoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '4%',
    borderRadius: 15,
    marginHorizontal: '5%',
    marginBottom: '2%',
    minHeight: 70,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  transactionHistoryIcon: {
    width: '12%',
    minWidth: 48,
    maxWidth: 60,
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '4%',
  },
  transactionHistoryInfo: {
    flex: 1,
    minWidth: 0,
  },
  transactionHistoryTitle: {
    marginBottom: 4,
  },
  transactionHistorySubtitle: {
    // Styles handled by ResponsiveText
  },
});

export default BusinessHomeScreen; 