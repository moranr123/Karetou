import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, StatusBar, Platform, ActivityIndicator, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, addDoc, increment } from 'firebase/firestore';
import NotificationService from '../../services/NotificationService';

// Ultimate image cache with base64 storage for instant display
const base64ImageCache = new Map<string, string>();
const imageStatusCache = new Map<string, { status: 'loading' | 'loaded' | 'error', promise?: Promise<void> }>();

// Convert image to base64 for ultimate caching
const convertToBase64 = async (uri: string): Promise<string | null> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.log('Failed to convert image to base64:', error);
    return null;
  }
};

// Ultimate preloading function that stores base64 data
const preloadImage = (uri: string): Promise<void> => {
  if (base64ImageCache.has(uri)) {
    return Promise.resolve();
  }
  
  if (imageStatusCache.has(uri)) {
    const cached = imageStatusCache.get(uri)!;
    if (cached.status === 'loaded') {
      return Promise.resolve();
    } else if (cached.promise) {
      return cached.promise;
    }
  }
  
  const promise = new Promise<void>((resolve) => {
    imageStatusCache.set(uri, { status: 'loading', promise });
    
    // Try both prefetch and base64 conversion
    Promise.all([
      Image.prefetch(uri),
      convertToBase64(uri)
    ]).then(([_, base64]) => {
      if (base64) {
        base64ImageCache.set(uri, base64);
        console.log('💾 Cached image as base64:', uri.substring(uri.lastIndexOf('/') + 1));
      }
      imageStatusCache.set(uri, { status: 'loaded' });
      resolve();
    }).catch(() => {
      imageStatusCache.set(uri, { status: 'error' });
      resolve();
    });
  });
  
  return promise;
};

