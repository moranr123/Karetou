import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, orderBy, limit } from 'firebase/firestore';
import NotificationService from '../../services/NotificationService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface BusinessWithReview {
  id: string;
  name: string;
  businessType: string;
  businessAddress: string;
  latestReview?: {
    id: string;
    userName: string;
    rating: number;
    comment: string;
    createdAt: string;
  } | null;
  totalReviews: number;
  averageRating: number;
}

const ReviewsScreen = () => {
  const navigation = useNavigation();
  const { theme, user } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessWithReview[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<BusinessWithReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<any | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [allReviewsModalVisible, setAllReviewsModalVisible] = useState(false);
  const [selectedBusinessForAllReviews, setSelectedBusinessForAllReviews] = useState<any | null>(null);
  const [allReviewsForBusiness, setAllReviewsForBusiness] = useState<any[]>([]);

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  // Load all businesses with their latest review
  const loadBusinessesWithReviews = async () => {
    try {
      setLoading(true);
      
      // Get all approved businesses
      const businessesQuery = query(
        collection(db, 'businesses'),
        where('status', '==', 'approved'),
        where('displayInUserApp', '==', true)
      );
      const businessesSnapshot = await getDocs(businessesQuery);
      
      const businessList: BusinessWithReview[] = [];
      
      // For each business, get their latest review
      for (const businessDoc of businessesSnapshot.docs) {
        const businessData = businessDoc.data();
        
        // Get all reviews for this business
        const reviewsRef = collection(db, 'businesses', businessDoc.id, 'reviews');
        const reviewsSnapshot = await getDocs(reviewsRef);
        
        // Calculate average rating and total reviews
        let totalRating = 0;
        let reviewCount = 0;
        let latestReview = null;
        let latestDate = 0;
        
        reviewsSnapshot.forEach(reviewDoc => {
          const reviewData = reviewDoc.data();
          totalRating += reviewData.rating || 0;
          reviewCount++;
          
          const reviewDate = new Date(reviewData.createdAt || 0).getTime();
          if (reviewDate > latestDate) {
            latestDate = reviewDate;
            latestReview = {
              id: reviewDoc.id,
              userName: reviewData.userName || 'Anonymous',
              rating: reviewData.rating || 0,
              comment: reviewData.comment || '',
              createdAt: reviewData.createdAt || '',
            };
          }
        });
        
        const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
        
        businessList.push({
          id: businessDoc.id,
          name: businessData.businessName || 'Unknown Business',
          businessType: businessData.selectedType || businessData.businessType || '',
          businessAddress: businessData.businessAddress || '',
          latestReview,
          totalReviews: reviewCount,
          averageRating: parseFloat(averageRating.toFixed(1)),
        });
      }
      
      // Sort by total reviews (businesses with more reviews first)
      businessList.sort((a, b) => b.totalReviews - a.totalReviews);
      
      setBusinesses(businessList);
      setFilteredBusinesses(businessList);
      console.log('✅ Loaded', businessList.length, 'businesses with reviews');
    } catch (error) {
      console.error('Error loading businesses with reviews:', error);
      setBusinesses([]);
      setFilteredBusinesses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinessesWithReviews();
  }, []);

  // Filter businesses based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredBusinesses(businesses);
    } else {
      const filtered = businesses.filter(business =>
        business.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        business.businessType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        business.businessAddress.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredBusinesses(filtered);
    }
  }, [searchQuery, businesses]);

  // Load all reviews for a specific business
  const loadAllReviewsForBusiness = async (businessId: string) => {
    try {
      const reviewsRef = collection(db, 'businesses', businessId, 'reviews');
      const reviewsSnapshot = await getDocs(reviewsRef);
      
      const reviews = reviewsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Sort by date (newest first)
      reviews.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      
      setAllReviewsForBusiness(reviews);
    } catch (error) {
      console.error('Error loading all reviews:', error);
      setAllReviewsForBusiness([]);
    }
  };

  // Handle submit review
  const handleSubmitReview = async () => {
    if (!user || !selectedBusiness || reviewRating === 0) return;
    
    setReviewLoading(true);
    try {
      // Check if user already reviewed this business
      const reviewsRef = collection(db, 'businesses', selectedBusiness.id, 'reviews');
      const q = query(reviewsRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        alert('You have already reviewed this business!');
        setReviewLoading(false);
        return;
      }
      
      // Add review
      await addDoc(reviewsRef, {
        userId: user.uid,
        userName: user.displayName || user.email || 'Anonymous',
        rating: reviewRating,
        comment: reviewComment,
        createdAt: new Date().toISOString(),
      });

      // Notify business owner
      const notificationService = NotificationService.getInstance();
      await notificationService.notifyBusinessOwnerOfNewReview(
        selectedBusiness.id,
        user.displayName || user.email || 'Anonymous User',
        reviewRating,
        reviewComment
      );

      alert('Review submitted successfully!');
      
      // Reset and reload
      setReviewRating(0);
      setReviewComment('');
      setReviewModalVisible(false);
      setSelectedBusiness(null);
      loadBusinessesWithReviews();
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const renderBusinessItem = ({ item }: { item: BusinessWithReview }) => (
    <View style={styles.businessCard}>
      {/* Business Info */}
      <View style={styles.businessHeader}>
        <View style={styles.businessInfo}>
          <Text style={styles.businessName}>{item.name}</Text>
          <Text style={styles.businessType}>{item.businessType}</Text>
          {item.businessAddress && (
            <Text style={styles.businessAddress} numberOfLines={1}>
              <Ionicons name="location-outline" size={12} color="#888" /> {item.businessAddress}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.reviewButton}
          onPress={() => {
            setSelectedBusiness(item);
            setReviewModalVisible(true);
          }}
        >
          <Ionicons name="star" size={16} color="#FFD700" style={styles.reviewButtonIcon} />
          <Text style={styles.reviewButtonText}>Review</Text>
        </TouchableOpacity>
      </View>

      {/* Rating Summary */}
      <View style={styles.ratingSummary}>
        <View style={styles.ratingStars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Ionicons
              key={star}
              name={star <= item.averageRating ? 'star' : 'star-outline'}
              size={16}
              color="#FFD700"
            />
          ))}
        </View>
        <Text style={styles.ratingText}>
          {item.averageRating > 0 ? item.averageRating.toFixed(1) : '0.0'} ({item.totalReviews} {item.totalReviews === 1 ? 'review' : 'reviews'})
        </Text>
      </View>

      {/* Latest Review */}
      {item.latestReview ? (
        <View style={styles.reviewSection}>
          <View style={styles.reviewSectionHeader}>
            <Text style={styles.reviewSectionTitle}>Latest Review:</Text>
            {item.totalReviews > 1 && (
              <TouchableOpacity
                style={styles.seeAllReviewsBtn}
                onPress={async () => {
                  setSelectedBusinessForAllReviews(item);
                  await loadAllReviewsForBusiness(item.id);
                  setAllReviewsModalVisible(true);
                }}
              >
                <Text style={styles.seeAllReviewsText}>See All ({item.totalReviews})</Text>
                <Ionicons name="chevron-forward" size={14} color="#667eea" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.reviewContent}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewUserName}>{item.latestReview.userName}</Text>
              <View style={styles.reviewStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= item.latestReview!.rating ? 'star' : 'star-outline'}
                    size={14}
                    color="#FFD700"
                  />
                ))}
              </View>
            </View>
            {item.latestReview.comment && (
              <Text style={styles.reviewComment} numberOfLines={2}>
                {item.latestReview.comment}
              </Text>
            )}
            <Text style={styles.reviewDate}>
              {new Date(item.latestReview.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.noReviewSection}>
          <Ionicons name="chatbubbles-outline" size={24} color="#ccc" />
          <Text style={styles.noReviewText}>No reviews yet. Be the first to review!</Text>
        </View>
      )}
    </View>
  );

  return (
    <LinearGradient
      colors={theme === 'light' ? lightGradient : darkGradient}
      style={styles.container}
    >
      {/* Header with Search Bar */}
      <View style={[styles.header, { backgroundColor: theme === 'light' ? '#fff' : '#333' }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme === 'light' ? '#222' : '#fff'} />
          </TouchableOpacity>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search businesses..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#888" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Businesses List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={[styles.loadingText, { color: theme === 'light' ? '#333' : '#fff' }]}>
            Loading businesses...
          </Text>
        </View>
      ) : filteredBusinesses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="business-outline" size={64} color="#999" />
          <Text style={[styles.emptyText, { color: theme === 'light' ? '#666' : '#ccc' }]}>
            {searchQuery ? 'No businesses found' : 'No businesses available'}
          </Text>
          <Text style={[styles.emptySubText, { color: theme === 'light' ? '#888' : '#aaa' }]}>
            {searchQuery ? 'Try a different search term' : 'Check back later!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBusinesses}
          keyExtractor={(item) => item.id}
          renderItem={renderBusinessItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Review Modal - Write Review */}
      <Modal
        visible={reviewModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setReviewModalVisible(false);
          setSelectedBusiness(null);
          setReviewRating(0);
          setReviewComment('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review {selectedBusiness?.name}</Text>
              <TouchableOpacity onPress={() => {
                setReviewModalVisible(false);
                setSelectedBusiness(null);
                setReviewRating(0);
                setReviewComment('');
              }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.reviewForm}>
              <Text style={styles.reviewLabel}>Your Rating</Text>
              <View style={styles.starsInput}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                    <Ionicons
                      name={star <= reviewRating ? 'star' : 'star-outline'}
                      size={38}
                      color="#FFD700"
                      style={{ marginHorizontal: 2 }}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.reviewLabel}>Your Review (Optional)</Text>
              <TextInput
                style={styles.reviewInput}
                placeholder="Write your review here..."
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                placeholderTextColor="#888"
              />
              <TouchableOpacity
                style={[styles.submitButton, (reviewRating === 0 || reviewLoading) && styles.submitButtonDisabled]}
                onPress={handleSubmitReview}
                disabled={reviewRating === 0 || reviewLoading}
              >
                <Text style={styles.submitButtonText}>
                  {reviewLoading ? 'Submitting...' : 'Submit Review'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* All Reviews Modal */}
      <Modal
        visible={allReviewsModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setAllReviewsModalVisible(false);
          setSelectedBusinessForAllReviews(null);
          setAllReviewsForBusiness([]);
        }}
      >
        <View style={styles.allReviewsContainer}>
          <View style={styles.allReviewsHeader}>
            <TouchableOpacity
              onPress={() => {
                setAllReviewsModalVisible(false);
                setSelectedBusinessForAllReviews(null);
                setAllReviewsForBusiness([]);
              }}
              style={styles.allReviewsBackButton}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.allReviewsTitle}>
              {selectedBusinessForAllReviews?.name}
            </Text>
          </View>
          <FlatList
            data={allReviewsForBusiness}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.allReviewsList}
            renderItem={({ item }) => (
              <View style={styles.allReviewsItem}>
                <View style={styles.allReviewsItemHeader}>
                  <Text style={styles.allReviewsItemName}>{item.userName || 'Anonymous'}</Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= item.rating ? 'star' : 'star-outline'}
                        size={16}
                        color="#FFD700"
                      />
                    ))}
                  </View>
                </View>
                {item.comment && (
                  <Text style={styles.allReviewsItemComment}>{item.comment}</Text>
                )}
                <Text style={styles.allReviewsItemDate}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.allReviewsEmpty}>
                <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
                <Text style={styles.allReviewsEmptyText}>No reviews yet</Text>
              </View>
            }
          />
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ? StatusBar.currentHeight + 12 : 50 : 50,
    paddingBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: '#222',
  },
  clearButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  businessCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  businessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  businessInfo: {
    flex: 1,
    marginRight: 12,
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
    marginBottom: 4,
  },
  businessAddress: {
    fontSize: 12,
    color: '#888',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  reviewButtonIcon: {
    marginRight: 4,
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  ratingStars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  reviewSection: {
    marginTop: 8,
  },
  reviewSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
  },
  seeAllReviewsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  seeAllReviewsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#667eea',
    marginRight: 2,
  },
  reviewContent: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  reviewStars: {
    flexDirection: 'row',
  },
  reviewComment: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginBottom: 6,
  },
  reviewDate: {
    fontSize: 11,
    color: '#888',
  },
  noReviewSection: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
  noReviewText: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: screenWidth * 0.9,
    maxHeight: screenHeight * 0.7,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    flex: 1,
  },
  reviewForm: {
    padding: 20,
  },
  reviewLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  starsInput: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  reviewInput: {
    width: '100%',
    minHeight: 100,
    backgroundColor: '#f3f3f7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    color: '#222',
    marginBottom: 20,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#667eea',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // All Reviews Modal styles
  allReviewsContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  allReviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 50 : 16,
  },
  allReviewsBackButton: {
    padding: 8,
    marginRight: 12,
  },
  allReviewsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  allReviewsList: {
    padding: 16,
    paddingBottom: 100,
  },
  allReviewsItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  allReviewsItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  allReviewsItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  allReviewsItemComment: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 8,
  },
  allReviewsItemDate: {
    fontSize: 12,
    color: '#888',
  },
  allReviewsEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  allReviewsEmptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
});

export default ReviewsScreen;
