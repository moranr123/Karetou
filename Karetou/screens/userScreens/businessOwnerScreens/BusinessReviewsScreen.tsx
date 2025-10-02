import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import LoadingImage from '../../../components/LoadingImage';

const { width: screenWidth } = Dimensions.get('window');

const BusinessReviewsScreen = () => {
  const { user, theme } = useAuth();

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
        <Ionicons key={i} name={i <= rating ? 'star' : 'star-outline'} size={18} color="#FFD700" />
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
            <Text style={styles.businessName}>{business.businessName}</Text>
            <Text style={styles.businessType}>{business.businessType || business.selectedType}</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
                <Text style={styles.statusText}>Active</Text>
              </View>
            </View>
          </View>
          <View style={styles.ratingContainer}>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={20} color="#FFD700" />
              <Text style={styles.ratingNumber}>{rating.average}</Text>
            </View>
            <Text style={styles.reviewCount}>{rating.count} {rating.count === 1 ? 'Review' : 'Reviews'}</Text>
          </View>
        </View>

        {recentReviews.length > 0 && (
          <View style={styles.recentReviewsSection}>
            <Text style={styles.recentReviewsTitle}>Recent Reviews</Text>
            {recentReviews.map((review) => (
              <View key={review.id} style={styles.reviewPreview}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>{review.userName || 'Anonymous'}</Text>
                  {renderStars(review.rating)}
                </View>
                {review.comment && (
                  <Text style={styles.reviewComment} numberOfLines={2}>
                    {review.comment}
                  </Text>
                )}
                <Text style={styles.reviewDate}>
                  {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
                </Text>
              </View>
            ))}
            {reviews.length > 2 && (
              <Text style={styles.moreReviews}>+{reviews.length - 2} more reviews</Text>
            )}
          </View>
        )}

        {reviews.length === 0 && (
          <View style={styles.noReviewsContainer}>
            <Ionicons name="chatbubble-outline" size={24} color="#ccc" />
            <Text style={styles.noReviewsText}>No reviews yet</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Business Reviews</Text>
          <Text style={styles.subtitle}>Active businesses and their reviews</Text>
          
          {loading ? (
            <ActivityIndicator size="large" color="#667eea" style={{ marginTop: 30 }} />
          ) : businesses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={60} color="rgba(255,255,255,0.5)" />
              <Text style={styles.emptyText}>No active businesses found</Text>
            </View>
          ) : (
            <FlatList
              data={businesses}
              keyExtractor={item => item.id}
              renderItem={renderBusinessCard}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
            />
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#000', marginBottom: 5, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 20 },
  businessCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
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
  },
  businessImageContainer: {
    marginRight: 12,
  },
  businessImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  businessType: {
    fontSize: 14,
    color: '#667eea',
    marginBottom: 6,
  },
  statusContainer: {
    flexDirection: 'row',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ratingContainer: {
    alignItems: 'flex-end',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: '#666',
  },
  recentReviewsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  recentReviewsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
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
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  reviewComment: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 11,
    color: '#888',
  },
  moreReviews: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  noReviewsContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noReviewsText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 16,
  },
});

export default BusinessReviewsScreen; 