// Ultimate Cached Image Component that uses base64 for instant display
const CachedImage: React.FC<{
  source: { uri: string };
  style: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}> = ({ source, style, resizeMode = 'cover' }) => {
  // Initialize with smart image source - start with cached version if available
  const [imageSource, setImageSource] = useState(() => {
    const base64Data = base64ImageCache.get(source.uri);
    return base64Data ? { uri: base64Data } : source;
  });
  
  // Track if we need to show loading indicator for uncached images
  const [isLoading, setIsLoading] = useState(() => {
    const base64Data = base64ImageCache.get(source.uri);
    const cached = imageStatusCache.get(source.uri);
    return !base64Data && cached?.status !== 'loaded';
  });
  
  useEffect(() => {
    // Check if we have base64 cached version
    const base64Data = base64ImageCache.get(source.uri);
    if (base64Data) {
      console.log('🎯 Using cached base64 image for instant display');
      setImageSource({ uri: base64Data });
      setIsLoading(false);
      return;
    }
    
    // Check regular cache status
    const cached = imageStatusCache.get(source.uri);
    if (cached?.status === 'loaded') {
      setImageSource(source);
      setIsLoading(false);
      return;
    }
    
    // Only set loading to true if we need to actually load the image
    setIsLoading(true);
    
    // Preload if not cached
    preloadImage(source.uri).then(() => {
      const newBase64Data = base64ImageCache.get(source.uri);
      if (newBase64Data) {
        setImageSource({ uri: newBase64Data });
      } else {
        setImageSource(source);
      }
      setIsLoading(false);
    }).catch(() => {
      setImageSource(source);
      setIsLoading(false);
    });
  }, [source.uri]);
  
  return (
    <View style={style}>
      <Image
        source={imageSource}
        style={style}
        resizeMode={resizeMode}
        fadeDuration={0}
        onLoad={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
      />
      {isLoading && (
        <View style={[style, { position: 'absolute', backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="small" color="#667eea" />
        </View>
      )}
    </View>
  );
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type RootStackParamList = {
  Main: { 
    screen: string; 
    params?: { business?: any } 
  };
  SearchBarScreen: undefined;
  ReviewsScreen: undefined;
  NotificationScreen: undefined;
  DiscoverSilay: undefined;
  // Add other screen names here as needed
};

const FILTERS = ['All', 'Coffee Shop', 'Restaurant', 'Tourist Spot'];

const SearchBarScreen = () => {
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedBusinesses, setSavedBusinesses] = useState<string[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [userReview, setUserReview] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [businessRatings, setBusinessRatings] = useState<{ [businessId: string]: { average: string, count: number } }>({});
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { theme, user } = useAuth();

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  // Handle saving/unsaving businesses
  const handleSaveBusiness = async (businessId: string) => {
    if (!user?.uid) return;
    
    try {
      const businessRef = doc(db, 'businesses', businessId);
      const isSaved = savedBusinesses.includes(businessId);
      
      if (isSaved) {
        // Unsave
        await updateDoc(businessRef, {
          savedBy: arrayRemove(user.uid)
        });
        setSavedBusinesses(prev => prev.filter(id => id !== businessId));
      } else {
        // Save
        await updateDoc(businessRef, {
          savedBy: arrayUnion(user.uid)
        });
        setSavedBusinesses(prev => [...prev, businessId]);
      }
    } catch (error) {
      console.error('Error toggling business save:', error);
    }
  };

  // Load saved businesses for current user
  const loadSavedBusinesses = async () => {
    if (!user?.uid) return;
    
    try {
      const q = query(
        collection(db, 'businesses'),
        where('savedBy', 'array-contains', user.uid)
      );
      const querySnapshot = await getDocs(q);
      const savedIds = querySnapshot.docs.map(doc => doc.id);
      setSavedBusinesses(savedIds);
    } catch (error) {
      console.error('Error loading saved businesses:', error);
    }
  };

  // Add this function to check for existing review
  const fetchUserReview = async (businessId: string) => {
    if (!user?.uid) return;
    setReviewLoading(true);
    const reviewsRef = collection(db, 'businesses', businessId, 'reviews');
    const q = query(reviewsRef, where('userId', '==', user.uid));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      setUserReview(snapshot.docs[0].data());
    } else {
      setUserReview(null);
    }
    setReviewLoading(false);
  };

  // Fetch verified/active businesses from Firebase
  useEffect(() => {
    console.log('🔄 Setting up real-time business listener for search');
    loadSavedBusinesses(); // Load saved businesses
    
    const businessQuery = query(
      collection(db, 'businesses'),
      where('status', '==', 'approved'),
      where('displayInUserApp', '==', true)
    );
    
    const unsubscribe = onSnapshot(
      businessQuery,
      (snapshot) => {
        const businessList: any[] = [];
        
        snapshot.forEach((doc) => {
          const business = doc.data();
          businessList.push({
            id: doc.id,
            ...business,
            // Format data for search display
            name: business.businessName,
            address: business.businessAddress || business.address,
            type: business.selectedType || business.businessType,
            image: business.businessImages && business.businessImages.length > 0 ? business.businessImages[0] : null,
            allImages: business.businessImages || [], // Include all images for Navigate screen
            rating: business.averageRating || 0,
            reviews: business.totalReviews || 0,
            // Add location data for Navigate screen routing
            latitude: business.businessLocation?.latitude || business.location?.latitude,
            longitude: business.businessLocation?.longitude || business.location?.longitude,
            businessLocation: business.businessLocation || business.location,
          });
        });
        
        // Sort by name alphabetically
        businessList.sort((a, b) => a.name.localeCompare(b.name));
        
        setBusinesses(businessList);
        setLoading(false);
        
        console.log('✅ Active businesses loaded for search:', businessList.length, 'businesses');
        
        // Preload business images for better performance
        console.log('🚀 SearchBarScreen: Starting image preloading...');
        const preloadPromises: Promise<void>[] = [];
        
        businessList.forEach(business => {
          if (business.image) {
            preloadPromises.push(preloadImage(business.image));
          }
        });
        
        Promise.all(preloadPromises).then(() => {
          console.log('✅ SearchBarScreen: All business images preloaded successfully!');
        }).catch((error) => {
          console.log('⚠️ SearchBarScreen: Some images failed to preload:', error);
        });
      },
      (error) => {
        console.error('Error in business search listener:', error);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log('🧹 Cleaning up business search listener');
      unsubscribe();
    };
  }, []);

  // Real-time listener for reviews of all loaded businesses
  useEffect(() => {
    if (!businesses.length) return;
    const unsubscribes: (() => void)[] = [];
    businesses.forEach((place) => {
      const reviewsRef = collection(db, 'businesses', place.id, 'reviews');
      const unsubscribe = onSnapshot(reviewsRef, (snapshot) => {
        let total = 0;
        let count = 0;
        snapshot.forEach(doc => {
          const data = doc.data();
          if (typeof data.rating === 'number') {
            total += data.rating;
            count++;
          }
        });
        setBusinessRatings(prev => ({
          ...prev,
          [place.id]: {
            average: count > 0 ? (total / count).toFixed(1) : '0.0',
            count,
          },
        }));
      });
      unsubscribes.push(unsubscribe);
    });
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [businesses]);

  const filteredData = businesses.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = selectedFilter === 'All' || item.type === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <LinearGradient
        colors={theme === 'light' ? lightGradient : darkGradient}
        style={styles.container}
      >
        <View style={[styles.headerFixed, { backgroundColor: 'transparent' }]}>
          <View style={styles.searchRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, {backgroundColor: 'transparent'}]}>
              <Ionicons name="arrow-back" size={24} color={theme === 'light' ? '#222' : '#fff'} />
            </TouchableOpacity>
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={20} color="#888" style={{ marginLeft: 8 }} />
              <TextInput
                style={styles.searchBar}
                placeholder="Search establishment"
                value={search}
                onChangeText={setSearch}
                placeholderTextColor="#888"
              />
              <TouchableOpacity>
                <Ionicons name="options-outline" size={22} color="#888" style={{ marginLeft: 8, marginRight: 4 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme === 'light' ? '#667eea' : '#fff'} />
          <Text style={[styles.loadingText, { color: theme === 'light' ? '#333' : '#fff' }]}>
            Loading businesses...
          </Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={theme === 'light' ? lightGradient : darkGradient}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.headerFixed, { backgroundColor: 'transparent' }]}>
        {/* Search Bar */}
        <View style={styles.searchRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, {backgroundColor: 'transparent'}]}>
            <Ionicons name="arrow-back" size={24} color={theme === 'light' ? '#222' : '#fff'} />
          </TouchableOpacity>
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={20} color="#888" style={{ marginLeft: 8 }} />
            <TextInput
              style={styles.searchBar}
              placeholder="Search establishment"
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#888"
            />
            <TouchableOpacity>
              <Ionicons name="options-outline" size={22} color="#888" style={{ marginLeft: 8, marginRight: 4 }} />
            </TouchableOpacity>
          </View>
        </View>
        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {FILTERS.map(filter => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                selectedFilter === filter && styles.filterChipActive,
              ]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilter === filter && styles.filterChipTextActive,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Results List */}
      <FlatList
        data={filteredData}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingTop: 180, paddingHorizontal: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card}
            onPress={async () => {
              // Track business view
              try {
                if (item.id) {
                  const businessRef = doc(db, 'businesses', item.id);
                  await updateDoc(businessRef, {
                    viewCount: increment(1),
                    lastViewedAt: new Date().toISOString(),
                  });
                  console.log('✅ View tracked for:', item.name);
                }
              } catch (error) {
                console.log('❌ Error tracking view:', error);
              }
              
              setSelectedPlace(item);
              setDetailsModalVisible(true);
            }}
          >
            <View style={styles.cardRow}>
              <View style={styles.cardImagePlaceholder}>
                {item.image ? (
                  <CachedImage source={{ uri: item.image }} style={styles.cardImage} resizeMode="cover" />
                ) : (
                  <Ionicons name="storefront" size={36} color="#bbb" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardAddress}>{item.address}</Text>
                <Text style={styles.cardType}>{item.type}</Text>
                {businessRatings[item.id]?.average && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={16} color="#FFD600" />
                    <Text style={styles.ratingText}>{businessRatings[item.id]?.average || item.rating?.toFixed(1) || '0.0'}</Text>
                    <Text style={styles.reviewText}>({businessRatings[item.id]?.count || item.reviews || 0} {businessRatings[item.id]?.count === 1 ? 'Review' : 'Reviews'})</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleSaveBusiness(item.id);
                }}
              >
                <Ionicons 
                  name={savedBusinesses.includes(item.id) ? "bookmark" : "bookmark-outline"} 
                  size={24} 
                  color={savedBusinesses.includes(item.id) ? "#667eea" : "#888"} 
                />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={64} color="#bbb" />
            <Text style={[styles.emptyText, { color: theme === 'light' ? '#666' : '#ccc' }]}>
              {search ? 'No establishments found for your search.' : 'No active establishments available.'}
            </Text>
          </View>
        }
      />

      {/* ===== Details Modal JSX ===== */}
      {selectedPlace && (
        <Modal
          visible={detailsModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setDetailsModalVisible(false);
          }}
        >
          <View style={styles.detailsOverlay}>
            <View style={styles.detailsContainer}>
              {/* Image Carousel */}
              <View style={styles.carouselWrapper}>
                <FlatList
                  data={selectedPlace.businessImages && selectedPlace.businessImages.length > 0 ? selectedPlace.businessImages : [selectedPlace.image]}
                  keyExtractor={(uri, idx) => uri + idx}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item, index }) => (
                    <View style={styles.imageContainer}>
                      <CachedImage source={{ uri: item }} style={styles.detailsImage} resizeMode="cover" />
                      <TouchableOpacity style={styles.rateButton} onPress={async () => {
                        console.log('Rate button pressed', selectedPlace?.id);
                        await fetchUserReview(selectedPlace.id);
                        setDetailsModalVisible(false);
                        setReviewModalVisible(true);
                      }}>
                        <Ionicons name="star" size={16} color="#FFD700" />
                        <Text style={styles.rateButtonText}>Rate</Text>
                      </TouchableOpacity>
                      {index === 0 && (selectedPlace.businessImages?.length > 1 || selectedPlace.image) && (
                        <View style={styles.swipeIndicator}>
                          <Ionicons name="chevron-forward" size={24} color="#fff" />
                          <Text style={styles.swipeText}>Swipe</Text>
                        </View>
                      )}
                    </View>
                  )}
                />
              </View>
              <View style={styles.detailsContent}>
                <Text style={styles.detailsTitle}>{selectedPlace.name}</Text>
                {selectedPlace.type ? (
                  <Text style={styles.detailsSubtitle}>{selectedPlace.type}</Text>
                ) : null}
                {selectedPlace.address ? (
                  <>
                    <Text style={styles.detailsLocationLabel}>Location</Text>
                    <Text style={styles.detailsLocation}>{selectedPlace.address}</Text>
                  </>
                ) : null}
                {/* Rating Row */}
                <View style={styles.ratingRowModal}>
                  <Ionicons name="star" size={20} color="#FFD700" />
                  <Text style={styles.ratingNumberModal}>{businessRatings[selectedPlace.id]?.average || selectedPlace.rating?.toFixed(1) || '0.0'}</Text>
                  <Text style={styles.reviewsTextModal}>({businessRatings[selectedPlace.id]?.count || selectedPlace.reviews || 0} {businessRatings[selectedPlace.id]?.count === 1 ? 'Review' : 'Reviews'})</Text>
                </View>
                <Text style={styles.detailsSectionLabel}>Business Hours</Text>
                <Text style={styles.detailsText}>{selectedPlace.businessHours || 'Not specified'}</Text>
                {/* View on Map Button */}
                { (selectedPlace.businessLocation || selectedPlace.address) && (
                  <TouchableOpacity
                    style={styles.viewMapBtn}
                    onPress={() => {
                      // Close the current modal first
                      setDetailsModalVisible(false);
                      
                      // Navigate to the Navigate tab with business data
                      navigation.navigate('Main', { 
                        screen: 'Navigate', 
                        params: { business: selectedPlace } 
                      });
                    }}
                  >
                    <Ionicons name="map" size={20} color="#fff" />
                    <Text style={styles.viewMapText}> View on Map</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity style={styles.closeButtonModal} onPress={() => setDetailsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Review Modal */}
      <Modal
        visible={reviewModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setReviewModalVisible(false);
          setDetailsModalVisible(true);
        }}
      >
        <View style={[styles.reviewModalOverlay]}> 
          <View style={styles.reviewModalCard}> 
            {/* Header */}
            <View style={styles.reviewModalHeader}>
              <Text style={styles.reviewModalTitle}>{selectedPlace?.name || 'Rate & Review'}</Text>
              <TouchableOpacity onPress={() => {
                setReviewModalVisible(false);
                setDetailsModalVisible(true);
              }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            {reviewLoading ? (
              <ActivityIndicator size="large" color="#667eea" style={{ marginTop: 30 }} />
            ) : userReview ? (
              <View style={styles.reviewCardDisplay}>
                <Text style={styles.reviewCardLabel}>Your Review</Text>
                <View style={styles.reviewCardStars}>
                  {[1,2,3,4,5].map(i => (
                    <Ionicons key={i} name={i <= userReview.rating ? 'star' : 'star-outline'} size={30} color="#FFD700" />
                  ))}
                </View>
                {userReview.comment ? <Text style={styles.reviewCardComment}>{userReview.comment}</Text> : null}
                <Text style={styles.reviewCardDate}>{userReview.createdAt ? new Date(userReview.createdAt).toLocaleString() : ''}</Text>
                <TouchableOpacity style={styles.reviewModalButton} onPress={() => {
                  setReviewModalVisible(false);
                  setDetailsModalVisible(true);
                }}>
                  <Text style={styles.reviewModalButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ alignItems: 'center', marginTop: 10 }}>
                <Text style={styles.reviewModalLabel}>Your Rating</Text>
                <View style={styles.reviewModalStars}>
                  {[1,2,3,4,5].map(i => (
                    <TouchableOpacity key={i} onPress={() => setReviewRating(i)}>
                      <Ionicons name={i <= reviewRating ? 'star' : 'star-outline'} size={38} color="#FFD700" style={{ marginHorizontal: 2 }} />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.reviewModalInput}
                  placeholder="Write an optional comment..."
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  multiline
                  placeholderTextColor="#888"
                />
                <TouchableOpacity
                  style={[styles.reviewModalButton, reviewRating === 0 || reviewLoading ? { opacity: 0.6 } : {}]} 
                  disabled={reviewRating === 0 || reviewLoading}
                  onPress={async () => {
                    if (!user || !selectedPlace) return;
                    setReviewLoading(true);
                    // Check again for existing review
                    const reviewsRef = collection(db, 'businesses', selectedPlace.id, 'reviews');
                    const q = query(reviewsRef, where('userId', '==', user.uid));
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) {
                      setUserReview(snapshot.docs[0].data());
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

                    // Notify business owner of new review
                    const notificationService = NotificationService.getInstance();
                    await notificationService.notifyBusinessOwnerOfNewReview(
                      selectedPlace.id,
                      user.displayName || user.email || 'Anonymous User',
                      reviewRating,
                      reviewComment
                    );

                    setUserReview({
                      userId: user.uid,
                      userName: user.displayName || user.email || 'Anonymous',
                      rating: reviewRating,
                      comment: reviewComment,
                      createdAt: new Date().toISOString(),
                    });
                    setReviewLoading(false);
                  }}
                >
                  <Text style={styles.reviewModalButtonText}>{reviewLoading ? 'Submitting...' : 'Submit Review'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerFixed: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 36 : 36,
    paddingBottom: 8,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderColor: '#ccc',
    borderTopWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1976d2',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchBar: {
    flex: 1,
    fontSize: 15,
    color: '#222',
    padding: 8,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginHorizontal: 12,
    marginBottom: 2,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1976d2',
  },
  filterChipText: {
    color: '#222',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#222',
    marginBottom: 2,
  },
  cardAddress: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  cardType: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#FFD600',
    fontWeight: 'bold',
    marginLeft: 4,
    marginRight: 4,
  },
  reviewText: {
    fontSize: 12,
    color: '#aaa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 40,
  },
  saveButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal styles
  detailsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    width: screenWidth * 0.85,
    maxHeight: screenHeight * 0.80,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  detailsImage: {
    width: screenWidth * 0.75,
    height: screenHeight * 0.25,
    resizeMode: 'cover',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000',
  },
  detailsContent: {
    padding: 20,
  },
  detailsTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  detailsSubtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
    textAlign: 'center',
  },
  detailsLocationLabel: {
    fontWeight: '600',
    color: '#667eea',
    marginTop: 16,
    marginBottom: 4,
  },
  detailsLocation: {
    fontSize: 14,
    color: '#777',
    marginBottom: 12,
  },
  ratingRowModal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingNumberModal: {
    marginLeft: 4,
    fontWeight: '600',
    color: '#333',
  },
  reviewsTextModal: {
    marginLeft: 4,
    color: '#667eea',
  },
  detailsSectionLabel: {
    fontWeight: '600',
    color: '#667eea',
    marginTop: 16,
  },
  detailsText: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
  },
  closeButtonModal: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
    zIndex: 2,
  },
  imageContainer: {
    position: 'relative',
    width: screenWidth * 0.75,
    height: screenHeight * 0.25,
    marginHorizontal: 20,
    marginTop: 20,
  },
  carouselWrapper: {
    width: '100%',
    height: screenHeight * 0.29,
    alignItems: 'center',
  },
  swipeIndicator: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
    alignItems: 'center',
  },
  swipeText: {
    color: '#fff',
    fontWeight: '500',
    marginTop: 2,
  },
  viewMapBtn: {
    marginTop: 16,
    width: '100%',
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  viewMapText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  rateButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 2,
  },
  rateButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '600',
  },
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reviewModalCard: {
    width: '95%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  reviewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  reviewModalTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    flex: 1,
  },
  reviewModalLabel: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  reviewModalStars: {
    flexDirection: 'row',
    marginBottom: 20,
    justifyContent: 'center',
  },
  reviewModalInput: {
    width: '90%',
    minHeight: 60,
    backgroundColor: '#f3f3f7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    color: '#222',
    marginBottom: 20,
  },
  reviewModalButton: {
    backgroundColor: '#667eea',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
    alignSelf: 'center',
  },
  reviewModalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  reviewCardDisplay: {
    alignItems: 'center',
    backgroundColor: '#f7f7fa',
    borderRadius: 10,
    margin: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  reviewCardLabel: {
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 4,
  },
  reviewCardStars: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  reviewCardComment: {
    fontStyle: 'italic',
    color: '#444',
    marginBottom: 8,
    textAlign: 'center',
  },
  reviewCardDate: {
    color: '#888',
    marginBottom: 8,
  },
});

export { SearchBarScreen };