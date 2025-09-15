import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TextInput,
  Image,
  TouchableOpacity,
  FlatList,
  ImageBackground,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, query, getDocs, where, orderBy, limit, addDoc, doc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import LoadingImage from '../../components/LoadingImage';
import NotificationService from '../../services/NotificationService';
import * as Location from 'expo-location';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
  // Initialize with smart loading state - only show loading if image is not cached
  const [imageSource, setImageSource] = useState(() => {
    const base64Data = base64ImageCache.get(source.uri);
    return base64Data ? { uri: base64Data } : source;
  });
  
  const [isLoading, setIsLoading] = useState(() => {
    // Only show loading if image is not cached
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

type RootStackParamList = {
  Home: undefined;
  SearchBarScreen: undefined;
  Navigate: { business?: any };
  // Add other screen names here as needed
};

// --- Dummy Data (kept as fallback) ---
const fallbackSuggestedPlaces = [
  {
    id: '1',
    title: 'Lantawan View',
    location: 'Sitio Lantawan, Brgy. Guimbalaon, Silay City',
    rating: '4.9',
    image: 'https://images.unsplash.com/photo-1593083868846-50d09a545bee?q=80&w=2574&auto=format&fit=crop',
  },
  {
    id: '2',
    title: 'Balay Negrense',
    location: 'Cinco de Noviembre Street, Silay City',
    rating: '4.8',
    image: 'https://images.unsplash.com/photo-1582962386222-23c342d7a224?q=80&w=2574&auto=format&fit=crop',
  },
];

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenWidth * 0.05,
    paddingTop: screenHeight * 0.02,
    paddingBottom: screenHeight * 0.01,
  },
  avatar: {
    width: screenWidth * 0.1,
    height: screenWidth * 0.1,
    borderRadius: screenWidth * 0.05,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    marginLeft: screenWidth * 0.02,
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    color: '#333',
  },
  logoWrapper: {
    padding: 2,
  },
  logoContainer: {
    width: screenWidth * 0.1,
    height: screenWidth * 0.1,
    borderRadius: (screenWidth * 0.1) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: '70%',
    height: '70%',
    resizeMode: 'contain',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
    marginRight: 12,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF5733',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  notificationBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: screenWidth * 0.037,
    marginHorizontal: screenWidth * 0.05,
    paddingHorizontal: screenWidth * 0.037,
    paddingVertical: screenHeight * 0.012,
    marginTop: screenHeight * 0.012,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: screenWidth * 0.025,
  },
  searchInputPlaceholder: {
    flex: 1,
    fontSize: screenWidth * 0.04,
    color: '#888',
  },
  section: {
    marginTop: screenHeight * 0.03,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenWidth * 0.05,
  },
  sectionTitle: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: screenWidth * 0.05,
  },
  seeAllButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.01,
    borderRadius: 15,
  },
  seeAllText: {
    fontSize: screenWidth * 0.035,
    fontWeight: '600',
  },
  suggestedCard: {
    width: screenWidth * 0.7,
    height: screenHeight * 0.22,
    marginLeft: screenWidth * 0.05,
    marginTop: screenHeight * 0.018,
    justifyContent: 'flex-end',
  },
  suggestedCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: screenWidth * 0.05,
  },
  ratingContainer: {
    position: 'absolute',
    top: screenHeight * 0.018,
    left: screenWidth * 0.037,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: screenWidth * 0.02,
    paddingVertical: screenHeight * 0.005,
    borderRadius: screenWidth * 0.03,
  },
  ratingText: {
    color: '#fff',
    marginLeft: screenWidth * 0.012,
    fontWeight: 'bold',
    fontSize: screenWidth * 0.035,
  },
  suggestedCardContent: {
    padding: screenWidth * 0.037,
  },
  suggestedTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    color: '#fff',
  },
  suggestedLocation: {
    fontSize: screenWidth * 0.035,
    color: '#fff',
  },
  saveButton: {
    position: 'absolute',
    bottom: screenHeight * 0.018,
    right: screenWidth * 0.037,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: screenWidth * 0.02,
    borderRadius: screenWidth * 0.05,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: screenWidth * 0.037,
    marginHorizontal: screenWidth * 0.05,
    marginTop: screenHeight * 0.018,
    padding: screenWidth * 0.025,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  placeImage: {
    width: screenWidth * 0.2,
    height: screenWidth * 0.2,
    borderRadius: screenWidth * 0.025,
  },
  placeInfo: {
    flex: 1,
    marginLeft: screenWidth * 0.037,
  },
  placeName: {
    fontSize: screenWidth * 0.04,
    fontWeight: 'bold',
    color: '#333',
  },
  placeLocation: {
    fontSize: screenWidth * 0.032,
    color: '#666',
    marginTop: screenHeight * 0.005,
  },
  placeRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: screenHeight * 0.01,
  },
  placeRatingText: {
    marginLeft: screenWidth * 0.012,
    fontSize: screenWidth * 0.03,
    color: '#666',
  },
  placeCardSaveButton: {
    padding: screenWidth * 0.02,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: screenWidth * 0.05,
  },
  loadingText: {
    marginLeft: screenWidth * 0.02,
    fontSize: screenWidth * 0.04,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: screenWidth * 0.05,
  },
  emptyText: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    marginBottom: screenHeight * 0.02,
  },
  emptySubText: {
    fontSize: screenWidth * 0.035,
    color: '#888',
  },
  businessType: {
    fontSize: screenWidth * 0.035,
    color: '#667eea',
    marginTop: screenHeight * 0.005,
  },
  promoCard: {
    width: screenWidth * 0.7,
    height: screenHeight * 0.22,
    marginLeft: screenWidth * 0.05,
    marginTop: screenHeight * 0.018,
    justifyContent: 'flex-end',
  },
  promoCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: screenWidth * 0.05,
  },
  promoCardContent: {
    padding: screenWidth * 0.037,
  },
  promoTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    color: '#fff',
  },
  promoBusinessName: {
    fontSize: screenWidth * 0.035,
    color: '#fff',
    fontWeight: '600',
    marginBottom: screenHeight * 0.005,
    opacity: 0.9,
  },
  promoDescription: {
    fontSize: screenWidth * 0.032,
    color: '#fff',
    lineHeight: screenWidth * 0.045,
    marginBottom: screenHeight * 0.005,
  },
  promoBusinessType: {
    fontSize: screenWidth * 0.030,
    color: '#FFD700',
    fontWeight: '600',
  },
  promoValidUntil: {
    fontSize: screenWidth * 0.030,
    color: '#fff',
    opacity: 0.8,
    fontStyle: 'italic',
  },
  discountBadge: {
    position: 'absolute',
    top: screenHeight * 0.018,
    left: screenWidth * 0.037,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: screenWidth * 0.02,
    paddingVertical: screenHeight * 0.005,
    borderRadius: screenWidth * 0.03,
  },
  discountText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: screenWidth * 0.035,
  },
  promoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: screenHeight * 0.01,
  },
  loadingPromoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: screenWidth * 0.05,
    marginTop: screenHeight * 0.02,
  },
  emptyPromoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: screenWidth * 0.05,
    marginTop: screenHeight * 0.02,
  },
  businessNameBadge: {
    position: 'absolute',
    top: screenHeight * 0.018,
    right: screenWidth * 0.037,
    backgroundColor: '#FFD700',
    paddingHorizontal: screenWidth * 0.025,
    paddingVertical: screenHeight * 0.005,
    borderRadius: screenWidth * 0.02,
    elevation: 3,
  },
  businessNameText: {
    color: '#333',
    fontWeight: '700',
    fontSize: screenWidth * 0.034,
  },
  /* ===== Details Modal Styles ===== */
  detailsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    width: screenWidth * 0.85,
    maxHeight: screenHeight * 0.8,
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
    padding: screenWidth * 0.05,
  },
  detailsTitle: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: screenHeight * 0.005,
    textAlign: 'center',
  },
  detailsSectionLabel: {
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
    color: '#667eea',
    marginTop: screenHeight * 0.015,
  },
  detailsText: {
    fontSize: screenWidth * 0.036,
    color: '#333',
    marginTop: screenHeight * 0.005,
  },
  closeButtonModal: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
    zIndex: 2,
  },
  detailsSubtitle: {
    fontSize: screenWidth * 0.042,
    color: '#555',
    marginBottom: screenHeight * 0.002,
    textAlign: 'center',
  },
  detailsLocation: {
    fontSize: screenWidth * 0.038,
    color: '#777',
    marginBottom: screenHeight * 0.008,
  },
  detailsLocationLabel: {
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
    color: '#667eea',
    marginTop: screenHeight * 0.015,
    marginBottom: screenHeight * 0.005,
  },
  ratingRowModal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: screenHeight * 0.01,
  },
  ratingNumberModal: {
    marginLeft: screenWidth * 0.015,
    fontSize: screenWidth * 0.038,
    fontWeight: '600',
    color: '#333',
  },
  reviewsTextModal: {
    marginLeft: screenWidth * 0.015,
    fontSize: screenWidth * 0.032,
    color: '#667eea',
  },
  imageContainer: {
    position: 'relative',
    width: screenWidth * 0.75,
    height: screenHeight * 0.25,
    marginHorizontal: screenWidth * 0.05,
    marginTop: screenHeight * 0.02,
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
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  viewMapBtn: {
    marginTop: screenHeight * 0.02,
    width: '100%',
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: screenWidth * 0.05,
    paddingVertical: screenHeight * 0.018,
    borderRadius: screenWidth * 0.04,
  },
  viewMapText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: screenWidth * 0.04,
    marginLeft: screenWidth * 0.02,
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
    fontSize: 14,
    fontWeight: '600',
  },
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  reviewModalCard: {
    width: '95%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 18,
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
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  reviewModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  reviewModalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  reviewModalStars: {
    flexDirection: 'row',
    marginBottom: 16,
    justifyContent: 'center',
  },
  reviewModalInput: {
    width: '90%',
    minHeight: 60,
    backgroundColor: '#f3f3f7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 10,
    fontSize: 15,
    color: '#222',
    marginBottom: 18,
  },
  reviewModalButton: {
    backgroundColor: '#667eea',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 30,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    alignSelf: 'center',
  },
  reviewModalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  reviewCardDisplay: {
    alignItems: 'center',
    backgroundColor: '#f7f7fa',
    borderRadius: 12,
    margin: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  reviewCardLabel: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#667eea',
    marginBottom: 6,
  },
  reviewCardStars: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  reviewCardComment: {
    fontStyle: 'italic',
    color: '#444',
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'center',
  },
  reviewCardDate: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  placeImageContainer: {
    position: 'relative',
  },
  filterContainer: {
    paddingHorizontal: screenWidth * 0.05,
    marginTop: screenHeight * 0.015,
    marginBottom: screenHeight * 0.01,
  },
  filterScrollView: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.01,
    borderRadius: 20,
    marginRight: screenWidth * 0.025,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  filterButtonText: {
    fontSize: screenWidth * 0.035,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  filterButtonTextActive: {
    color: '#667eea',
  },
});

