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
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import PointsService from '../../services/PointsService';
import { collection, query, getDocs, where, orderBy, limit, addDoc, doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import LoadingImage from '../../components/LoadingImage';
import NotificationService from '../../services/NotificationService';
import * as Location from 'expo-location';
import { useResponsive } from '../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView, ResponsiveCard, ResponsiveButton, ResponsiveImage } from '../../components';

// Get responsive dimensions dynamically
const getScreenDimensions = () => Dimensions.get('window');

// Ultimate image cache with base64 storage for instant display
const base64ImageCache = new Map<string, string>();
const imageStatusCache = new Map<string, { status: 'loading' | 'loaded' | 'error', promise?: Promise<void> }>();

// Function to clear cache for a specific image URL (useful when images are updated)
export const clearImageCache = (imageUrl: string) => {
  base64ImageCache.delete(imageUrl);
  imageStatusCache.delete(imageUrl);
};

// Function to clear all image cache (useful for debugging or when many images are updated)
export const clearAllImageCache = () => {
  base64ImageCache.clear();
  imageStatusCache.clear();
};

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
  DiscoverSilay: undefined;
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

// --- Component ---
const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { theme, user, notifications, unreadNotificationCount } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius } = useResponsive();
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
  const [userPoints, setUserPoints] = useState<number>(0);
  const [loyaltyPointsModalVisible, setLoyaltyPointsModalVisible] = useState(false);
  const [businessLoyaltyPoints, setBusinessLoyaltyPoints] = useState<any[]>([]);
  const [selectedBusinessForTransfer, setSelectedBusinessForTransfer] = useState<any | null>(null);
  const [transferPointsModalVisible, setTransferPointsModalVisible] = useState(false);
  const [pointsToTransfer, setPointsToTransfer] = useState<string>('');
  const [transferring, setTransferring] = useState(false);
  const pointsService = PointsService.getInstance();
  const [locationLoading, setLocationLoading] = useState(true);
  const [savedBusinesses, setSavedBusinesses] = useState<string[]>([]);
  const [userPreferences, setUserPreferences] = useState<string[]>([]);
  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // Get responsive values from hook for dynamic styles
  const { dimensions } = useResponsive();
  const screenWidth = dimensions.width;
  const screenHeight = dimensions.height;
  const isSmallScreen = screenWidth < 360;
  const isVerySmallScreen = screenWidth < 320;
  const minTouchTarget = 44;
  
  // Calculate status bar height for Android
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  // Add responsive padding top for Android to account for status bar
  const androidPaddingTop = Platform.OS === 'android' ? statusBarHeight + (spacing?.sm || 8) : 0;

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
      paddingHorizontal: isSmallScreen ? spacing.md : spacing.lg,
      paddingTop: Platform.OS === 'android' ? androidPaddingTop : spacing.lg,
      paddingBottom: spacing.sm,
      minHeight: 60, // Ensure header doesn't get too small
    },
    locationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    locationText: {
      marginLeft: spacing.xs,
    },
    logoWrapper: {
      padding: 2,
    },
    logoContainer: {
      width: iconSizes.xxxxl,
      height: iconSizes.xxxxl,
      borderRadius: iconSizes.xxxxl / 2,
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
    pointsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 215, 0, 0.15)',
      paddingHorizontal: isSmallScreen ? spacing.xs : spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.md,
      marginRight: spacing.sm,
      borderWidth: 1,
      borderColor: 'rgba(255, 215, 0, 0.3)',
      minHeight: 36, // Ensure touch target is adequate
    },
    pointsText: {
      marginLeft: spacing.xs,
      color: '#FFD700',
    },
    qrScannerButton: {
      position: 'relative',
      padding: spacing.sm,
      marginRight: spacing.sm,
      minWidth: 44, // Ensure touch target is at least 44px
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    notificationButton: {
      position: 'relative',
      padding: spacing.sm,
      marginRight: spacing.md,
      minWidth: 44, // Ensure touch target is at least 44px
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
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
      textAlign: 'center',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: borderRadius.lg,
      marginHorizontal: isSmallScreen ? spacing.md : spacing.lg,
      paddingHorizontal: isSmallScreen ? spacing.md : spacing.lg,
      paddingVertical: spacing.md,
      marginTop: spacing.md,
      minHeight: 44, // Ensure touch target is at least 44px
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    searchIcon: {
      marginRight: spacing.sm,
    },
    searchInputPlaceholder: {
      flex: 1,
    },
    section: {
      marginTop: isSmallScreen ? spacing.lg : spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: isSmallScreen ? spacing.md : spacing.lg,
    },
    sectionTitle: {
      paddingHorizontal: isSmallScreen ? spacing.md : spacing.lg,
    },
    seeAllButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 15,
      minHeight: 36, // Ensure button is tall enough
      justifyContent: 'center',
      alignItems: 'center',
    },
    seeAllText: {
      fontWeight: '600',
    },
    suggestedCard: {
      width: screenWidth * 0.7, // 70% of screen width
      aspectRatio: 1.2, // Maintain aspect ratio instead of fixed height
      minWidth: isVerySmallScreen ? 200 : 240,
      maxWidth: 320, // Prevent cards from getting too large on tablets
      marginLeft: spacing.lg,
      marginTop: spacing.md,
      justifyContent: 'flex-end',
    },
    suggestedCardOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.3)',
      borderRadius: borderRadius.lg,
    },
    ratingContainer: {
      position: 'absolute',
      top: spacing.md,
      left: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
    },
    ratingText: {
      color: '#fff',
      marginLeft: spacing.xs,
      fontWeight: 'bold',
    },
    suggestedCardContent: {
      padding: spacing.lg,
    },
    suggestedTitle: {
      fontWeight: 'bold',
      color: '#fff',
    },
    suggestedLocation: {
      color: '#fff',
    },
    saveButton: {
      position: 'absolute',
      bottom: spacing.md,
      right: spacing.lg,
      backgroundColor: 'rgba(0,0,0,0.3)',
      padding: spacing.xs,
      borderRadius: borderRadius.lg,
      minWidth: 44, // Ensure touch target is at least 44px
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: borderRadius.lg,
      marginHorizontal: isSmallScreen ? spacing.md : spacing.lg,
      marginTop: spacing.md,
      padding: isSmallScreen ? spacing.xs : spacing.sm,
      minHeight: 100, // Ensure card doesn't get too small
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    placeImage: {
      width: screenWidth * 0.2, // 20% of screen width
      aspectRatio: 1, // Square images
      minWidth: isVerySmallScreen ? 60 : 70,
      maxWidth: 100, // Prevent images from getting too large
      borderRadius: borderRadius.sm,
    },
    placeInfo: {
      flex: 1,
      marginLeft: spacing.lg,
    },
    placeName: {
      fontWeight: 'bold',
      color: '#333',
    },
    placeLocation: {
      color: '#666',
      marginTop: spacing.xs,
    },
    placeRating: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    placeRatingText: {
      marginLeft: spacing.xs,
      color: '#666',
    },
    placeCardSaveButton: {
      padding: spacing.xs,
      minWidth: 44, // Ensure touch target is at least 44px
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    loadingText: {
      marginLeft: spacing.xs,
      fontWeight: 'bold',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    emptyText: {
      fontWeight: 'bold',
      marginBottom: spacing.lg,
    },
    emptySubText: {
      color: '#888',
    },
    businessType: {
      color: '#667eea',
      marginTop: spacing.xs,
    },
    promoCard: {
      width: screenWidth * 0.7, // 70% of screen width
      aspectRatio: 1.2, // Maintain aspect ratio
      minWidth: isVerySmallScreen ? 200 : 240,
      maxWidth: 320, // Prevent cards from getting too large
      marginLeft: spacing.lg,
      marginTop: spacing.md,
      justifyContent: 'flex-end',
    },
    promoCardOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.3)',
      borderRadius: borderRadius.lg,
    },
    promoCardContent: {
      padding: spacing.lg,
    },
    promoTitle: {
      fontWeight: 'bold',
      color: '#fff',
    },
    promoBusinessName: {
      color: '#fff',
      fontWeight: '600',
      marginBottom: spacing.xs,
      opacity: 0.9,
    },
    promoDescription: {
      color: '#fff',
      lineHeight: fontSizes.md * 1.2,
      marginBottom: spacing.xs,
    },
    promoBusinessType: {
      color: '#FFD700',
      fontWeight: '600',
    },
    promoValidUntil: {
      color: '#fff',
      opacity: 0.8,
      fontStyle: 'italic',
    },
    discountBadge: {
      position: 'absolute',
      top: spacing.md,
      left: spacing.lg,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
    },
    discountText: {
      color: '#fff',
      fontWeight: 'bold',
    },
    promoFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    loadingPromoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
      marginTop: spacing.lg,
    },
    emptyPromoContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
      marginTop: spacing.lg,
    },
    businessNameBadge: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.lg,
      backgroundColor: '#FFD700',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.xs,
      elevation: 3,
    },
    businessNameText: {
      color: '#333',
      fontWeight: '700',
    },
    // Modal styles
    detailsOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailsContainer: {
      width: screenWidth * 0.9, // 90% of screen width
      maxWidth: 500, // Prevent modal from getting too wide on tablets
      maxHeight: screenHeight * 0.85, // 85% of screen height
      backgroundColor: '#fff',
      borderRadius: borderRadius.xl,
      overflow: 'hidden',
    },
    detailsImage: {
      width: '100%',
      aspectRatio: 16 / 9, // Responsive aspect ratio
      minHeight: isSmallScreen ? 150 : 200,
      resizeMode: 'cover',
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: '#000',
    },
    detailsContent: {
      padding: isSmallScreen ? spacing.md : spacing.lg,
    },
    detailsTitle: {
      fontWeight: 'bold',
      color: '#333',
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    detailsSectionLabel: {
      fontWeight: '600',
      color: '#667eea',
      marginTop: spacing.md,
    },
    detailsText: {
      color: '#333',
      marginTop: spacing.xs,
    },
    closeButtonModal: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      zIndex: 2,
      width: minTouchTarget,
      height: minTouchTarget,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderRadius: minTouchTarget / 2,
    },
    closeButtonText: {
      fontSize: fontSizes.xl,
      color: '#333',
      fontWeight: '600',
    },
    detailsSubtitle: {
      color: '#555',
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    detailsLocation: {
      color: '#777',
      marginBottom: spacing.sm,
    },
    detailsLocationLabel: {
      fontWeight: '600',
      color: '#667eea',
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    ratingRowModal: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    ratingNumberModal: {
      marginLeft: spacing.xs,
      fontWeight: '600',
      color: '#333',
    },
    reviewsTextModal: {
      marginLeft: spacing.xs,
      color: '#667eea',
    },
    imageContainer: {
      position: 'relative',
      width: screenWidth * 0.9, // 90% of screen width
      aspectRatio: 16 / 9, // Responsive aspect ratio
      minHeight: isSmallScreen ? 150 : 200,
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
    },
    carouselWrapper: {
      width: '100%',
      aspectRatio: 16 / 9, // Responsive aspect ratio
      minHeight: isSmallScreen ? 180 : 220,
      alignItems: 'center',
    },
    swipeIndicator: {
      position: 'absolute',
      right: 10,
      top: '50%',
      transform: [{ translateY: -20 }],
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderRadius: borderRadius.xl,
      padding: spacing.sm,
      alignItems: 'center',
    },
    swipeText: {
      color: '#fff',
      fontWeight: '500',
      marginTop: 2,
    },
    viewMapBtn: {
      marginTop: spacing.lg,
      width: '100%',
      backgroundColor: '#007AFF',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      minHeight: 44, // Ensure touch target is at least 44px
    },
    viewMapText: {
      color: '#fff',
      fontWeight: '600',
      marginLeft: spacing.xs,
    },
    viewReviewsBtn: {
      marginTop: spacing.md,
      width: '100%',
      backgroundColor: '#667eea',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: 12,
      minHeight: 44, // Ensure touch target is at least 44px
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    viewReviewsText: {
      color: '#fff',
      fontWeight: '600',
      marginLeft: spacing.xs,
      fontSize: 16,
    },
    reviewButtonDetails: {
      marginTop: spacing.md,
      width: '100%',
      backgroundColor: '#667eea',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      minHeight: 44, // Ensure touch target is at least 44px
    },
    reviewButtonDetailsDisabled: {
      backgroundColor: '#9E9E9E',
      opacity: 0.6,
    },
    reviewButtonDetailsText: {
      color: '#fff',
      fontWeight: '600',
      marginLeft: spacing.xs,
      fontSize: 16,
    },
    reviewButtonDetailsTextDisabled: {
      color: '#E0E0E0',
    },
    loyaltyModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
    },
    loyaltyModalContent: {
      width: screenWidth * 0.9,
      maxWidth: 500, // Prevent modal from getting too wide
      maxHeight: screenHeight * 0.85,
      backgroundColor: '#fff',
      borderRadius: 20,
      padding: isSmallScreen ? spacing.md : 20,
    },
    loyaltyModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    loyaltyModalTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    loyaltyModalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#333',
      marginLeft: 10,
    },
    loyaltyTotalContainer: {
      backgroundColor: 'rgba(255, 215, 0, 0.1)',
      borderRadius: 15,
      padding: isSmallScreen ? spacing.md : 20,
      alignItems: 'center',
      marginBottom: isSmallScreen ? spacing.md : 20,
      borderWidth: 2,
      borderColor: 'rgba(255, 215, 0, 0.3)',
    },
    loyaltyTotalLabel: {
      fontSize: 14,
      color: '#666',
      marginBottom: 5,
    },
    loyaltyTotalPoints: {
      fontSize: 36,
      fontWeight: 'bold',
      color: '#FFD700',
    },
    loyaltySectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#333',
      marginBottom: 15,
    },
    loyaltyList: {
      maxHeight: screenHeight * 0.4,
    },
    loyaltyBusinessCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#f5f5f5',
      borderRadius: 12,
      padding: isSmallScreen ? spacing.md : 15,
      marginBottom: isSmallScreen ? spacing.sm : 10,
      minHeight: 60, // Ensure card doesn't get too small
    },
    loyaltyBusinessInfo: {
      flex: 1,
      marginRight: 10,
    },
    loyaltyBusinessName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
      marginBottom: 5,
    },
    loyaltyBusinessScans: {
      fontSize: 12,
      color: '#666',
    },
    loyaltyBusinessRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    loyaltyBusinessPoints: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 20,
      paddingHorizontal: 15,
      paddingVertical: 8,
    },
    loyaltyBusinessPointsText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#FFD700',
      marginLeft: 5,
    },
    sendPointsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#667eea',
      borderRadius: 20,
      paddingHorizontal: isSmallScreen ? spacing.xs : 12,
      paddingVertical: 8,
      minHeight: 36, // Ensure touch target is adequate
      gap: 5,
    },
    sendPointsButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    transferModalContent: {
      width: screenWidth * 0.9,
      maxWidth: 500, // Prevent modal from getting too wide
      maxHeight: screenHeight * 0.75,
      backgroundColor: '#fff',
      borderRadius: 20,
      padding: isSmallScreen ? spacing.md : 20,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      zIndex: 10000,
      overflow: 'visible',
    },
    transferBusinessInfo: {
      backgroundColor: 'rgba(102, 126, 234, 0.1)',
      borderRadius: 12,
      padding: isSmallScreen ? spacing.md : 15,
      marginBottom: isSmallScreen ? spacing.md : 20,
    },
    transferBusinessName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333',
      marginBottom: 8,
    },
    transferBusinessPoints: {
      fontSize: 14,
      color: '#666',
    },
    transferBusinessPointsValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#FFD700',
    },
    transferLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
      marginBottom: 10,
    },
    transferInputContainer: {
      marginBottom: 20,
    },
    transferInput: {
      borderWidth: 3,
      borderColor: '#667eea',
      borderRadius: 12,
      padding: isSmallScreen ? spacing.md : 18,
      fontSize: isSmallScreen ? fontSizes.xl : 24,
      fontWeight: 'bold',
      backgroundColor: '#f0f0f0',
      color: '#000',
      minHeight: 60,
      textAlign: 'center',
      width: '100%',
    },
    transferButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#667eea',
      borderRadius: 12,
      padding: isSmallScreen ? spacing.md : 15,
      minHeight: 44, // Ensure touch target is at least 44px
      gap: 8,
    },
    transferButtonDisabled: {
      backgroundColor: '#ccc',
      opacity: 0.6,
    },
    transferButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    loyaltyEmptyContainer: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    loyaltyEmptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#666',
      marginTop: 15,
    },
    loyaltyEmptySubtext: {
      fontSize: 14,
      color: '#999',
      marginTop: 5,
    },
    // Additional responsive styles
    linearGradient: {
      flex: 1,
    },
    reviewModalLoadingContainer: {
      marginTop: 30,
    },
    reviewModalContentContainer: {
      alignItems: 'center',
      marginTop: 10,
    },
    reviewModalStarContainer: {
      marginHorizontal: 2,
    },
    transferModalEmptyContainer: {
      padding: isSmallScreen ? spacing.md : 20,
    },
    transferModalEmptyText: {
      color: '#000',
    },
    transactionHistoryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(102, 126, 234, 0.1)',
      borderRadius: 12,
      padding: isSmallScreen ? spacing.md : 15,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: 'rgba(102, 126, 234, 0.3)',
      minHeight: 44, // Ensure touch target is at least 44px
    },
    transactionHistoryButtonText: {
      flex: 1,
      marginLeft: 10,
      fontSize: 16,
      fontWeight: '600',
      color: '#667eea',
    },
    reviewModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: isSmallScreen ? spacing.md : spacing.lg,
    },
    reviewModalCard: {
      width: screenWidth * 0.95,
      maxWidth: 400,
      minWidth: isVerySmallScreen ? 280 : 300, // Ensure modal doesn't get too small
      backgroundColor: '#fff',
      borderRadius: borderRadius.xl,
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
      paddingHorizontal: isSmallScreen ? spacing.md : spacing.lg,
      paddingVertical: isSmallScreen ? spacing.md : spacing.lg,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      minHeight: 56, // Ensure header doesn't get too small
    },
    reviewModalTitle: {
      color: '#fff',
      fontWeight: 'bold',
      flex: 1,
    },
    reviewModalLabel: {
      fontWeight: '600',
      marginBottom: spacing.sm,
      color: '#333',
    },
    reviewModalStars: {
      flexDirection: 'row',
      marginBottom: spacing.lg,
      justifyContent: 'center',
    },
    reviewModalInput: {
      width: '90%',
      minHeight: 60,
      backgroundColor: '#f3f3f7',
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: '#e0e0e0',
      padding: spacing.sm,
      color: '#222',
      marginBottom: spacing.lg,
      fontSize: fontSizes.md, // Use responsive font size
    },
    reviewModalButton: {
      backgroundColor: '#667eea',
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      alignSelf: 'center',
      minWidth: 120, // Ensure button is wide enough
      minHeight: 44, // Ensure touch target is at least 44px
    },
    reviewModalButtonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
    reviewCardDisplay: {
      alignItems: 'center',
      backgroundColor: '#f7f7fa',
      borderRadius: borderRadius.md,
      margin: isSmallScreen ? spacing.md : spacing.lg,
      padding: isSmallScreen ? spacing.md : spacing.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
    },
    reviewCardLabel: {
      fontWeight: 'bold',
      color: '#667eea',
      marginBottom: spacing.xs,
    },
    reviewCardStars: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
    },
    reviewCardComment: {
      fontStyle: 'italic',
      color: '#444',
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    reviewCardDate: {
      color: '#888',
      marginBottom: spacing.sm,
    },
    placeImageContainer: {
      position: 'relative',
    },
    // Reviews section styles
    reviewsSection: {
      marginTop: isSmallScreen ? spacing.lg : spacing.xl,
      paddingHorizontal: isSmallScreen ? spacing.md : spacing.lg,
    },
    reviewsSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    reviewCard: {
      backgroundColor: '#fff',
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      borderLeftWidth: 3,
      borderLeftColor: '#667eea',
    },
    reviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    reviewUserInfo: {
      flex: 1,
    },
    reviewUserName: {
      fontWeight: '600',
      color: '#333',
    },
    reviewBusinessName: {
      color: '#667eea',
      marginTop: spacing.xs,
    },
    reviewStarsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    reviewComment: {
      color: '#555',
      lineHeight: fontSizes.md * 1.4,
      marginBottom: spacing.sm,
    },
    reviewDate: {
      color: '#888',
    },
    reviewsLoadingContainer: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    reviewsEmptyContainer: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    reviewsEmptyText: {
      color: '#888',
      marginTop: spacing.sm,
    },
    // Discover Silay styles
    discoverSilayCard: {
      marginHorizontal: isSmallScreen ? spacing.md : spacing.lg,
      marginTop: spacing.md,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
    discoverSilayImage: {
      width: '100%',
      aspectRatio: 2.5, // Responsive aspect ratio
      minHeight: isSmallScreen ? 120 : 150,
      justifyContent: 'flex-end',
    },
    discoverSilayOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    discoverSilayContent: {
      padding: spacing.lg,
    },
    discoverSilayTitle: {
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: spacing.xs,
    },
    discoverSilaySubtitle: {
      color: '#fff',
      opacity: 0.9,
      marginBottom: spacing.sm,
    },
    discoverSilayDescription: {
      color: '#fff',
      opacity: 0.8,
      lineHeight: fontSizes.xs * 1.3,
    },
    discoverSilayBadge: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
    },
    discoverSilayBadgeText: {
      marginLeft: spacing.xs,
      fontWeight: 'bold',
    },
  });


  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
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

  // Load user preferences
  const loadUserPreferences = async () => {
    if (!user?.uid) return;
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          setUserPreferences(userData.preferences || []);
          console.log('✅ User preferences loaded:', userData.preferences);
        }
      });
      
      return unsubscribe;
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  // Apply preference-based filtering and sorting
  const applyPreferenceFilter = (places: any[]) => {
    if (!userPreferences || userPreferences.length === 0) {
      return places; // No preferences set, return all places
    }

    // Filter places to only show those matching user preferences
    const filtered = places.filter((place) => {
      const placeCategories = place.categories || [];
      const placeBusinessType = place.businessType || '';
      
      // Check if any of the place's categories or business type match user preferences
      const categoryMatch = placeCategories.some((cat: string) => 
        userPreferences.some((pref: string) => 
          cat.toLowerCase().includes(pref.toLowerCase()) || 
          pref.toLowerCase().includes(cat.toLowerCase())
        )
      );
      
      const typeMatch = userPreferences.some((pref: string) => 
        placeBusinessType.toLowerCase().includes(pref.toLowerCase()) ||
        pref.toLowerCase().includes(placeBusinessType.toLowerCase())
      );
      
      return categoryMatch || typeMatch;
    });

    // If no matches found, return all places (fallback)
    if (filtered.length === 0) {
      return places;
    }

    // Sort places: preferred categories first, then others
    return filtered.sort((a, b) => {
      // Check if any of the business's categories match user preferences
      const aCategories = a.categories || [];
      const bCategories = b.categories || [];
      
      const aMatches = aCategories.some((cat: string) => 
        userPreferences.some((pref: string) => 
          cat.toLowerCase().includes(pref.toLowerCase()) || 
          pref.toLowerCase().includes(cat.toLowerCase())
        )
      );
      const bMatches = bCategories.some((cat: string) => 
        userPreferences.some((pref: string) => 
          cat.toLowerCase().includes(pref.toLowerCase()) || 
          pref.toLowerCase().includes(cat.toLowerCase())
        )
      );
      
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return 0;
    });
  };

  // Load suggested places from Firestore (limited for horizontal scroll)
  const loadSuggestedPlaces = async () => {
    try {
      setLoadingSuggested(true);
      // Load more businesses initially to ensure we have enough after preference filtering
      const limitCount = userPreferences && userPreferences.length > 0 ? 20 : 6;
      const q = query(
        collection(db, 'businesses'),
        where('status', '==', 'approved'),
        where('displayInUserApp', '==', true),
        limit(limitCount)
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
          categories: data.selectedCategories || (data.selectedCategory ? [data.selectedCategory] : []),
          contactNumber: data.contactNumber,
          businessHours: data.businessHours,
          businessLocation: data.businessLocation,
          allImages: data.businessImages || [],
          // Keep original business data for navigation
          name: data.businessName,
          reviews: data.reviews || '0 Reviews'
        };
      });
      
      // Apply preference-based filtering
      const preferenceFiltered = applyPreferenceFilter(businesses.length > 0 ? businesses : fallbackSuggestedPlaces);
      
      // Sort by rating (highest first) - initial sort based on business data rating
      const sorted = [...preferenceFiltered].sort((a, b) => {
        const ratingA = parseFloat(a.rating || '0');
        const ratingB = parseFloat(b.rating || '0');
        return ratingB - ratingA;
      });
      
      // Limit to 6 places for horizontal scroll
      setSuggestedPlaces(sorted.slice(0, 6));
      
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
          categories: data.selectedCategories || (data.selectedCategory ? [data.selectedCategory] : []),
          contactNumber: data.contactNumber,
          businessHours: data.businessHours,
          businessLocation: data.businessLocation,
          allImages: data.businessImages || []
        };
      });
      
      // Apply preference-based filtering
      const preferenceFiltered = applyPreferenceFilter(businesses);
      
      setPlacesToVisit(preferenceFiltered);
      
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


  // Load user points
  const loadUserPoints = async () => {
    if (!user?.uid) return;
    try {
      const totalPoints = await pointsService.getTotalPoints(user.uid);
      setUserPoints(totalPoints);
      
      // Load business loyalty points
      const loyaltyPoints = await pointsService.getBusinessLoyaltyPoints(user.uid);
      setBusinessLoyaltyPoints(loyaltyPoints);
    } catch (error) {
      console.error('Error loading user points:', error);
    }
  };

  // Set up real-time listener for user points
  useEffect(() => {
    if (!user?.uid) return;

    loadUserPoints();

    // Set up real-time listener for points updates
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data();
        const points = userData.points?.totalPoints || 0;
        const loyaltyPoints = userData.points?.businessLoyaltyPoints || [];
        setUserPoints(points);
        setBusinessLoyaltyPoints(loyaltyPoints);
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    getUserLocation(); // Get user's real location
    loadSavedBusinesses(); // Load saved businesses
    loadUserPreferences(); // Load user preferences
    loadSuggestedPlaces();
    loadPlacesToVisit();
    loadPromosAndDeals();
    loadAllReviews(); // Load all reviews
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([getUserLocation(), loadSavedBusinesses(), loadUserPreferences(), loadSuggestedPlaces(), loadPlacesToVisit(), loadPromosAndDeals(), loadAllReviews(), loadUserPoints()]).finally(() => {
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

  // Check if user has already reviewed a business
  const checkIfUserReviewed = async (businessId: string): Promise<boolean> => {
    if (!user?.uid) return false;
    try {
      const reviewsRef = collection(db, 'businesses', businessId, 'reviews');
      const reviewQuery = query(reviewsRef, where('userId', '==', user.uid));
      const reviewSnapshot = await getDocs(reviewQuery);
      return !reviewSnapshot.empty;
    } catch (error) {
      console.error('Error checking user review:', error);
      return false;
    }
  };

  // Load all reviews from all businesses
  const loadAllReviews = async () => {
    try {
      setLoadingReviews(true);
      const allReviewsList: any[] = [];
      
      // Get all approved businesses
      const businessesQuery = query(
        collection(db, 'businesses'),
        where('status', '==', 'approved'),
        where('displayInUserApp', '==', true)
      );
      const businessesSnapshot = await getDocs(businessesQuery);
      
      // For each business, get their reviews
      for (const businessDoc of businessesSnapshot.docs) {
        const businessData = businessDoc.data();
        const reviewsRef = collection(db, 'businesses', businessDoc.id, 'reviews');
        const reviewsSnapshot = await getDocs(reviewsRef);
        
        reviewsSnapshot.forEach(reviewDoc => {
          const reviewData = reviewDoc.data();
          allReviewsList.push({
            id: reviewDoc.id,
            businessId: businessDoc.id,
            businessName: businessData.businessName,
            ...reviewData,
          });
        });
      }
      
      // Sort by date (newest first) and limit to 5
      allReviewsList.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      
      setAllReviews(allReviewsList.slice(0, 5));
      console.log('✅ Loaded', allReviewsList.length, 'total reviews');
    } catch (error) {
      console.error('Error loading reviews:', error);
      setAllReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Real-time listener for reviews of all loaded businesses
  useEffect(() => {
    if (!placesToVisit.length && !suggestedPlaces.length) return;
    const unsubscribes: (() => void)[] = [];
    
    // Listen to reviews for places to visit
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
    
    // Listen to reviews for suggested places
    suggestedPlaces.forEach((place) => {
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
  }, [placesToVisit, suggestedPlaces]);

  // Sort suggested places by real ratings when businessRatings updates
  useEffect(() => {
    if (suggestedPlaces.length > 0) {
      const sorted = [...suggestedPlaces].sort((a, b) => {
        const ratingA = parseFloat(businessRatings[a.id]?.average || a.rating || '0');
        const ratingB = parseFloat(businessRatings[b.id]?.average || b.rating || '0');
        return ratingB - ratingA; // Highest first
      });
      // Only update if order actually changed to avoid infinite loop
      const currentIds = suggestedPlaces.map(p => p.id).join(',');
      const sortedIds = sorted.map(p => p.id).join(',');
      if (currentIds !== sortedIds) {
        setSuggestedPlaces(sorted);
      }
    }
  }, [businessRatings]);

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.linearGradient}>
      <SafeAreaView style={styles.container}>
          <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingBottom: spacing?.xl || 24,
            paddingHorizontal: 0, // Let individual components handle padding
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme === 'dark' ? '#FFF' : '#333'}
            />
          }
        >
          {/* --- Header --- */}
          <ResponsiveView style={styles.header}>
            <ResponsiveView style={styles.locationContainer}>
              <Ionicons name="location-sharp" size={iconSizes.lg} color="#FF5733" />
              {locationLoading ? (
                <ActivityIndicator size="small" color={theme === 'dark' ? '#FFF' : '#333'} />
              ) : (
                <ResponsiveText size="md" weight="bold" color={theme === 'dark' ? '#FFF' : '#333'} style={styles.locationText}>
                  {userLocation}
                </ResponsiveText>
              )}
            </ResponsiveView>
            <ResponsiveView style={styles.headerRightContainer}>
              {/* Points Display */}
              {user && (
                <TouchableOpacity 
                  style={styles.pointsContainer}
                  onPress={() => setLoyaltyPointsModalVisible(true)}
                >
                  <Ionicons name="trophy" size={iconSizes.md} color="#FFD700" />
                  <ResponsiveText size="sm" weight="bold" color={theme === 'dark' ? '#FFF' : '#333'} style={styles.pointsText}>
                    {userPoints}
                  </ResponsiveText>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.qrScannerButton}
                onPress={() => (navigation as any).navigate('QRScannerScreen')}
              >
                <Ionicons name="qr-code-outline" size={iconSizes.lg} color={theme === 'dark' ? '#FFF' : '#333'} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.notificationButton}
                onPress={() => (navigation as any).navigate('NotificationScreen')}
              >
                <Ionicons name="notifications-outline" size={iconSizes.lg} color={theme === 'dark' ? '#FFF' : '#333'} />
                {/* Notification Badge */}
                {unreadNotificationCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <ResponsiveText size="xs" weight="bold" color="#FFF" style={styles.notificationBadgeText}>
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </ResponsiveText>
                  </View>
                )}
              </TouchableOpacity>
            </ResponsiveView>
          </ResponsiveView>


          {/* --- Search Bar --- */}
          <TouchableOpacity onPress={() => navigation.navigate('SearchBarScreen')}>
            <ResponsiveView style={styles.searchContainer}>
              <Ionicons name="search" size={iconSizes.md} color="#888" style={styles.searchIcon} />
              <ResponsiveText size="md" color="#888" style={styles.searchInputPlaceholder}>
                Search establishment
              </ResponsiveText>
            </ResponsiveView>
          </TouchableOpacity>

          {/* --- Suggested Places --- */}
          <ResponsiveView style={styles.section}>
            <ResponsiveText size="lg" weight="bold" color={theme === 'dark' ? '#FFF' : '#000'} style={styles.sectionTitle}>
              Suggested places
            </ResponsiveText>
            {loadingSuggested ? (
              <ResponsiveView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <ResponsiveText size="md" weight="bold" color={theme === 'dark' ? '#FFF' : '#333'} style={styles.loadingText}>
                  Loading suggested places...
                </ResponsiveText>
              </ResponsiveView>
            ) : suggestedPlaces.length === 0 ? (
              <ResponsiveView style={styles.emptyContainer}>
                <Ionicons name="business-outline" size={iconSizes.xxxxl} color="#999" />
                <ResponsiveText size="lg" weight="bold" color={theme === 'dark' ? '#CCC' : '#666'} style={styles.emptyText}>
                  No suggested places available
                </ResponsiveText>
                <ResponsiveText size="md" color={theme === 'dark' ? '#AAA' : '#888'} style={styles.emptySubText}>
                  Check back later for suggestions!
                </ResponsiveText>
              </ResponsiveView>
            ) : (
              <FlatList
                data={suggestedPlaces}
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
                    <View style={[styles.suggestedCard, { overflow: 'hidden', borderRadius: borderRadius.lg }]}>
                      <CachedImage
                        source={{ uri: item.image }}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode="cover"
                      />
                      <View style={styles.suggestedCardOverlay} />
                      <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={iconSizes.sm} color="#FFD700" />
                        <ResponsiveText size="sm" weight="bold" color="#fff" style={styles.ratingText}>
                          {businessRatings[item.id]?.average || item.rating || '0.0'}
                        </ResponsiveText>
                      </View>
                      <View style={styles.suggestedCardContent}>
                        <ResponsiveText size="md" weight="bold" color="#fff" style={styles.suggestedTitle}>
                          {item.title}
                        </ResponsiveText>
                        <ResponsiveText size="sm" color="#fff" style={styles.suggestedLocation}>
                          {item.location}
                        </ResponsiveText>
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
                            size={iconSizes.md} 
                            color={savedBusinesses.includes(item.id) ? "#FFD700" : "#fff"} 
                          />
                        </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </ResponsiveView>

          {/* --- Discover Silay --- */}
          <ResponsiveView style={styles.section}>
            <ResponsiveText size="lg" weight="bold" color={theme === 'dark' ? '#FFF' : '#000'} style={styles.sectionTitle}>
              Discover Silay City
            </ResponsiveText>
            <TouchableOpacity
              style={styles.discoverSilayCard}
              onPress={() => {
                navigation.navigate('DiscoverSilay');
              }}
            >
              <ImageBackground
                source={require('../../assets/silay.jpeg')}
                style={styles.discoverSilayImage}
                imageStyle={{ borderRadius: borderRadius.lg }}
              >
                <View style={styles.discoverSilayOverlay} />
                <View style={styles.discoverSilayContent}>
                  <ResponsiveText size="lg" weight="bold" color="#fff" style={styles.discoverSilayTitle}>
                    Silay City
                  </ResponsiveText>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          </ResponsiveView>

          {/* --- Promos and Deals --- */}
          <ResponsiveView style={styles.section}>
            <ResponsiveText size="lg" weight="bold" color={theme === 'dark' ? '#FFF' : '#000'} style={styles.sectionTitle}>
              Promos & Deals
            </ResponsiveText>
            {loadingPromos ? (
              <ResponsiveView style={styles.loadingPromoContainer}>
                <ActivityIndicator size="large" color={theme === 'light' ? '#667eea' : '#fff'} />
                <ResponsiveText size="md" weight="bold" color={theme === 'dark' ? '#FFF' : '#333'} style={styles.loadingText}>
                  Loading promotions...
                </ResponsiveText>
              </ResponsiveView>
            ) : promosAndDeals.length === 0 ? (
              <ResponsiveView style={styles.emptyPromoContainer}>
                <Ionicons name="pricetag-outline" size={iconSizes.xxxxl} color={theme === 'dark' ? '#CCC' : '#999'} />
                <ResponsiveText size="lg" weight="bold" color={theme === 'dark' ? '#CCC' : '#666'} style={styles.emptyText}>
                  No active promotions
                </ResponsiveText>
                <ResponsiveText size="md" color={theme === 'dark' ? '#AAA' : '#888'} style={styles.emptySubText}>
                  Check back later for new deals!
                </ResponsiveText>
              </ResponsiveView>
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
                      imageStyle={{ borderRadius: borderRadius.lg }}
                      resizeMode="cover"
                    >
                      <View style={styles.promoCardOverlay} />
                      
                      {/* Discount Badge */}
                      <View style={styles.discountBadge}>
                        <ResponsiveText size="sm" weight="bold" color="#fff" style={styles.discountText}>
                          {item.discount}
                        </ResponsiveText>
                      </View>

                      {/* Business Name Badge */}
                      <View style={styles.businessNameBadge}>
                        <ResponsiveText size="sm" weight="700" color="#333" style={styles.businessNameText}>
                          {item.businessName}
                        </ResponsiveText>
                      </View>
                      
                      <View style={styles.promoCardContent}>
                        <ResponsiveText size="md" weight="bold" color="#fff" style={styles.promoTitle}>
                          {item.title}
                        </ResponsiveText>
                        <ResponsiveText size="sm" color="#fff" style={styles.promoDescription} numberOfLines={2}>
                          {item.description}
                        </ResponsiveText>
                        <View style={styles.promoFooter}>
                          <ResponsiveText size="xs" weight="600" color="#FFD700" style={styles.promoBusinessType}>
                            {item.businessType}
                          </ResponsiveText>
                          <ResponsiveText size="xs" color="#fff" style={styles.promoValidUntil}>
                            Until {new Date(item.validUntil).toLocaleDateString()}
                          </ResponsiveText>
                        </View>
                      </View>
                    </ImageBackground>
                  </TouchableOpacity>
                )}
              />
            )}
          </ResponsiveView>

          {/* --- Places to Visit --- */}
          <ResponsiveView style={styles.section}>
            <ResponsiveView style={styles.sectionHeader}>
              <ResponsiveText size="lg" weight="bold" color={theme === 'dark' ? '#FFF' : '#000'} style={styles.sectionTitle}>
                Places to visit
              </ResponsiveText>
              <TouchableOpacity onPress={() => navigation.navigate('SearchBarScreen')}>
                <View style={styles.seeAllButton}>
                  <ResponsiveText size="sm" weight="600" color={theme === 'dark' ? '#FFF' : '#4B0082'} style={styles.seeAllText}>
                    See All
                  </ResponsiveText>
                </View>
              </TouchableOpacity>
            </ResponsiveView>
            
            {loadingPlaces ? (
              <ResponsiveView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <ResponsiveText size="md" weight="bold" color={theme === 'dark' ? '#FFF' : '#333'} style={styles.loadingText}>
                  Loading places to visit...
                </ResponsiveText>
              </ResponsiveView>
            ) : placesToVisit.length === 0 ? (
              <ResponsiveView style={styles.emptyContainer}>
                <Ionicons name="business-outline" size={iconSizes.xxxxl} color="#999" />
                <ResponsiveText size="lg" weight="bold" color={theme === 'dark' ? '#CCC' : '#666'} style={styles.emptyText}>
                  No businesses available yet
                </ResponsiveText>
                <ResponsiveText size="md" color={theme === 'dark' ? '#AAA' : '#888'} style={styles.emptySubText}>
                  Check back later for new places to visit!
                </ResponsiveText>
              </ResponsiveView>
            ) : (
              placesToVisit.slice(0, 3).map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.placeCard}
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
                  // Fetch user review when place is selected
                  if (user?.uid && item.id) {
                    fetchUserReview(item.id);
                  }
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
                  <ResponsiveText size="md" weight="bold" color="#333" style={styles.placeName}>
                    {item.name}
                  </ResponsiveText>
                  <ResponsiveText size="sm" color="#666" style={styles.placeLocation} numberOfLines={2}>
                    <Ionicons name="location-sharp" size={iconSizes.xs} color="#888" /> {item.location}
                  </ResponsiveText>
                  <View style={styles.placeRating}>
                    <Ionicons name="star" size={iconSizes.sm} color="#FFD700" />
                    <ResponsiveText size="xs" color="#666" style={styles.placeRatingText}>
                      {businessRatings[item.id]?.average || item.rating} ({businessRatings[item.id]?.count ?? item.reviews} {businessRatings[item.id]?.count === 1 ? 'Review' : 'Reviews'})
                    </ResponsiveText>
                  </View>
                    {item.businessType && (
                      <ResponsiveText size="xs" color="#667eea" style={styles.businessType}>
                        <Ionicons name="business" size={iconSizes.xs} color="#667eea" /> {item.businessType}
                      </ResponsiveText>
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
                    size={iconSizes.md} 
                    color={savedBusinesses.includes(item.id) ? "#667eea" : "#888"} 
                  />
                </TouchableOpacity>
              </TouchableOpacity>
              ))
            )}
          </ResponsiveView>

          {/* --- Reviews Section --- */}
          <ResponsiveView style={styles.reviewsSection}>
            <ResponsiveView style={styles.reviewsSectionHeader}>
              <ResponsiveText size="lg" weight="bold" color={theme === 'dark' ? '#FFF' : '#000'} style={styles.sectionTitle}>
                Recent Reviews
              </ResponsiveText>
              <TouchableOpacity onPress={() => (navigation as any).navigate('ReviewsScreen')}>
                <View style={styles.seeAllButton}>
                  <ResponsiveText size="sm" weight="600" color={theme === 'dark' ? '#FFF' : '#4B0082'} style={styles.seeAllText}>
                    See All
                  </ResponsiveText>
                </View>
              </TouchableOpacity>
            </ResponsiveView>
            
            {loadingReviews ? (
              <ResponsiveView style={styles.reviewsLoadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <ResponsiveText size="md" weight="bold" color={theme === 'dark' ? '#FFF' : '#333'} style={styles.loadingText}>
                  Loading reviews...
                </ResponsiveText>
              </ResponsiveView>
            ) : allReviews.length === 0 ? (
              <ResponsiveView style={styles.reviewsEmptyContainer}>
                <Ionicons name="chatbubbles-outline" size={iconSizes.xxxxl} color="#999" />
                <ResponsiveText size="lg" weight="bold" color={theme === 'dark' ? '#CCC' : '#666'} style={styles.emptyText}>
                  No reviews yet
                </ResponsiveText>
                <ResponsiveText size="md" color={theme === 'dark' ? '#AAA' : '#888'} style={styles.reviewsEmptyText}>
                  Be the first to leave a review!
                </ResponsiveText>
              </ResponsiveView>
            ) : (
              allReviews.map((review) => (
                <ResponsiveView key={review.id} style={styles.reviewCard}>
                  <ResponsiveView style={styles.reviewHeader}>
                    <ResponsiveView style={styles.reviewUserInfo}>
                      <ResponsiveText size="md" weight="600" color="#333" style={styles.reviewUserName}>
                        {review.userName || 'Anonymous'}
                      </ResponsiveText>
                      <ResponsiveText size="sm" color="#667eea" style={styles.reviewBusinessName}>
                        {review.businessName}
                      </ResponsiveText>
                    </ResponsiveView>
                    <ResponsiveView style={styles.reviewStarsContainer}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= review.rating ? 'star' : 'star-outline'}
                          size={iconSizes.sm}
                          color="#FFD700"
                        />
                      ))}
                    </ResponsiveView>
                  </ResponsiveView>
                  {review.comment && (
                    <ResponsiveText size="sm" color="#555" style={styles.reviewComment} numberOfLines={3}>
                      {review.comment}
                    </ResponsiveText>
                  )}
                  <ResponsiveText size="xs" color="#888" style={styles.reviewDate}>
                    {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
                  </ResponsiveText>
                </ResponsiveView>
              ))
            )}
          </ResponsiveView>
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
                {/* View Reviews Button */}
                <TouchableOpacity
                  style={styles.viewReviewsBtn}
                  onPress={() => {
                    // Close the current modal first
                    setDetailsModalVisible(false);
                    
                    // Navigate to ReviewsScreen with business data
                    (navigation as any).navigate('ReviewsScreen', {
                      businessToView: {
                        id: selectedPlace.id,
                        name: selectedPlace.name,
                        businessType: selectedPlace.businessType,
                        businessAddress: selectedPlace.location || selectedPlace.businessAddress,
                      }
                    });
                  }}
                >
                  <Ionicons name="star" size={20} color="#fff" />
                  <Text style={styles.viewReviewsText}> View Reviews</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.closeButtonModal} onPress={() => setDetailsModalVisible(false)}>
                <Text style={styles.closeButtonText}>×</Text>
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
              <ActivityIndicator size="large" color="#667eea" style={styles.reviewModalLoadingContainer} />
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
              <View style={styles.reviewModalContentContainer}>
                <Text style={styles.reviewModalLabel}>Your Rating</Text>
                <View style={styles.reviewModalStars}>
                  {[1,2,3,4,5].map(i => (
                    <TouchableOpacity key={i} onPress={() => setReviewRating(i)}>
                      <Ionicons name={i <= reviewRating ? 'star' : 'star-outline'} size={38} color="#FFD700" style={styles.reviewModalStarContainer} />
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
      
      {/* Loyalty Points Modal */}
      <Modal
        visible={loyaltyPointsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLoyaltyPointsModalVisible(false)}
      >
        <View style={styles.loyaltyModalOverlay}>
          <View style={styles.loyaltyModalContent}>
            <View style={styles.loyaltyModalHeader}>
              <View style={styles.loyaltyModalTitleContainer}>
                <Ionicons name="trophy" size={28} color="#FFD700" />
                <Text style={styles.loyaltyModalTitle}>Loyalty Points</Text>
              </View>
              <TouchableOpacity onPress={() => setLoyaltyPointsModalVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.loyaltyTotalContainer}>
              <Text style={styles.loyaltyTotalLabel}>Total Points</Text>
              <Text style={styles.loyaltyTotalPoints}>{userPoints}</Text>
            </View>
            
            <TouchableOpacity
              style={styles.transactionHistoryButton}
              onPress={() => {
                setLoyaltyPointsModalVisible(false);
                (navigation as any).navigate('TransactionHistoryScreen');
              }}
            >
              <Ionicons name="receipt-outline" size={20} color="#667eea" />
              <Text style={styles.transactionHistoryButtonText}>View Transaction History</Text>
              <Ionicons name="chevron-forward" size={20} color="#667eea" />
            </TouchableOpacity>
            
            <Text style={styles.loyaltySectionTitle}>Points by Business</Text>
            
            {businessLoyaltyPoints.length === 0 ? (
              <View style={styles.loyaltyEmptyContainer}>
                <Ionicons name="business-outline" size={48} color="#999" />
                <Text style={styles.loyaltyEmptyText}>No loyalty points yet</Text>
                <Text style={styles.loyaltyEmptySubtext}>Scan QR codes to earn points!</Text>
              </View>
            ) : (
              <FlatList
                data={businessLoyaltyPoints.sort((a, b) => b.points - a.points)}
                keyExtractor={(item) => item.businessId}
                renderItem={({ item }) => (
                  <View style={styles.loyaltyBusinessCard}>
                    <View style={styles.loyaltyBusinessInfo}>
                      <Text style={styles.loyaltyBusinessName} numberOfLines={1}>
                        {item.businessName}
                      </Text>
                    </View>
                    <View style={styles.loyaltyBusinessRight}>
                      <View style={styles.loyaltyBusinessPoints}>
                        <Ionicons name="star" size={20} color="#FFD700" />
                        <Text style={styles.loyaltyBusinessPointsText}>{item.points}</Text>
                      </View>
                      {item.points > 0 && (
                        <TouchableOpacity
                          style={styles.sendPointsButton}
                          onPress={() => {
                            console.log('Send button pressed for:', item.businessName);
                            setSelectedBusinessForTransfer(item);
                            setPointsToTransfer(''); // Reset input
                            // Close loyalty points modal first
                            setLoyaltyPointsModalVisible(false);
                            // Small delay to ensure modal closes before opening new one
                            setTimeout(() => {
                              setTransferPointsModalVisible(true);
                              console.log('Transfer modal should be visible now');
                            }, 300);
                          }}
                        >
                          <Ionicons name="send" size={16} color="#fff" />
                          <Text style={styles.sendPointsButtonText}>Send</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
                style={styles.loyaltyList}
              />
            )}
          </View>
        </View>
      </Modal>
      
      {/* Transfer Points Modal */}
      <Modal
        visible={transferPointsModalVisible}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => {
          setTransferPointsModalVisible(false);
          setPointsToTransfer('');
          setSelectedBusinessForTransfer(null);
          setTransferring(false); // Reset transferring state
        }}
      >
        <View style={styles.loyaltyModalOverlay}>
          <View style={styles.transferModalContent}>
            <View style={styles.loyaltyModalHeader}>
              <Text style={[styles.loyaltyModalTitle, { color: '#000' }]}>Send Points</Text>
              <TouchableOpacity
                onPress={() => {
                  setTransferPointsModalVisible(false);
                  setPointsToTransfer('');
                  setSelectedBusinessForTransfer(null);
                  setTransferring(false); // Reset transferring state
                }}
              >
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>
            
            {selectedBusinessForTransfer ? (
              <>
                <View style={styles.transferBusinessInfo}>
                  <Text style={[styles.transferBusinessName, { color: '#000' }]}>
                    {selectedBusinessForTransfer.businessName}
                  </Text>
                  <Text style={[styles.transferBusinessPoints, { color: '#666' }]}>
                    Your points: <Text style={[styles.transferBusinessPointsValue, { color: '#FFD700' }]}>{selectedBusinessForTransfer.points}</Text>
                  </Text>
                </View>
                
                <Text style={[styles.transferLabel, { color: '#000' }]}>Amount to send:</Text>
                <View style={styles.transferInputContainer}>
                  <TextInput
                    style={styles.transferInput}
                    value={pointsToTransfer}
                    onChangeText={(text) => {
                      // Only allow numbers
                      const numericText = text.replace(/[^0-9]/g, '');
                      setPointsToTransfer(numericText);
                      console.log('Input changed:', numericText);
                    }}
                    placeholder="Enter points"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                    returnKeyType="done"
                    editable={!transferring}
                    selectTextOnFocus={true}
                  />
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.transferButton,
                    (transferring || !pointsToTransfer || isNaN(parseInt(pointsToTransfer)) || parseInt(pointsToTransfer) <= 0 || parseInt(pointsToTransfer) > selectedBusinessForTransfer.points) && styles.transferButtonDisabled
                  ]}
                  disabled={transferring || !pointsToTransfer || isNaN(parseInt(pointsToTransfer)) || parseInt(pointsToTransfer) <= 0 || parseInt(pointsToTransfer) > selectedBusinessForTransfer.points}
                  onPress={async () => {
                    if (!user || !selectedBusinessForTransfer) return;
                    
                    const points = parseInt(pointsToTransfer);
                    if (isNaN(points) || points <= 0 || points > selectedBusinessForTransfer.points) {
                      Alert.alert('Invalid Amount', 'Please enter a valid amount of points.');
                      return;
                    }
                    
                    setTransferring(true);
                    try {
                      const result = await pointsService.transferPointsToBusiness(
                        user.uid,
                        selectedBusinessForTransfer.businessId,
                        points,
                        user.displayName || user.email || 'Anonymous User'
                      );
                      
                      if (result.success) {
                        // Reset all states first
                        setTransferring(false);
                        setPointsToTransfer('');
                        const businessToClose = selectedBusinessForTransfer;
                        setSelectedBusinessForTransfer(null);
                        
                        Alert.alert('Success!', result.message, [
                          {
                            text: 'OK',
                            onPress: () => {
                              setTransferPointsModalVisible(false);
                              loadUserPoints(); // Reload points
                            },
                          },
                        ]);
                      } else {
                        Alert.alert('Error', result.message);
                        setTransferring(false);
                      }
                    } catch (error) {
                      console.error('Error transferring points:', error);
                      Alert.alert('Error', 'Failed to transfer points. Please try again.');
                      setTransferring(false);
                    }
                  }}
                >
                  {transferring ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={20} color="#fff" />
                      <Text style={styles.transferButtonText}>Send Points</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.transferModalEmptyContainer}>
                <Text style={styles.transferModalEmptyText}>No business selected</Text>
              </View>
            )}
          </View>
          </View>
        </Modal>
    </LinearGradient>
  );
};

export default HomeScreen; 