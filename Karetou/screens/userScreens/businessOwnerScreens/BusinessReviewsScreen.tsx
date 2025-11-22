import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import LoadingImage from '../../../components/LoadingImage';
import { useResponsive } from '../../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../../components';

const { width: screenWidth } = Dimensions.get('window');

const BusinessReviewsScreen = () => {
  const { user, theme } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius, getResponsiveWidth, getResponsiveHeight, dimensions } = useResponsive();

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessReviews, setBusinessReviews] = useState<{ [businessId: string]: any[] }>({});
  const [businessRatings, setBusinessRatings] = useState<{ [businessId: string]: { average: string, count: number } }>({});

  // Fetch all active/verified businesses
  useEffect(() => {
    const businessesQuery = query(
      collection(db, 'businesses'),
      where('status', '==', 'approved')
    );

    const unsubscribe = onSnapshot(businessesQuery, (snapshot) => {
      const businessList: any[] = [];
      snapshot.forEach(doc => {
        businessList.push({ id: doc.id, ...doc.data() });
      });
      setBusinesses(businessList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Set up real-time listeners for reviews of all businesses
  useEffect(() => {
    if (!businesses.length) return;
    
    const unsubscribes: (() => void)[] = [];
    
    businesses.forEach((business) => {
      const reviewsRef = collection(db, 'businesses', business.id, 'reviews');
      const unsubscribe = onSnapshot(reviewsRef, (snapshot) => {
        const reviews: any[] = [];
        let totalRating = 0;
        let reviewCount = 0;
        
        snapshot.forEach(doc => {
          const reviewData = doc.data();
          reviews.push({ id: doc.id, ...reviewData });
          if (typeof reviewData.rating === 'number') {
            totalRating += reviewData.rating;
            reviewCount++;
          }
        });
        
        // Sort reviews by date (newest first)
        reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setBusinessReviews(prev => ({
          ...prev,
          [business.id]: reviews
        }));
        
        setBusinessRatings(prev => ({
          ...prev,
          [business.id]: {
            average: reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : '0.0',
            count: reviewCount,
          },
        }));
      });
      
      unsubscribes.push(unsubscribe);
    });
    
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [businesses]);

  const renderStars = (rating: number) => (
    <View style={{ flexDirection: 'row' }}>
      {[1,2,3,4,5].map(i => (
        <Ionicons key={i} name={i <= rating ? 'star' : 'star-outline'} size={iconSizes.sm} color="#FFD700" />
      ))}
    </View>
  );

  const renderBusinessCard = ({ item: business }: { item: any }) => {
    const reviews = businessReviews[business.id] || [];
    const rating = businessRatings[business.id] || { average: '0.0', count: 0 };
    const recentReviews = reviews.slice(0, 2); // Show only 2 most recent reviews

    return (
      <View style={styles.businessCard}>
        <View style={styles.businessHeader}>
          <View style={styles.businessImageContainer}>
            <LoadingImage
              source={{ uri: business.businessImages?.[0] || 'https://via.placeholder.com/60' }}
              style={styles.businessImage}
              resizeMode="cover"
            />
          </View>
          <View style={styles.businessInfo}>
            <ResponsiveText size="lg" weight="bold" color="#333" style={styles.businessName} numberOfLines={1}>
              {business.businessName}
            </ResponsiveText>
            <ResponsiveText size="sm" color="#667eea" style={styles.businessType} numberOfLines={1}>
              {business.businessType || business.selectedType}
            </ResponsiveText>
            <View style={styles.statusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
                <ResponsiveText size="xs" weight="bold" color="#fff" style={styles.statusText}>
                  Active
                </ResponsiveText>
              </View>
            </View>
          </View>
          <View style={styles.ratingContainer}>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={iconSizes.md} color="#FFD700" />
              <ResponsiveText size="lg" weight="bold" color="#333" style={styles.ratingNumber}>
                {rating.average}
              </ResponsiveText>
            </View>
            <ResponsiveText size="xs" color="#666" style={styles.reviewCount}>
              {rating.count} {rating.count === 1 ? 'Review' : 'Reviews'}
            </ResponsiveText>
          </View>
        </View>

        {recentReviews.length > 0 && (
          <View style={styles.recentReviewsSection}>
            <ResponsiveText size="md" weight="bold" color="#333" style={styles.recentReviewsTitle}>
              Recent Reviews
            </ResponsiveText>
            {recentReviews.map((review) => (
              <View key={review.id} style={styles.reviewPreview}>
                <View style={styles.reviewHeader}>
                  <ResponsiveText size="sm" weight="600" color="#333" style={styles.reviewerName} numberOfLines={1}>
                    {review.userName || 'Anonymous'}
                  </ResponsiveText>
                  {renderStars(review.rating)}
                </View>
                {review.comment && (
                  <ResponsiveText size="sm" color="#555" style={styles.reviewComment} numberOfLines={2}>
                    {review.comment}
                  </ResponsiveText>
                )}
                <ResponsiveText size="xs" color="#888" style={styles.reviewDate}>
                  {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
                </ResponsiveText>
              </View>
            ))}
            {reviews.length > 2 && (
              <ResponsiveText size="xs" weight="600" color="#667eea" style={styles.moreReviews}>
                +{reviews.length - 2} more reviews
              </ResponsiveText>
            )}
          </View>
        )}

        {reviews.length === 0 && (
          <View style={styles.noReviewsContainer}>
            <Ionicons name="chatbubble-outline" size={iconSizes.lg} color="#ccc" />
            <ResponsiveText size="sm" color="#999" style={styles.noReviewsText}>
              No reviews yet
            </ResponsiveText>
          </View>
        )}
      </View>
    );
  };

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ResponsiveText size="xxl" weight="bold" color={theme === 'dark' ? '#FFF' : '#000'} style={styles.title}>
            Business Reviews
          </ResponsiveText>
          <ResponsiveText size="md" color={theme === 'dark' ? 'rgba(255,255,255,0.7)' : '#666'} style={styles.subtitle}>
            Active businesses and their reviews
          </ResponsiveText>
          
          {loading ? (
            <ActivityIndicator size="large" color="#667eea" style={{ marginTop: 30 }} />
          ) : businesses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={iconSizes.xxxxl} color="rgba(255,255,255,0.5)" />
              <ResponsiveText size="lg" weight="600" color={theme === 'dark' ? 'rgba(255,255,255,0.8)' : '#333'} style={styles.emptyText}>
                No active businesses found
              </ResponsiveText>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {businesses.map((business) => (
                <View key={business.id}>
                  {renderBusinessCard({ item: business })}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  safeArea: { 
    flex: 1 
  },
  content: { 
    flex: 1 
  },
  scrollContent: {
    padding: '5%',
    paddingBottom: 30,
    flexGrow: 1,
  },
  title: { 
    marginBottom: 5, 
    textAlign: 'center' 
  },
  subtitle: { 
    textAlign: 'center', 
    marginBottom: 20 
  },
  listContainer: {
    marginTop: 10,
  },
  businessCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: '4%',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  businessImageContainer: {
    marginRight: 12,
  },
  businessImage: {
    width: 60,
    minWidth: 50,
    aspectRatio: 1,
    borderRadius: 12,
  },
  businessInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  businessName: {
    marginBottom: 4,
  },
  businessType: {
    marginBottom: 6,
  },
  statusContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
  },
  ratingContainer: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingNumber: {
    marginLeft: 4,
  },
  reviewCount: {
    // Styles handled by ResponsiveText
  },
  recentReviewsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    marginTop: 12,
  },
  recentReviewsTitle: {
    marginBottom: 8,
  },
  reviewPreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  reviewerName: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  reviewComment: {
    lineHeight: 18,
    marginBottom: 4,
  },
  reviewDate: {
    // Styles handled by ResponsiveText
  },
  moreReviews: {
    textAlign: 'center',
    marginTop: 4,
  },
  noReviewsContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noReviewsText: {
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    marginTop: 16,
  },
});

export default BusinessReviewsScreen; 