// --- Component ---
const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { theme, user, notifications, unreadNotificationCount } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [placesToVisit, setPlacesToVisit] = useState<any[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [suggestedPlaces, setSuggestedPlaces] = useState<any[]>([]);
  const [loadingSuggested, setLoadingSuggested] = useState(true);
  const [promosAndDeals, setPromosAndDeals] = useState<any[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [userReview, setUserReview] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [businessRatings, setBusinessRatings] = useState<{ [businessId: string]: { average: string, count: number } }>({});
  const [userLocation, setUserLocation] = useState<string>('Silay City'); // Default fallback
  const [locationLoading, setLocationLoading] = useState(true);
  const [savedBusinesses, setSavedBusinesses] = useState<string[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [filteredPlaces, setFilteredPlaces] = useState<any[]>([]);
  const [filteredSuggestedPlaces, setFilteredSuggestedPlaces] = useState<any[]>([]);

  const filterOptions = ['All', 'Coffee Shops', 'Tourist Spots', 'Restaurants'];

  // Filter places based on selected filter
  const applyFilter = (places: any[], filter: string) => {
    if (filter === 'All') {
      return places;
    }
    
    return places.filter(place => {
      const businessType = place.businessType?.toLowerCase() || '';
      
      switch (filter) {
        case 'Coffee Shops':
          return businessType.includes('coffee shop') || 
                 businessType.includes('coffee') || 
                 businessType.includes('cafe') || 
                 businessType.includes('café');
        case 'Tourist Spots':
          return businessType.includes('tourist spot') ||
                 businessType.includes('tourist') || 
                 businessType.includes('attraction') || 
                 businessType.includes('resort') || 
                 businessType.includes('hotel');
        case 'Restaurants':
          return businessType.includes('restaurant') || 
                 businessType.includes('food') || 
                 businessType.includes('dining');
        default:
          return true;
      }
    });
  };

  const lightGradient = ['#667eea', '#764ba2'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  // Get user's real location and extract city name
  const getUserLocation = async () => {
    try {
      setLocationLoading(true);
      console.log('📍 Requesting location permission...');
      
      // Request permission to access location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ Location permission denied');
        setUserLocation('Silay City'); // Fallback to default
        setLocationLoading(false);
        return;
      }

      console.log('✅ Location permission granted, getting current position...');
      
      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log('📍 Current position:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      // Reverse geocode to get address information
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        // Extract city name (try different fields for better compatibility)
        const city = address.city || address.district || address.subregion || address.region || 'Unknown City';
        console.log('🏙️ Detected city:', city);
        console.log('📍 Full address info:', address);
        
        setUserLocation(city);
      } else {
        console.log('⚠️ No address found for coordinates');
        setUserLocation('Silay City'); // Fallback
      }
    } catch (error) {
      console.error('❌ Error getting user location:', error);
      setUserLocation('Silay City'); // Fallback to default
    } finally {
      setLocationLoading(false);
    }
  };

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

  // Load suggested places from Firestore (limited for horizontal scroll)
  const loadSuggestedPlaces = async () => {
    try {
      setLoadingSuggested(true);
      const q = query(
        collection(db, 'businesses'),
        where('status', '==', 'approved'),
        where('displayInUserApp', '==', true),
        limit(6) // Limit to 6 for horizontal scroll
      );
      const querySnapshot = await getDocs(q);
      
      const businesses = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.businessName,
          location: data.businessAddress,
          rating: data.rating || '4.5',
          image: data.businessImages && data.businessImages.length > 0 
            ? data.businessImages[0] 
            : 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2487&auto=format&fit=crop',
          businessType: data.selectedType || data.businessType,
          contactNumber: data.contactNumber,
          businessHours: data.businessHours,
          businessLocation: data.businessLocation,
          allImages: data.businessImages || [],
          // Keep original business data for navigation
          name: data.businessName,
          reviews: data.reviews || '0 Reviews'
        };
      });
      
      setSuggestedPlaces(businesses.length > 0 ? businesses : fallbackSuggestedPlaces);
      setFilteredSuggestedPlaces(applyFilter(businesses.length > 0 ? businesses : fallbackSuggestedPlaces, selectedFilter));
      
      // Preload suggested places images
      const preloadPromises: Promise<void>[] = [];
      businesses.forEach(business => {
        if (business.image) {
          preloadPromises.push(preloadImage(business.image));
        }
      });
      
      Promise.all(preloadPromises).then(() => {
        console.log('✅ HomeScreen: Suggested places images preloaded successfully!');
      }).catch((error) => {
        console.log('⚠️ HomeScreen: Some suggested places images failed to preload:', error);
      });
    } catch (error) {
      console.error('Error loading suggested places:', error);
      // Fallback to dummy data if there's an error
      setSuggestedPlaces(fallbackSuggestedPlaces);
      setFilteredSuggestedPlaces(applyFilter(fallbackSuggestedPlaces, selectedFilter));
    } finally {
      setLoadingSuggested(false);
    }
  };

  // Load businesses from Firestore
  const loadPlacesToVisit = async () => {
    try {
      setLoadingPlaces(true);
      const q = query(
        collection(db, 'businesses'),
        where('status', '==', 'approved'),
        where('displayInUserApp', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      const businesses = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.businessName,
          location: data.businessAddress,
          rating: data.rating || '4.5',
          reviews: data.reviews || '0 Reviews',
          image: data.businessImages && data.businessImages.length > 0 
            ? data.businessImages[0] 
            : 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2487&auto=format&fit=crop',
          businessType: data.selectedType || data.businessType,
          contactNumber: data.contactNumber,
          businessHours: data.businessHours,
          businessLocation: data.businessLocation,
          allImages: data.businessImages || []
        };
      });
      
      setPlacesToVisit(businesses);
      setFilteredPlaces(applyFilter(businesses, selectedFilter));
      
      // Aggressively preload all business images immediately
      console.log('🚀 HomeScreen: Starting aggressive image preloading...');
      const preloadPromises: Promise<void>[] = [];
      
      businesses.forEach(business => {
        // Preload main image
        if (business.image) {
          preloadPromises.push(preloadImage(business.image));
        }
        // Preload all images
        if (business.allImages && business.allImages.length > 0) {
          business.allImages.forEach((imageUrl: string) => {
            preloadPromises.push(preloadImage(imageUrl));
          });
        }
      });
      
      // Wait for all images to preload
      Promise.all(preloadPromises).then(() => {
        console.log('✅ HomeScreen: All business images preloaded successfully!');
      }).catch((error) => {
        console.log('⚠️ HomeScreen: Some images failed to preload:', error);
      });
    } catch (error) {
      console.error('Error loading places to visit:', error);
      // Fallback to dummy data if there's an error
      const fallbackData = [
        {
          id: '1',
          name: 'El Ideal',
          location: '118 Rizal St, Silay City Heritage Zone, Silay City',
          rating: '4.9',
          reviews: '3.6K Reviews',
          image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2487&auto=format&fit=crop',
          businessType: 'Restaurant'
        }
      ];
      setPlacesToVisit(fallbackData);
      setFilteredPlaces(applyFilter(fallbackData, selectedFilter));
    } finally {
      setLoadingPlaces(false);
    }
  };

  // Load promotions from Firestore
  const loadPromosAndDeals = async () => {
    try {
      setLoadingPromos(true);
      console.log('🔄 HomeScreen: Starting to load promotions...');
      
      // First, try the complex query with orderBy (requires index)
      let q = query(
        collection(db, 'promotions'),
        where('displayInUserApp', '==', true),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      
      let querySnapshot;
      try {
        console.log('📊 HomeScreen: Attempting complex query with orderBy...');
        querySnapshot = await getDocs(q);
        console.log('✅ HomeScreen: Complex query succeeded!');
      } catch (indexError) {
        console.warn('⚠️ HomeScreen: Complex query failed (likely missing index), trying simple query:', indexError);
        
        // Fallback to simple query without orderBy
        q = query(
          collection(db, 'promotions'),
          where('displayInUserApp', '==', true),
          limit(10)
        );
        querySnapshot = await getDocs(q);
        console.log('✅ HomeScreen: Simple query succeeded!');
      }
      
      console.log(`📋 HomeScreen: Found ${querySnapshot.docs.length} promotions in database`);
      
      const promos = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('📄 HomeScreen: Processing promotion:', {
          id: doc.id,
          title: data.title,
          endDate: data.endDate,
          displayInUserApp: data.displayInUserApp
        });
        
        // Check if promotion is still valid
        const isExpired = new Date(data.endDate) < new Date();
        
        return {
          id: doc.id,
          title: data.title,
          businessName: data.businessName,
          description: data.description,
          validUntil: data.endDate,
          discount: data.discount,
          image: data.image,
          businessType: data.selectedType || data.businessType,
          isExpired: isExpired,
        };
      });
      
      // Sort manually if we used the simple query
      promos.sort((a, b) => new Date(b.validUntil || '').getTime() - new Date(a.validUntil || '').getTime());
      
      // Filter out expired promotions
      const activePromos = promos.filter(promo => !promo.isExpired);
      console.log(`🎯 HomeScreen: ${activePromos.length} active promotions after filtering expired ones`);
      
      setPromosAndDeals(activePromos);
      
      // Preload promo images too
      const promoPreloadPromises: Promise<void>[] = [];
      activePromos.forEach(promo => {
        if (promo.image) {
          promoPreloadPromises.push(preloadImage(promo.image));
        }
      });
      
      Promise.all(promoPreloadPromises).then(() => {
        console.log('✅ HomeScreen: All promo images preloaded successfully!');
      }).catch((error) => {
        console.log('⚠️ HomeScreen: Some promo images failed to preload:', error);
      });
    } catch (error: any) {
      console.error('❌ HomeScreen: Error loading promotions:', error);
      // Show more detailed error information
      if (error?.code === 'failed-precondition') {
        console.error('🚨 HomeScreen: Firebase index required! Create index for: displayInUserApp + createdAt');
      }
      // Fallback to empty array
      setPromosAndDeals([]);
    } finally {
      setLoadingPromos(false);
    }
  };

  // Update filtered places when filter changes
  useEffect(() => {
    setFilteredPlaces(applyFilter(placesToVisit, selectedFilter));
    setFilteredSuggestedPlaces(applyFilter(suggestedPlaces, selectedFilter));
  }, [selectedFilter, placesToVisit, suggestedPlaces]);

  useEffect(() => {
    getUserLocation(); // Get user's real location
    loadSavedBusinesses(); // Load saved businesses
    loadSuggestedPlaces();
    loadPlacesToVisit();
    loadPromosAndDeals();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([getUserLocation(), loadSavedBusinesses(), loadSuggestedPlaces(), loadPlacesToVisit(), loadPromosAndDeals()]).finally(() => {
      setRefreshing(false);
    });
  }, []);

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

  // Real-time listener for reviews of all loaded businesses
  useEffect(() => {
    if (!placesToVisit.length) return;
    const unsubscribes: (() => void)[] = [];
    placesToVisit.forEach((place) => {
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
  }, [placesToVisit]);

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={{flex: 1}}>
      <SafeAreaView style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme === 'dark' ? '#FFF' : '#333'}
            />
          }
        >
          {/* --- Header --- */}
          <View style={styles.header}>
            <View style={styles.locationContainer}>
              <Ionicons name="location-sharp" size={screenWidth * 0.06} color="#FF5733" />
              {locationLoading ? (
                <ActivityIndicator size="small" color={theme === 'dark' ? '#FFF' : '#333'} />
              ) : (
                <Text style={[styles.locationText, { color: theme === 'dark' ? '#FFF' : '#333' }]}>{userLocation}</Text>
              )}
            </View>
            <View style={styles.headerRightContainer}>
              <TouchableOpacity 
                style={styles.notificationButton}
                onPress={() => (navigation as any).navigate('NotificationScreen')}
              >
                <Ionicons name="notifications-outline" size={screenWidth * 0.06} color={theme === 'dark' ? '#FFF' : '#333'} />
                {/* Notification Badge */}
                {unreadNotificationCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoWrapper}>
                <View style={styles.logoContainer}>
                  <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* --- Filter Buttons --- */}
          <View style={styles.filterContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollView}
            >
              {filterOptions.map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterButton,
                    selectedFilter === filter && styles.filterButtonActive
                  ]}
                  onPress={() => setSelectedFilter(filter)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selectedFilter === filter && styles.filterButtonTextActive
                    ]}
                  >
                    {filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* --- Search Bar --- */}
          <TouchableOpacity onPress={() => navigation.navigate('SearchBarScreen')}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={screenWidth * 0.05} color="#888" style={styles.searchIcon} />
              <Text style={styles.searchInputPlaceholder}>Search establishment</Text>
            </View>
            </TouchableOpacity>

          {/* --- Suggested Places --- */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme === 'dark' ? '#FFF' : '#333' }]}>Suggested places</Text>
            {loadingSuggested ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={[styles.loadingText, { color: theme === 'dark' ? '#FFF' : '#333' }]}>
                  Loading suggested places...
                </Text>
              </View>
            ) : filteredSuggestedPlaces.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="business-outline" size={60} color="#999" />
                <Text style={[styles.emptyText, { color: theme === 'dark' ? '#CCC' : '#666' }]}>
                  {selectedFilter === 'All' 
                    ? 'No suggested places available' 
                    : `No ${selectedFilter.toLowerCase()} in suggestions`
                  }
                </Text>
                <Text style={[styles.emptySubText, { color: theme === 'dark' ? '#AAA' : '#888' }]}>
                  {selectedFilter === 'All' 
                    ? 'Check back later for suggestions!' 
                    : 'Try selecting a different filter!'
                  }
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredSuggestedPlaces}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedPlace(item);
                      setDetailsModalVisible(true);
                    }}
                  >
                    <View style={[styles.suggestedCard, { overflow: 'hidden', borderRadius: screenWidth * 0.05 }]}>
                      <CachedImage
                        source={{ uri: item.image }}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode="cover"
                      />
                      <View style={styles.suggestedCardOverlay} />
                      <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={screenWidth * 0.04} color="#FFD700" />
                        <Text style={styles.ratingText}>{item.rating}</Text>
                      </View>
                      <View style={styles.suggestedCardContent}>
                        <Text style={styles.suggestedTitle}>{item.title}</Text>
                        <Text style={styles.suggestedLocation}>{item.location}</Text>
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
                            size={screenWidth * 0.05} 
                            color={savedBusinesses.includes(item.id) ? "#FFD700" : "#fff"} 
                          />
                        </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>

          {/* --- Promos and Deals --- */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme === 'dark' ? '#FFF' : '#333' }]}>Promos & Deals</Text>
            {loadingPromos ? (
              <View style={styles.loadingPromoContainer}>
                <ActivityIndicator size="large" color={theme === 'light' ? '#667eea' : '#fff'} />
                <Text style={[styles.loadingText, { color: theme === 'dark' ? '#FFF' : '#333' }]}>
                  Loading promotions...
                </Text>
              </View>
            ) : promosAndDeals.length === 0 ? (
              <View style={styles.emptyPromoContainer}>
                <Ionicons name="pricetag-outline" size={60} color={theme === 'dark' ? '#CCC' : '#999'} />
                <Text style={[styles.emptyText, { color: theme === 'dark' ? '#CCC' : '#666' }]}>
                  No active promotions
                </Text>
                <Text style={[styles.emptySubText, { color: theme === 'dark' ? '#AAA' : '#888' }]}>
                  Check back later for new deals!
                </Text>
              </View>
            ) : (
              <FlatList
                data={promosAndDeals}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity>
                    <ImageBackground
                      source={{ uri: item.image }}
                      style={styles.promoCard}
                      imageStyle={{ borderRadius: screenWidth * 0.05 }}
                    >
                      <View style={styles.promoCardOverlay} />
                      
                      {/* Discount Badge */}
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>{item.discount}</Text>
                      </View>

                      {/* Business Name Badge */}
                      <View style={styles.businessNameBadge}>
                        <Text style={styles.businessNameText}>{item.businessName}</Text>
                      </View>
                      
                      <View style={styles.promoCardContent}>
                        <Text style={styles.promoTitle}>{item.title}</Text>
                        <Text style={styles.promoDescription} numberOfLines={2}>{item.description}</Text>
                        <View style={styles.promoFooter}>
                          <Text style={styles.promoBusinessType}>{item.businessType}</Text>
                          <Text style={styles.promoValidUntil}>Until {new Date(item.validUntil).toLocaleDateString()}</Text>
                        </View>
                      </View>
                    </ImageBackground>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>

          {/* --- Places to Visit --- */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme === 'dark' ? '#FFF' : '#333' }]}>Places to visit</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SearchBarScreen')}>
                <View style={styles.seeAllButton}>
                  <Text style={[styles.seeAllText, { color: theme === 'dark' ? '#FFF' : '#4B0082' }]}>See All</Text>
                </View>
              </TouchableOpacity>
            </View>
            
            {loadingPlaces ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={[styles.loadingText, { color: theme === 'dark' ? '#FFF' : '#333' }]}>
                  Loading places to visit...
                </Text>
              </View>
            ) : filteredPlaces.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="business-outline" size={60} color="#999" />
                <Text style={[styles.emptyText, { color: theme === 'dark' ? '#CCC' : '#666' }]}>
                  {selectedFilter === 'All' 
                    ? 'No businesses available yet' 
                    : `No ${selectedFilter.toLowerCase()} found`
                  }
                </Text>
                <Text style={[styles.emptySubText, { color: theme === 'dark' ? '#AAA' : '#888' }]}>
                  {selectedFilter === 'All' 
                    ? 'Check back later for new places to visit!' 
                    : 'Try selecting a different filter or check back later!'
                  }
                </Text>
              </View>
            ) : (
              filteredPlaces.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.placeCard}
                onPress={() => {
                  setSelectedPlace(item);
                  setDetailsModalVisible(true);
                }}
              >
                <View style={styles.placeImageContainer}>
                  <CachedImage
                    source={{ uri: item.image }} 
                    style={styles.placeImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.placeInfo}>
                  <Text style={styles.placeName}>{item.name}</Text>
                  <Text style={styles.placeLocation} numberOfLines={2}>
                    <Ionicons name="location-sharp" size={screenWidth * 0.035} color="#888" /> {item.location}
                  </Text>
                  <View style={styles.placeRating}>
                    <Ionicons name="star" size={screenWidth * 0.04} color="#FFD700" />
                    <Text style={styles.placeRatingText}>
                      {businessRatings[item.id]?.average || item.rating} ({businessRatings[item.id]?.count ?? item.reviews} {businessRatings[item.id]?.count === 1 ? 'Review' : 'Reviews'})
                    </Text>
                  </View>
                    {item.businessType && (
                      <Text style={styles.businessType}>
                        <Ionicons name="business" size={screenWidth * 0.035} color="#667eea" /> {item.businessType}
                      </Text>
                    )}
                </View>
                <TouchableOpacity 
                  style={styles.placeCardSaveButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleSaveBusiness(item.id);
                  }}
                >
                  <Ionicons 
                    name={savedBusinesses.includes(item.id) ? "bookmark" : "bookmark-outline"} 
                    size={screenWidth * 0.06} 
                    color={savedBusinesses.includes(item.id) ? "#667eea" : "#888"} 
                  />
                </TouchableOpacity>
              </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
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
                  data={selectedPlace.allImages && selectedPlace.allImages.length > 0 ? selectedPlace.allImages : [selectedPlace.image]}
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
                      {index === 0 && (selectedPlace.allImages?.length > 1 || selectedPlace.image) && (
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
                {selectedPlace.businessType ? (
                  <Text style={styles.detailsSubtitle}>{selectedPlace.businessType}</Text>
                ) : null}
                {selectedPlace.location ? (
                  <>
                    <Text style={styles.detailsLocationLabel}>Location</Text>
                    <Text style={styles.detailsLocation}>{selectedPlace.location}</Text>
                  </>
                ) : null}
                {/* Rating Row */}
                <View style={styles.ratingRowModal}>
                  <Ionicons name="star" size={20} color="#FFD700" />
                  <Text style={styles.ratingNumberModal}>{businessRatings[selectedPlace.id]?.average || selectedPlace.rating}</Text>
                  <Text style={styles.reviewsTextModal}>({businessRatings[selectedPlace.id]?.count ?? selectedPlace.reviews} {businessRatings[selectedPlace.id]?.count === 1 ? 'Review' : 'Reviews'})</Text>
                </View>
                <Text style={styles.detailsSectionLabel}>Business Hours</Text>
                <Text style={styles.detailsText}>{selectedPlace.businessHours}</Text>
                {/* View on Map Button */}
                { (selectedPlace.businessLocation || selectedPlace.location) && (
                  <TouchableOpacity
                    style={styles.viewMapBtn}
                    onPress={() => {
                      // Close the current modal first
                      setDetailsModalVisible(false);
                      
                      // Navigate to the Navigate tab with business data
                      navigation.navigate('Navigate', { business: selectedPlace });
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

export default HomeScreen; 