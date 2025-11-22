import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  Alert,
  TextInput,
  FlatList,
  ActivityIndicator,
  Modal,
  Image,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, query, getDocs, where, doc, getDoc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import LoadingImage from '../../components/LoadingImage';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useResponsive } from '../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../components';

// Removed fixed dimensions - using responsive hook instead

// Optimized image cache - use prefetch only (no base64 to save memory)
const imageStatusCache = new Map<string, { status: 'loading' | 'loaded' | 'error', promise?: Promise<void> }>();
const MAX_CACHE_SIZE = 50; // Limit cache size to prevent memory issues

// Optimized preloading function - uses Image.prefetch only (more memory efficient)
const preloadImage = (uri: string): Promise<void> => {
  if (imageStatusCache.has(uri)) {
    const cached = imageStatusCache.get(uri)!;
    if (cached.status === 'loaded') {
      return Promise.resolve();
    } else if (cached.promise) {
      return cached.promise;
    }
  }
  
  // Limit cache size - remove oldest entries if cache is too large
  if (imageStatusCache.size >= MAX_CACHE_SIZE) {
    const firstKey = imageStatusCache.keys().next().value;
    if (firstKey) {
      imageStatusCache.delete(firstKey);
    }
  }
  
  const promise = new Promise<void>((resolve) => {
    imageStatusCache.set(uri, { status: 'loading', promise });
    
    // Use Image.prefetch only (more memory efficient than base64)
    Image.prefetch(uri)
      .then(() => {
        imageStatusCache.set(uri, { status: 'loaded' });
        resolve();
      })
      .catch(() => {
        imageStatusCache.set(uri, { status: 'error' });
        resolve();
      });
  });
  
  return promise;
};

// Memoized Business Marker Component for performance
const BusinessMarker = React.memo<{
  place: Place;
  isNavigating: boolean;
  isSelected: boolean;
  onPress: (place: Place) => void;
  markerStyles: any;
  markerSize: number;
}>(({ place, isNavigating, isSelected, onPress, markerStyles, markerSize }) => {
  const businessImage = place.image || (place.allImages && place.allImages.length > 0 ? place.allImages[0] : null);
  const hasImage = !!businessImage;
  
  // Calculate border width based on selection state
  const borderWidth = isNavigating && isSelected ? 4 : 2;
  const imageSize = markerSize - (borderWidth * 2);
  
  return (
    <Marker
      key={place.id}
      coordinate={{
        latitude: place.businessLocation.latitude,
        longitude: place.businessLocation.longitude
      }}
      title={place.name}
      description={place.businessType}
      onPress={() => onPress(place)}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={markerStyles.pinMarkerContainer}>
        {/* Pin head (circular part with image) */}
        <View style={[
          markerStyles.pinMarkerHead,
          {
            width: markerSize,
            height: markerSize,
            borderRadius: markerSize / 2,
            borderWidth: borderWidth,
            borderColor: isNavigating && isSelected ? '#FF3B30' : '#fff',
            opacity: isNavigating && !isSelected ? 0.6 : 1,
            elevation: isNavigating && isSelected ? 8 : (isNavigating ? 1 : 3),
            shadowOpacity: isNavigating && isSelected ? 0.4 : (isNavigating ? 0.1 : 0.25),
            zIndex: 2,
          }
        ]}>
          {hasImage ? (
            <Image
              source={{ uri: businessImage }}
              style={[
                markerStyles.businessMarkerImage,
                {
                  width: imageSize,
                  height: imageSize,
                  borderRadius: imageSize / 2,
                }
              ]}
              resizeMode="cover"
            />
          ) : (
            <View style={[
              markerStyles.businessMarkerFallback,
              {
                width: imageSize,
                height: imageSize,
                borderRadius: imageSize / 2,
                backgroundColor: isNavigating && isSelected ? '#FF3B30' : '#4B50E6',
              }
            ]}>
              <Ionicons 
                name={isNavigating && isSelected ? "location" : "business"}
                size={Math.max(16, Math.min(markerSize * 0.5, 24))} 
                color="#fff" 
              />
            </View>
          )}
        </View>
        {/* Pin point (triangular bottom) - positioned below the circle */}
        <View style={[
          markerStyles.pinMarkerPoint,
          {
            borderLeftWidth: Math.max(4, Math.min(markerSize * 0.15, 8)),
            borderRightWidth: Math.max(4, Math.min(markerSize * 0.15, 8)),
            borderTopWidth: Math.max(10, Math.min(markerSize * 0.3, 18)),
            borderTopColor: isNavigating && isSelected ? '#FF3B30' : '#fff',
            opacity: isNavigating && !isSelected ? 0.6 : 1,
            marginTop: -1,
            alignSelf: 'center',
            zIndex: 1,
          }
        ]} />
      </View>
    </Marker>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.place.id === nextProps.place.id &&
    prevProps.isNavigating === nextProps.isNavigating &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.markerSize === nextProps.markerSize
  );
});

// Optimized Cached Image Component - uses prefetch cache (memory efficient)
const CachedImage: React.FC<{
  source: { uri: string };
  style: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}> = React.memo(({ source, style, resizeMode = 'cover' }) => {
  const [isLoading, setIsLoading] = useState(() => {
    const cached = imageStatusCache.get(source.uri);
    return cached?.status !== 'loaded';
  });
  
  useEffect(() => {
    // Check cache status
    const cached = imageStatusCache.get(source.uri);
    if (cached?.status === 'loaded') {
      setIsLoading(false);
      return;
    }
    
    // Only set loading to true if we need to actually load the image
    setIsLoading(true);
    
    // Preload if not cached
    preloadImage(source.uri).then(() => {
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, [source.uri]);
  
  return (
    <View style={style}>
      <Image
        source={source}
        style={style}
        resizeMode={resizeMode}
        fadeDuration={0} // Disable fade animation for instant display
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
});

interface Place {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  businessType?: string;
  address?: string;
  contactNumber?: string;
  businessHours?: string;
  openingTime?: string;
  closingTime?: string;
  businessLocation: {
    latitude: number;
    longitude: number;
  };
  allImages?: string[];
  image?: string;
  location?: string;
}

interface Route {
  distance: string;
  duration: string;
  coordinates?: Array<{latitude: number, longitude: number}>;
  trafficInfo?: {
    condition: 'light' | 'moderate' | 'heavy';
    estimatedDelay: string;
    alternativeRoutes: number;
  };
}

// Add this type for OpenRouteService response
type OpenRouteServiceResponse = {
  features: Array<{
    geometry: {
      coordinates: number[][];
    };
    properties: {
      segments: Array<{
  distance: number;
  duration: number;
      }>;
    };
  }>;
};

// OSRM configuration - more reliable than OpenRouteService
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1';

// Transport mode mapping for OSRM
const OSRM_TRANSPORT_MODES = {
  driving: 'driving',
  walking: 'walking',
  bicycling: 'bike',
  transit: 'driving' // OSRM doesn't support transit, fallback to driving
};

// Average speeds for fallback calculations (from reference code)
const AVERAGE_SPEEDS = {
  driving: 40,      // km/h
  walking: 5,       // km/h
  transit: 25,      // km/h
  bicycling: 15,    // km/h
};

const ORS_API_KEY = '5b3ce3597851110001cf6248e6a2bc17f1e244d5bdc5cd334e10232b';

// Haversine distance function (from reference code)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Add this type for business details
interface BusinessDetails {
  name: string;
  businessType: string;
  location: string;
  businessHours: string;
  contactNumber: string;
  image: string;
  allImages?: string[];
  latitude: number;
  longitude: number;
  description?: string;
  rating?: number;
  email?: string;
  website?: string;
}

// Add route params type
type NavigateRouteParams = {
  business?: Place;
};

type NavigateRouteProp = RouteProp<{ Navigate: NavigateRouteParams }, 'Navigate'>;

const Navigate = () => {
  const route = useRoute<NavigateRouteProp>();
  const { theme } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius: borderRadiusValues, getResponsiveWidth, getResponsiveHeight, dimensions, responsiveHeight, responsiveWidth, responsiveFontSize } = useResponsive();
  const mapRef = useRef<MapView>(null);
  
  // Device size detection - use responsive dimensions
  const isSmallDevice = dimensions.isSmallDevice;
  const isMediumDevice = dimensions.width >= 375 && dimensions.width <= 414;
  const isLargeDevice = dimensions.isLargeDevice;
  const isSmallScreen = dimensions.width < 360;
  const minTouchTarget = 44;
  
  // Calculate responsive marker size for business markers
  const markerSize = Math.max(32, Math.min(dimensions.width * 0.1, 48));
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [routeDetails, setRouteDetails] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [circleRadius, setCircleRadius] = useState(1000); // Default 1000m
  const [showRadiusControl, setShowRadiusControl] = useState(true);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedTravelMode, setSelectedTravelMode] = useState('walking');
  const [isNavigating, setIsNavigating] = useState(false);
  const [isBusinessClosed, setIsBusinessClosed] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [selectedBusinessDetails, setSelectedBusinessDetails] = useState<BusinessDetails | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [cachedLocation, setCachedLocation] = useState<Location.LocationObject | null>(null);
  const [isNavigationLoading, setIsNavigationLoading] = useState(false);
  const [routeCache, setRouteCache] = useState<Map<string, any>>(new Map());
  const [nearbyBusinesses, setNearbyBusinesses] = useState<Place[]>([]);
  const [showNearbyModal, setShowNearbyModal] = useState(false);
  const [businessReviews, setBusinessReviews] = useState<{[key: string]: any[]}>({});
  const [businessRatings, setBusinessRatings] = useState<{[key: string]: {average: string, count: number}}>({});
  const [reviewUnsubscribes, setReviewUnsubscribes] = useState<{[key: string]: any}>({});
  const previouslyDetectedBusinessesRef = useRef(new Set<string>());

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  // Create responsive styles using useMemo
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      ...(Platform.OS === 'ios' && { paddingBottom: 0 }),
    },
    safeArea: {
      flex: 1,
    },
    map: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isSmallScreen ? spacing.md : spacing.lg,
      paddingTop: spacing.sm,
    },
    headerSpacer: {
      width: iconSizes.xl,
    },
    searchBarContainer: {
      paddingHorizontal: isSmallScreen ? spacing.md : spacing.lg,
      paddingVertical: spacing.sm,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
      minHeight: minTouchTarget,
    },
    searchBarInput: {
      flex: 1,
      marginLeft: spacing.sm,
      fontSize: fontSizes.md,
      minHeight: 36,
    },
    searchResultsContainer: {
      position: 'absolute',
      top: responsiveHeight(12),
      left: isSmallScreen ? spacing.md : spacing.lg,
      right: isSmallScreen ? spacing.md : spacing.lg,
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.md,
      maxHeight: responsiveHeight(25),
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    searchResult: {
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
      minHeight: minTouchTarget,
    },
    searchResultName: {
      fontSize: fontSizes.md,
      fontWeight: '600',
      color: '#333',
    },
    searchResultDesc: {
      fontSize: fontSizes.sm,
      color: '#666',
      marginTop: spacing.xs / 2,
    },
    permissionContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    permissionTitle: {
      fontSize: fontSizes.xxl,
      fontWeight: 'bold',
      marginTop: responsiveHeight(3),
      textAlign: 'center',
    },
    permissionText: {
      fontSize: fontSizes.md,
      textAlign: 'center',
      marginBottom: spacing.lg,
      color: '#333',
    },
    permissionButton: {
      backgroundColor: '#667eea',
      paddingHorizontal: responsiveWidth(8),
      paddingVertical: responsiveHeight(2),
      borderRadius: borderRadiusValues.lg,
      marginTop: responsiveHeight(4),
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    permissionButtonText: {
      color: '#FFF',
      fontSize: fontSizes.lg,
      fontWeight: '600',
    },
    loadingOverlay: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -responsiveWidth(20) }, { translateY: -responsiveHeight(5) }],
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: borderRadiusValues.md,
      padding: spacing.lg,
      alignItems: 'center',
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      zIndex: 1000,
    },
    loadingText: {
      marginTop: spacing.sm,
      fontSize: fontSizes.md,
      color: '#333',
      fontWeight: '500',
    },
    detailsOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: isSmallScreen ? spacing.md : spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? (isSmallScreen ? spacing.xs : spacing.xs) : (isSmallScreen ? spacing.md : spacing.lg),
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999,
    },
    detailsContainer: {
      width: '100%',
      maxWidth: isSmallScreen ? '95%' : 400,
      maxHeight: isSmallScreen ? dimensions.height * 0.85 : dimensions.height * 0.90,
      minHeight: dimensions.height * 0.30,
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.lg,
      overflow: 'hidden',
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.34,
      shadowRadius: 6.27,
      zIndex: 1000,
      flexDirection: 'column',
    },
    contentContainer: {
      padding: isSmallDevice ? spacing.xs : spacing.sm,
      paddingBottom: 0,
      backgroundColor: '#fff',
      minHeight: 180,
      flexGrow: 1,
    },
    scrollContentContainer: {
      paddingBottom: Platform.OS === 'ios' 
        ? (isSmallScreen ? spacing.sm : spacing.xs)
        : (isSmallScreen ? spacing.md : spacing.sm),
      flexGrow: 1,
    },
    businessInfo: {
      marginBottom: isSmallDevice ? spacing.xs : spacing.sm,
      alignItems: 'center',
    },
    businessName: {
      marginBottom: spacing.xs,
      textAlign: 'center',
      paddingHorizontal: spacing.xs,
    },
    businessType: {
      marginBottom: isSmallDevice ? spacing.xs : spacing.sm,
      textAlign: 'center',
      paddingHorizontal: spacing.xs,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: isSmallDevice ? spacing.xs / 2 : spacing.xs,
      alignSelf: 'stretch',
    },
    locationText: {
      marginLeft: spacing.sm,
      flex: 1,
      minWidth: 0,
      flexWrap: 'wrap',
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: isSmallDevice ? spacing.xs / 2 : spacing.xs,
      alignSelf: 'stretch',
    },
    timeText: {
      marginLeft: spacing.sm,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: isSmallDevice ? spacing.xs / 2 : spacing.xs,
      alignSelf: 'stretch',
    },
    infoText: {
      marginLeft: spacing.sm,
      flex: 1,
      minWidth: 0,
    },
    travelModesContainer: {
      marginBottom: isSmallDevice ? spacing.xs / 2 : spacing.xs,
      backgroundColor: '#f5f5f5',
      borderRadius: borderRadiusValues.md,
      padding: isSmallDevice ? spacing.xs / 2 : spacing.xs,
    },
    travelModeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: isSmallDevice ? spacing.xs / 4 : spacing.xs / 2,
    },
    travelModeButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: isSmallDevice ? spacing.xs / 2 : spacing.xs,
      marginHorizontal: spacing.xs / 2,
      borderRadius: borderRadiusValues.sm,
      minHeight: isSmallScreen ? 40 : minTouchTarget,
      justifyContent: 'center',
    },
    selectedMode: {
      backgroundColor: '#fff',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
    },
    travelModeText: {
      marginTop: isSmallDevice ? spacing.xs / 2 : spacing.xs,
      textAlign: 'center',
    },
    selectedModeText: {
      // Styles handled by ResponsiveText
    },
    routeInfo: {
      backgroundColor: '#f5f5f5',
      borderRadius: borderRadiusValues.md,
      padding: isSmallDevice ? spacing.xs : spacing.sm,
      marginBottom: isSmallDevice ? spacing.xs : spacing.sm,
      minHeight: isSmallDevice ? 40 : 60,
      justifyContent: 'center',
    },
    routeInfoCentered: {
      alignItems: 'center',
    },
    routeInfoContainer: {
      flex: 1,
    },
    routeInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: spacing.md,
    },
    routeInfoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    routeInfoText: {
      marginLeft: spacing.sm,
    },
    trafficContainer: {
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.sm,
      padding: isSmallDevice ? spacing.xs / 2 : spacing.xs,
      marginTop: isSmallDevice ? spacing.xs / 2 : spacing.xs,
      borderWidth: 1,
      borderColor: '#e0e0e0',
    },
    trafficHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: isSmallDevice ? spacing.xs / 2 : spacing.xs / 2,
    },
    trafficHeaderText: {
      marginLeft: spacing.xs,
      textTransform: 'uppercase',
    },
    trafficContentContainer: {
      paddingLeft: isSmallDevice ? spacing.xs / 2 : spacing.xs,
    },
    trafficRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: isSmallDevice ? spacing.xs / 4 : spacing.xs / 2,
    },
    trafficText: {
      marginLeft: spacing.xs,
    },
    trafficDetailText: {
      marginLeft: spacing.xs,
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    actionButton: {
      flex: 1,
      backgroundColor: '#667eea',
      paddingVertical: spacing.md,
      borderRadius: borderRadiusValues.md,
      alignItems: 'center',
      marginHorizontal: spacing.xs,
      minHeight: minTouchTarget,
      justifyContent: 'center',
    },
    actionButtonText: {
      color: '#fff',
      fontSize: fontSizes.md,
      fontWeight: '600',
    },
    cancelButton: {
      backgroundColor: '#f0f0f0',
    },
    cancelButtonText: {
      color: '#666',
    },
    imageContainer: {
      width: '100%',
      height: responsiveHeight(25),
      backgroundColor: '#f0f0f0',
    },
    carouselImage: {
      width: dimensions.width,
      height: isSmallScreen ? responsiveHeight(12) : responsiveHeight(15),
    },
    imageIndicators: {
      position: 'absolute',
      bottom: spacing.md,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    indicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginHorizontal: 4,
    },
    activeIndicator: {
      backgroundColor: '#fff',
      width: 24,
    },
    inactiveIndicator: {
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    noImageContainer: {
      width: '100%',
      height: isSmallScreen ? responsiveHeight(12) : responsiveHeight(15),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f0f0f0',
    },
    noImageText: {
      marginTop: spacing.sm,
      fontSize: fontSizes.sm,
      color: '#999',
    },
    pinMarkerContainer: {
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexDirection: 'column',
      width: 'auto',
      height: 'auto',
    },
    pinMarkerHead: {
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
      borderColor: '#667eea',
      overflow: 'hidden',
      // Width, height, and borderRadius are set dynamically via markerSize prop
    },
    pinMarkerImage: {
      width: '100%',
      height: '100%',
    },
    pinMarkerTail: {
      width: 0,
      height: 0,
      borderLeftWidth: isSmallScreen ? 6 : 8,
      borderRightWidth: isSmallScreen ? 6 : 8,
      borderTopWidth: isSmallScreen ? 10 : 12,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: '#667eea',
      marginTop: -1,
    },
    radiusControlContainer: {
      position: 'absolute',
      bottom: responsiveHeight(8),
      right: isSmallScreen ? spacing.sm : spacing.md,
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.lg,
      padding: spacing.sm,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    radiusControlButton: {
      padding: spacing.sm,
      minWidth: minTouchTarget,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    nearbyButton: {
      position: 'absolute',
      bottom: responsiveHeight(8),
      left: isSmallScreen ? spacing.sm : spacing.md,
      backgroundColor: '#667eea',
      borderRadius: borderRadiusValues.lg,
      padding: spacing.md,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    nearbyButtonText: {
      color: '#fff',
      fontSize: fontSizes.sm,
      fontWeight: '600',
    },
    navigateButton: {
      backgroundColor: '#4B50E6',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: isSmallDevice ? spacing.sm : spacing.md,
      borderRadius: borderRadiusValues.md,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      marginTop: isSmallDevice ? spacing.xs : spacing.sm,
      marginBottom: spacing.xs,
      shadowRadius: 1.41,
      minHeight: isSmallScreen ? 44 : minTouchTarget,
    },
    navigateButtonText: {
      color: '#fff',
      marginLeft: spacing.sm,
    },
    navigateButtonDisabled: {
      opacity: 0.7,
    },
    closedStatusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffebee',
      paddingVertical: isSmallDevice ? spacing.xs : spacing.sm,
      paddingHorizontal: isSmallDevice ? spacing.xs : spacing.sm,
      borderRadius: borderRadiusValues.sm,
      marginTop: isSmallDevice ? spacing.xs / 2 : spacing.xs,
      marginBottom: isSmallDevice ? spacing.xs / 2 : spacing.xs,
      borderWidth: 1,
      borderColor: '#ef5350',
    },
    closedStatusText: {
      color: '#d32f2f',
      marginLeft: spacing.sm,
    },
    mapContainer: {
      flex: 1,
      marginHorizontal: responsiveWidth(5),
      marginBottom: responsiveHeight(2),
      borderRadius: borderRadiusValues.lg,
      overflow: 'hidden',
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    mapLocationButton: {
      position: 'absolute',
      bottom: responsiveHeight(3),
      right: responsiveWidth(4),
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      padding: responsiveWidth(2.5),
      borderRadius: borderRadiusValues.md,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
      minWidth: minTouchTarget,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radiusControlPanel: {
      position: 'absolute',
      bottom: responsiveHeight(3),
      right: responsiveWidth(4),
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      padding: responsiveWidth(2),
      borderRadius: borderRadiusValues.lg,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
      minWidth: responsiveWidth(25),
      alignItems: 'center',
      height: responsiveHeight(8),
    },
    radiusButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: responsiveHeight(1),
      top: responsiveHeight(1),
    },
    radiusValue: {
      fontSize: fontSizes.xs,
      color: '#3B2FEA',
    },
    radiusButtonSmall: {
      backgroundColor: 'rgba(59, 47, 234, 0.1)',
      padding: responsiveWidth(2.5),
      borderRadius: borderRadiusValues.sm,
      marginHorizontal: responsiveWidth(2),
      borderWidth: 1,
      borderColor: 'rgba(59, 47, 234, 0.3)',
      minWidth: minTouchTarget,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radiusButtonDisabled: {
      backgroundColor: 'rgba(204, 204, 204, 0.1)',
      borderColor: 'rgba(59, 47, 234, 0.3)',
      borderWidth: 1,
    },
    bottomPanel: {
      paddingHorizontal: responsiveWidth(5),
      paddingBottom: responsiveHeight(2),
    },
    routeDetails: {
      flexDirection: 'column',
      gap: spacing.sm,
    },
    routeTitle: {
      fontSize: fontSizes.lg,
      fontWeight: 'bold',
      color: '#333',
    },
    loadingContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    userMarker: {
      width: iconSizes.md,
      height: iconSizes.md,
      borderRadius: iconSizes.md / 2,
      backgroundColor: 'rgba(75, 80, 230, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    userMarkerDot: {
      width: iconSizes.xs,
      height: iconSizes.xs,
      borderRadius: iconSizes.xs / 2,
      backgroundColor: '#4B50E6',
    },
    userMarkerNavigation: {
      width: iconSizes.lg,
      height: iconSizes.lg,
      borderRadius: iconSizes.lg / 2,
      backgroundColor: 'rgba(75, 80, 230, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: '#fff',
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    userMarkerDotNavigation: {
      width: iconSizes.sm,
      height: iconSizes.sm,
      borderRadius: iconSizes.sm / 2,
      backgroundColor: '#4B50E6',
    },
    destinationMarker: {
      backgroundColor: '#FF3B30',
      borderRadius: 35,
      padding: spacing.md,
      borderWidth: 5,
      borderColor: '#fff',
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      width: 70,
      height: 70,
    },
    businessMarkerImage: {
      // Width, height, and borderRadius are set dynamically in component for Android compatibility
    },
    businessMarkerFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      // Width, height, and borderRadius are set dynamically in component
    },
    pinMarkerPoint: {
      width: 0,
      height: 0,
      backgroundColor: 'transparent',
      borderStyle: 'solid',
      borderLeftWidth: Math.max(4, Math.min(dimensions.width * 0.015, 8)),
      borderRightWidth: Math.max(4, Math.min(dimensions.width * 0.015, 8)),
      borderTopWidth: Math.max(10, Math.min(dimensions.width * 0.03, 18)),
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: '#fff',
      marginTop: -1,
      alignSelf: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 2,
      // Ensure it's visible above the map
      position: 'relative',
    },
    navigationControls: {
      position: 'absolute',
      bottom: responsiveHeight(5),
      right: isSmallScreen ? spacing.md : spacing.lg,
      alignItems: 'center',
    },
    stopNavigationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FF3B30',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 30,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      minHeight: minTouchTarget,
      justifyContent: 'center',
    },
    stopNavigationText: {
      color: '#fff',
      fontSize: fontSizes.sm,
      fontWeight: '600',
      marginLeft: spacing.xs,
    },
    businessImage: {
      width: '100%',
      height: responsiveHeight(25),
      backgroundColor: '#f5f5f5',
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
      // Styles handled by ResponsiveText
    },
    description: {
      fontSize: fontSizes.sm,
      color: '#666',
      marginBottom: spacing.lg,
      lineHeight: fontSizes.sm * 1.5,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    ratingText: {
      fontSize: fontSizes.sm,
      color: '#666',
      marginLeft: spacing.sm,
      fontWeight: '600',
    },
    imageCarouselContainer: {
      height: isSmallScreen ? responsiveHeight(12) : responsiveHeight(15),
      backgroundColor: '#f0f0f0',
      alignItems: 'center',
    },
    imageScrollView: {
      flex: 1,
    },
    businessLoadingOverlay: {
      position: 'absolute',
      top: responsiveHeight(12),
      right: isSmallScreen ? spacing.md : spacing.lg,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: borderRadiusValues.xl,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
      zIndex: 1000,
    },
    navigationLoadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1500,
    },
    navigationLoadingContent: {
      backgroundColor: 'white',
      borderRadius: borderRadiusValues.xl,
      padding: spacing.xxxl,
      alignItems: 'center',
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    navigationLoadingText: {
      fontSize: fontSizes.xl,
      fontWeight: '600',
      color: '#333',
      marginTop: spacing.md,
      textAlign: 'center',
    },
    navigationLoadingSubtext: {
      fontSize: fontSizes.md,
      color: '#666',
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    navigationTopBar: {
      position: 'absolute',
      top: responsiveHeight(7),
      left: isSmallScreen ? spacing.md : spacing.lg,
      right: isSmallScreen ? spacing.md : spacing.lg,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: borderRadiusValues.lg,
      padding: spacing.lg,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      zIndex: 1000,
    },
    navigationInfo: {
      alignItems: 'center',
    },
    navigationDestination: {
      fontSize: fontSizes.xl,
      fontWeight: '700',
      color: '#333',
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    navigationDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    navigationTime: {
      fontSize: fontSizes.md,
      fontWeight: '600',
      color: '#4B50E6',
    },
    navigationDivider: {
      fontSize: fontSizes.md,
      color: '#999',
      marginHorizontal: spacing.sm,
    },
    navigationDistance: {
      fontSize: fontSizes.md,
      fontWeight: '500',
      color: '#666',
    },
    nearbyOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.18)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    nearbyModal: {
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.xxl,
      padding: isSmallScreen ? spacing.sm : spacing.md,
      width: '90%',
      maxWidth: 400,
      minWidth: isSmallScreen ? '85%' : '90%',
      maxHeight: dimensions.height * 0.65,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 8,
      elevation: 8,
    },
    nearbyTitle: {
      marginBottom: isSmallScreen ? spacing.sm : spacing.md,
      textAlign: 'center',
      paddingHorizontal: spacing.xs,
    },
    nearbyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F8F8F8',
      borderRadius: borderRadiusValues.md,
      padding: isSmallScreen ? spacing.xs : spacing.sm,
      marginBottom: isSmallScreen ? spacing.xs : spacing.sm,
      width: '100%',
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowOffset: { width: 0, height: 1 },
      shadowRadius: 2,
      elevation: 2,
      minHeight: minTouchTarget,
    },
    nearbyImage: {
      width: isSmallScreen ? iconSizes.lg : iconSizes.xl,
      height: isSmallScreen ? iconSizes.lg : iconSizes.xl,
      minWidth: iconSizes.lg,
      minHeight: iconSizes.lg,
      borderRadius: borderRadiusValues.sm,
      backgroundColor: '#eee',
    },
    nearbyName: {
      // Styles handled by ResponsiveText
    },
    nearbyDistance: {
      marginLeft: spacing.xs,
    },
    nearbyRating: {
      marginLeft: spacing.xs,
    },
    nearbyNavigateBtn: {
      backgroundColor: '#F6E3D1',
      borderRadius: borderRadiusValues.xs,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      paddingHorizontal: isSmallScreen ? spacing.sm : spacing.sm,
      marginLeft: isSmallScreen ? spacing.xs : spacing.xs,
      minHeight: minTouchTarget,
      minWidth: minTouchTarget,
      justifyContent: 'center',
    },
    nearbyNavigateText: {
      color: '#8D5C2C',
      marginLeft: spacing.xs / 2,
    },
    nearbyCloseBtn: {
      width: '100%',
      marginTop: isSmallScreen ? spacing.xs : spacing.xs,
      borderRadius: borderRadiusValues.md,
      overflow: 'hidden',
    },
    nearbyCloseSolid: {
      backgroundColor: '#3B2FEA',
      paddingVertical: isSmallScreen ? spacing.xs : spacing.sm,
      minHeight: minTouchTarget,
      borderRadius: borderRadiusValues.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nearbyCloseText: {
      color: '#fff',
      textAlign: 'center',
    },
  }), [spacing, fontSizes, iconSizes, borderRadiusValues, dimensions, responsiveHeight, responsiveWidth, isSmallDevice, isSmallScreen, minTouchTarget]);

  // Load businesses from Firestore
  const loadBusinessPlaces = async () => {
    try {
      setLoadingPlaces(true);
      const q = query(
        collection(db, 'businesses'),
        where('status', '==', 'approved'),
        where('displayInUserApp', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      const businessPlaces: Place[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.businessName,
          latitude: data.businessLocation?.latitude || 10.7989,
          longitude: data.businessLocation?.longitude || 122.9744,
          description: data.businessType || data.selectedType || 'Business',
          businessType: data.businessType || data.selectedType,
          address: data.businessAddress,
          contactNumber: data.contactNumber,
          businessHours: data.businessHours,
          openingTime: data.openingTime,
          closingTime: data.closingTime,
          businessLocation: data.businessLocation,
          allImages: data.businessImages || [],
          image: data.businessImages && data.businessImages.length > 0 ? data.businessImages[0] : '',
          location: data.businessAddress || data.location
        };
      }).filter(place => place.latitude && place.longitude); // Only include places with valid coordinates
      
      // Use only business places (no sample places)
      setPlaces(businessPlaces);
    } catch (error) {
      console.error('Error loading business places:', error);
      // Fallback to empty array if there's an error
      setPlaces([]);
    } finally {
      setLoadingPlaces(false);
    }
  };

  // Real-time business loading with Firestore listener
  useEffect(() => {
    const setupNavigation = async () => {
      await requestLocationPermission();
      
      // Set up real-time business listener - use main businesses collection with proper filters
      const q = query(
        collection(db, 'businesses'),
        where('status', '==', 'approved'),
        where('displayInUserApp', '==', true)
      );
      
      setLoadingPlaces(true);
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const businessPlaces: Place[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          
          // Only use businesses with valid businessLocation data
          if (!data.businessLocation || !data.businessLocation.latitude || !data.businessLocation.longitude) {
            console.warn(`⚠️ Skipping business "${data.businessName}" - missing valid coordinates`);
            return null;
          }
          
          const business = {
            id: doc.id,
            name: data.businessName,
            latitude: data.businessLocation.latitude,
            longitude: data.businessLocation.longitude,
            description: data.businessType || data.selectedType || 'Business',
            businessType: data.businessType || data.selectedType,
            address: data.businessAddress,
            contactNumber: data.contactNumber,
            businessHours: data.businessHours,
            openingTime: data.openingTime,
            closingTime: data.closingTime,
            businessLocation: data.businessLocation,
            allImages: data.businessImages || [], // Map businessImages from Firestore to allImages
            image: data.businessImages && data.businessImages.length > 0 ? data.businessImages[0] : '', // First image as main image
            location: data.businessAddress || data.location
          };
          
          // Log business coordinates and hours for debugging
          console.log('=======================================');
          console.log(`🏢 BUSINESS: ${business.name}`);
          console.log('📋 ALL AVAILABLE FIELDS:', Object.keys(data));
          console.log('🕐 openingTime:', data.openingTime);
          console.log('🕐 closingTime:', data.closingTime);
          console.log('⏰ businessHours:', data.businessHours);
          console.log('=======================================');
          
          return business;
        }).filter(place => place !== null) as Place[];
        
        setPlaces(businessPlaces);
        setLoadingPlaces(false);
        console.log(`Loaded ${businessPlaces.length} businesses from Firestore`);
        
        // Aggressively preload all business images immediately
        console.log('🚀 Starting aggressive image preloading...');
        const preloadPromises: Promise<void>[] = [];
        
        businessPlaces.forEach(place => {
          if (place.allImages && place.allImages.length > 0) {
            place.allImages.forEach(imageUrl => {
              preloadPromises.push(preloadImage(imageUrl));
            });
          }
        });
        
        // Wait for all images to preload
        Promise.all(preloadPromises).then(() => {
          console.log('✅ All business images preloaded successfully!');
        }).catch((error) => {
          console.log('⚠️ Some images failed to preload:', error);
        });
      }, (error) => {
        console.error('Error loading business places:', error);
        setPlaces([]);
        setLoadingPlaces(false);
      });

      return unsubscribe;
    };

    const unsubscribe = setupNavigation();
    
    return () => {
      unsubscribe.then(unsub => {
        if (unsub && typeof unsub === 'function') {
          unsub();
        }
      });
    };
  }, []);

  const requestLocationPermission = async () => {
    try {
      // Check if we have cached location first
      const lastKnownPosition = await Location.getLastKnownPositionAsync();
      if (lastKnownPosition) {
        setCachedLocation(lastKnownPosition);
        setLocation(lastKnownPosition);
      }

    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setHasPermission(true);
        
        // Get current location in background
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // Faster than high accuracy
        }).then(currentLocation => {
          console.log('📍 User location obtained:', {
            lat: currentLocation.coords.latitude,
            lon: currentLocation.coords.longitude,
            accuracy: currentLocation.coords.accuracy
          });
      setLocation(currentLocation);
          setCachedLocation(currentLocation);
        }).catch(error => {
          console.log('Location error:', error);
          // Use last known position if current fails
          if (lastKnownPosition) {
            setLocation(lastKnownPosition);
          }
        });
    } else {
      Alert.alert(
        'Location Permission Required',
        'This app needs location access to show your position on the map.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => Location.requestForegroundPermissionsAsync() }
        ]
      );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  // Check if business is currently closed based on operating hours
  const checkIfBusinessClosed = (business: any) => {
    console.log('🕐 Checking business hours for:', business.name);
    console.log('🕐 businessHours:', business.businessHours);
    console.log('🕐 Opening time:', business.openingTime);
    console.log('🕐 Closing time:', business.closingTime);

    // Try to get opening and closing times from businessHours if individual fields are missing
    let openingTime = business.openingTime;
    let closingTime = business.closingTime;

    // If openingTime/closingTime are missing, try to parse from businessHours (format: "8:00 AM - 5:00 PM")
    if ((!openingTime || !closingTime) && business.businessHours) {
      const hoursMatch = business.businessHours.match(/^(.+?)\s*-\s*(.+?)$/);
      if (hoursMatch) {
        openingTime = hoursMatch[1].trim();
        closingTime = hoursMatch[2].trim();
        console.log('✅ Parsed from businessHours:', { openingTime, closingTime });
      }
    }

    if (!openingTime || !closingTime) {
      console.log('⚠️ Missing opening or closing time, assuming business is open');
      setIsBusinessClosed(false);
      return false;
    }

    try {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      console.log('🕐 Current time in minutes:', currentTime, `(${now.getHours()}:${now.getMinutes()})`);

      const parseTime = (timeString: string) => {
        const parts = timeString.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!parts) throw new Error('Invalid time format');
        let hours = parseInt(parts[1]);
        const minutes = parseInt(parts[2]);
        const period = parts[3].toUpperCase();
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };

      const openingTimeInMinutes = parseTime(openingTime);
      const closingTimeInMinutes = parseTime(closingTime);
      console.log('🕐 Opening time in minutes:', openingTimeInMinutes);
      console.log('🕐 Closing time in minutes:', closingTimeInMinutes);

      let isClosed = false;
      if (closingTimeInMinutes < openingTimeInMinutes) {
        // Overnight business (e.g., 10 PM - 6 AM)
        isClosed = currentTime < openingTimeInMinutes && currentTime > closingTimeInMinutes;
        console.log('🌙 Overnight business detected');
      } else {
        // Regular business (e.g., 9 AM - 5 PM)
        isClosed = currentTime < openingTimeInMinutes || currentTime > closingTimeInMinutes;
      }

      console.log('🕐 Business is closed?', isClosed);
      setIsBusinessClosed(isClosed);
      return isClosed;
    } catch (error) {
      console.log('❌ Error checking business hours:', error);
      setIsBusinessClosed(false);
      return false;
    }
  };

  // Debounced search with useCallback for performance
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchPlaces = useCallback((query: string) => {
    setSearchQuery(query);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(() => {
      if (query.length > 2) {
        const filtered = places.filter(place =>
          place.name.toLowerCase().includes(query.toLowerCase()) ||
          place.description?.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults(filtered);
      } else {
        setSearchResults([]);
      }
    }, 300);
  }, [places]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Replace getDirectionsFromGoogle with getRouteFromORS
  const getRouteFromORS = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: string,
    retryCount: number = 0
  ) => {
    // Create cache key for this route
    const cacheKey = `${origin.latitude}-${origin.longitude}-${destination.latitude}-${destination.longitude}-${mode}`;
    
    // Check cache first
    if (routeCache.has(cacheKey)) {
      console.log('🚀 Using cached route for', mode);
      return routeCache.get(cacheKey);
    }

    try {
      console.log('🔄 Calculating new route for', mode);
      
      // Convert travel mode to ORS format
      const orsMode = mode === 'driving' ? 'driving-car'
        : mode === 'walking' ? 'foot-walking'
        : mode === 'bicycling' ? 'cycling-regular'
        : mode === 'transit' ? 'foot-walking' // Use walking as fallback for transit
        : 'driving-car';

      // OpenRouteService expects coordinates in [longitude, latitude] format
      const coordinates = [
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude]
      ];

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`⏱️ Request timeout after 15 seconds (attempt ${retryCount + 1})`);
        controller.abort();
      }, 15000); // 15 second timeout (increased from 8 seconds)

      let response;
      try {
        response = await fetch(
          'https://api.openrouteservice.org/v2/directions/' + orsMode + '/geojson',
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
              'Content-Type': 'application/json; charset=utf-8',
              'Authorization': ORS_API_KEY
            },
            body: JSON.stringify({
              coordinates: coordinates,
              units: 'km'
            }),
            signal: controller.signal
          }
        );
      } finally {
        // Always clear the timeout to prevent memory leaks
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        console.error('ORS API Error:', response.status, errorData);
        throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data: OpenRouteServiceResponse = await response.json();
      console.log('📊 ORS API Response structure:', {
        features: data.features?.length || 0,
        firstFeature: data.features?.[0] ? {
          geometry: data.features[0].geometry ? {
            coordinatesLength: data.features[0].geometry.coordinates?.length || 0
          } : null,
          properties: data.features[0].properties ? {
            segments: data.features[0].properties.segments?.length || 0
          } : null
        } : null
      });

      if (!data.features?.[0]) {
        console.error('No features in response:', data);
        throw new Error('No route found in response');
      }

      if (!data.features[0].geometry?.coordinates || data.features[0].geometry.coordinates.length < 2) {
        console.error('Invalid geometry coordinates:', data.features[0].geometry);
        throw new Error('Invalid route geometry');
      }

      // Convert coordinates from [lon, lat] to {latitude, longitude} - optimized for performance
      const rawCoordinates = data.features[0].geometry.coordinates;
      console.log(`🎯 Processing ${rawCoordinates.length} route coordinates`);
      
      // Optimize coordinate conversion - keep important points for smooth polyline
      let routeCoordinates;
      if (rawCoordinates.length > 200) {
        // For very long routes, keep every 4th point plus start/end for performance
        routeCoordinates = rawCoordinates
          .filter((_, index) => index === 0 || index === rawCoordinates.length - 1 || index % 4 === 0)
          .map(coord => ({
            latitude: coord[1],
            longitude: coord[0]
          }));
      } else if (rawCoordinates.length > 50) {
        // For medium routes, keep every 2nd point plus start/end
        routeCoordinates = rawCoordinates
          .filter((_, index) => index === 0 || index === rawCoordinates.length - 1 || index % 2 === 0)
          .map(coord => ({
            latitude: coord[1],
            longitude: coord[0]
          }));
      } else {
        // For shorter routes, keep all points for maximum accuracy
        routeCoordinates = rawCoordinates.map(coord => ({
          latitude: coord[1],
          longitude: coord[0]
        }));
      }
      
      // Ensure we always have at least start and end points
      if (routeCoordinates.length < 2) {
        console.warn('⚠️ Route has insufficient coordinates, adding start/end points');
        routeCoordinates = [
          { latitude: origin.latitude, longitude: origin.longitude },
          { latitude: destination.latitude, longitude: destination.longitude }
        ];
      }
      
      console.log(`✅ Optimized to ${routeCoordinates.length} coordinates for polyline rendering`);
      
      // Debug: Log first few and last few coordinates to verify route
      if (routeCoordinates.length > 0) {
        console.log('📍 Route coordinate sample:');
        console.log('  Start:', routeCoordinates[0]);
        if (routeCoordinates.length > 2) {
          console.log('  Middle:', routeCoordinates[Math.floor(routeCoordinates.length / 2)]);
        }
        console.log('  End:', routeCoordinates[routeCoordinates.length - 1]);
        
        // Check if route is actually just a straight line (indicating API issue)
        const isLikelyStraightLine = routeCoordinates.length === 2 && 
          Math.abs(routeCoordinates[0].latitude - origin.latitude) < 0.00001 &&
          Math.abs(routeCoordinates[0].longitude - origin.longitude) < 0.00001 &&
          Math.abs(routeCoordinates[1].latitude - destination.latitude) < 0.00001 &&
          Math.abs(routeCoordinates[1].longitude - destination.longitude) < 0.00001;
          
        if (isLikelyStraightLine) {
          console.warn('⚠️ Route appears to be a straight line - API may have returned minimal routing');
          console.log('🔄 Generating better estimated route with waypoints...');
          routeCoordinates = generateEstimatedRoute(origin, destination);
          console.log(`✅ Enhanced route with ${routeCoordinates.length} waypoints for better visualization`);
        }
      }

      const segment = data.features[0].properties.segments[0];
      
      console.log('🔍 OpenRouteService segment data:', {
        rawDistance: segment.distance,
        rawDuration: segment.duration,
        allSegments: data.features[0].properties.segments.length,
        segmentData: segment
      });
      
      const distance = segment.distance / 1000; // Convert to km
      const duration = segment.duration / 60; // Convert to minutes

      console.log('📐 Distance conversion:', {
        rawDistance: segment.distance,
        convertedDistance: distance,
        convertedKm: distance.toFixed(1),
        isZero: distance === 0,
        isNaN: isNaN(distance),
        coordinatesCheck: {
          origin: `${origin.latitude}, ${origin.longitude}`,
          destination: `${destination.latitude}, ${destination.longitude}`,
          sameCoords: Math.abs(origin.latitude - destination.latitude) < 0.00001 && Math.abs(origin.longitude - destination.longitude) < 0.00001
        }
      });

      let formattedDistance = `${distance.toFixed(1)} km`;
      let formattedDuration = `${Math.round(duration)} min`;
      
      // If API returns 0 distance, very small distance, or formats to 0.0 km, use straight-line calculation as fallback
      if (distance === 0 || isNaN(distance) || distance < 0.01 || formattedDistance === "0.0 km") {
        console.warn('⚠️ API returned invalid or very small distance, using straight-line calculation as fallback');
        console.log('🔄 Original API values:', { rawDistance: segment.distance, convertedDistance: distance, formattedDistance });
        console.log('🔄 Calculating fallback distance between:', origin, destination);
        const straightLineResult = calculateStraightLineDistance(origin, destination, mode);
        formattedDistance = straightLineResult.distance;
        formattedDuration = straightLineResult.duration;
        console.log('✅ Using fallback distance and duration:', formattedDistance, formattedDuration, 'instead of API values');
      }
      
      // Generate traffic insights
      const trafficInfo = generateTrafficInsights(formattedDistance, formattedDuration, mode);

      const route = {
        coordinates: routeCoordinates,
        distance: formattedDistance,
        duration: formattedDuration,
        trafficInfo: trafficInfo
      };

      // Cache the result
      setRouteCache(prev => new Map(prev).set(cacheKey, route));
      console.log('✅ Route cached successfully for', mode);

      return route;
    } catch (error: any) {
      const isAbortError = error?.name === 'AbortError' || error?.message?.includes('Aborted');
      const errorType = isAbortError ? 'timeout/abort' : 'network/API';
      
      console.error(`Error fetching directions from OpenRouteService (attempt ${retryCount + 1}): [${errorType}]`, error?.message || error);
      
      // Retry up to 2 times with exponential backoff
      if (retryCount < 2) {
        const retryDelay = isAbortError ? 2000 * (retryCount + 1) : 1000 * (retryCount + 1);
        console.log(`🔄 Retrying OpenRouteService request (attempt ${retryCount + 2}) after ${retryDelay}ms...`);
        
        // Wait before retrying (longer delay for abort errors)
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        try {
          return await getRouteFromORS(origin, destination, mode, retryCount + 1);
        } catch (retryError: any) {
          const retryIsAbort = retryError?.name === 'AbortError' || retryError?.message?.includes('Aborted');
          console.error(`Retry ${retryCount + 2} also failed [${retryIsAbort ? 'timeout/abort' : 'network/API'}]:`, retryError?.message || retryError);
          // Continue to fallback below
        }
      }
      
      // All retries failed, try alternative approach
      console.log('💡 Alternative routing services (Google, MapBox) are available but require API key setup');
      
      // Create a better fallback route with intermediate waypoints to simulate road following
      console.warn('🚨 OpenRouteService failed after all retries, creating estimated route with waypoints');
      const fallbackResult = calculateStraightLineDistance(origin, destination, mode);
      const fallbackTrafficInfo = generateTrafficInsights(fallbackResult.distance, fallbackResult.duration, mode);
      
      // Generate intermediate waypoints to simulate road following
      const estimatedRoute = generateEstimatedRoute(origin, destination);
      
      const fallbackRoute = {
        coordinates: estimatedRoute,
        distance: fallbackResult.distance,
        duration: fallbackResult.duration,
        trafficInfo: fallbackTrafficInfo
      };
      
      return fallbackRoute;
    }
  };

  // Alternative routing service using Google Directions API
  const getRouteFromGoogle = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: string
  ) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      // Convert travel mode for Google API
      let googleMode = 'walking';
      switch (mode) {
        case 'driving':
          googleMode = 'driving';
          break;
        case 'walking':
          googleMode = 'walking';
          break;
        case 'bicycling':
          googleMode = 'bicycling';
          break;
        case 'transit':
          googleMode = 'transit';
          break;
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=${googleMode}&key=YOUR_GOOGLE_API_KEY`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Google API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status !== 'OK' || !data.routes?.[0]) {
        throw new Error(`Google API Status: ${data.status}`);
      }

      // Decode polyline from Google response
      const route = data.routes[0];
      const polyline = route.overview_polyline.points;
      const coordinates = decodePolyline(polyline);
      
      if (coordinates.length < 2) {
        throw new Error('Insufficient route coordinates from Google');
      }

      const leg = route.legs[0];
      const distance = leg.distance.text;
      const duration = leg.duration.text;
      
      return {
        coordinates,
        distance,
        duration,
        trafficInfo: generateTrafficInsights(distance, duration, mode)
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  // Alternative routing service using MapBox Directions API
  const getRouteFromMapBox = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: string
  ) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      // Convert travel mode for MapBox API
      let mapboxMode = 'walking';
      switch (mode) {
        case 'driving':
          mapboxMode = 'driving';
          break;
        case 'walking':
          mapboxMode = 'walking';
          break;
        case 'bicycling':
          mapboxMode = 'cycling';
          break;
        case 'transit':
          mapboxMode = 'walking'; // MapBox doesn't have transit, fall back to walking
          break;
      }

      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/${mapboxMode}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?geometries=geojson&access_token=YOUR_MAPBOX_TOKEN`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`MapBox API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.routes?.[0]) {
        throw new Error('No routes found from MapBox');
      }

      const route = data.routes[0];
      const coordinates = route.geometry.coordinates.map((coord: number[]) => ({
          latitude: coord[1],
          longitude: coord[0]
        }));
        
      if (coordinates.length < 2) {
        throw new Error('Insufficient route coordinates from MapBox');
      }

      const distance = `${(route.distance / 1000).toFixed(1)} km`;
      const duration = route.duration < 60 ? '< 1 min' : 
                     route.duration < 3600 ? `${Math.round(route.duration / 60)} min` :
                     `${Math.floor(route.duration / 3600)}h ${Math.round((route.duration % 3600) / 60)}m`;
      
      return {
          coordinates,
          distance,
        duration,
        trafficInfo: generateTrafficInsights(distance, duration, mode)
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  // Helper function to decode Google polyline
  const decodePolyline = (encoded: string): Array<{latitude: number, longitude: number}> => {
    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let byte = 0;
      let shift = 0;
      let result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1F) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1F) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5
      });
    }

    return points;
  };

  // Generate estimated route with waypoints to simulate road following
  const generateEstimatedRoute = (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): Array<{ latitude: number; longitude: number }> => {
    const points = [];
    
    // Always start with origin
    points.push({ latitude: origin.latitude, longitude: origin.longitude });
    
    // Calculate distance to determine number of waypoints
    const latDiff = destination.latitude - origin.latitude;
    const lngDiff = destination.longitude - origin.longitude;
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
    
    // Only add intermediate waypoints if distance is significant
    if (distance > 0.001) {
      // Add waypoints based on distance (more waypoints for longer distances)
      const numberOfWaypoints = Math.min(Math.max(Math.floor(distance * 1000), 2), 15);
      
      for (let i = 1; i < numberOfWaypoints; i++) {
        const ratio = i / numberOfWaypoints;
        
        // Add some variation to simulate road following instead of straight line
        const latVariation = (Math.random() - 0.5) * 0.0005; // Small random offset
        const lngVariation = (Math.random() - 0.5) * 0.0005;
        
        // Use grid-like movement (Manhattan distance) to simulate city streets
        let intermediatePoint;
        if (i % 2 === 0) {
          // Even waypoints: move horizontally first, then vertically
          intermediatePoint = {
            latitude: origin.latitude + (destination.latitude - origin.latitude) * ratio + latVariation,
            longitude: origin.longitude + (destination.longitude - origin.longitude) * Math.min(ratio * 1.2, 1) + lngVariation
          };
        } else {
          // Odd waypoints: move vertically first, then horizontally  
          intermediatePoint = {
            latitude: origin.latitude + (destination.latitude - origin.latitude) * Math.min(ratio * 1.2, 1) + latVariation,
            longitude: origin.longitude + (destination.longitude - origin.longitude) * ratio + lngVariation
          };
        }
        
        points.push(intermediatePoint);
      }
    }
    
    // Always end with destination
    points.push({ latitude: destination.latitude, longitude: destination.longitude });
    
    console.log(`🛣️ Generated estimated route with ${points.length} waypoints`);
    return points;
  };

  // Helper function for straight line distance with duration calculation
  // Helper function to calculate distance in meters between two coordinates
  const calculateDistanceInMeters = (
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Helper function to generate dots along a line segment
  const generateDotsAlongLine = (
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number },
    dotSpacing: number = 50 // meters between dots
  ): Array<{ latitude: number; longitude: number }> => {
    const distance = calculateDistanceInMeters(start, end);
    const numDots = Math.floor(distance / dotSpacing);
    if (numDots < 1) return [];
    
    const dots: Array<{ latitude: number; longitude: number }> = [];
    for (let i = 1; i < numDots; i++) {
      const ratio = i / numDots;
      dots.push({
        latitude: start.latitude + (end.latitude - start.latitude) * ratio,
        longitude: start.longitude + (end.longitude - start.longitude) * ratio,
      });
    }
    return dots;
  };

  const calculateStraightLineDistance = (origin: any, destination: any, travelMode: string = 'walking') => {
    console.log('🔍 calculateStraightLineDistance called with:', {
      origin: { lat: origin.latitude, lon: origin.longitude },
      destination: { lat: destination.latitude, lon: destination.longitude },
      travelMode
    });
    console.log('🧮 Starting Haversine formula calculation...');
    
    const R = 6371; // Earth's radius in km
    const dLat = (destination.latitude - origin.latitude) * Math.PI / 180;
    const dLon = (destination.longitude - origin.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(origin.latitude * Math.PI / 180) * Math.cos(destination.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    console.log('📏 Straight line distance calculated:', distance, 'km');
    
    // Check if coordinates are the same
    if (Math.abs(origin.latitude - destination.latitude) < 0.00001 && 
        Math.abs(origin.longitude - destination.longitude) < 0.00001) {
      console.warn('⚠️ Same coordinates detected in straight line calculation');
      console.warn('🔍 Coordinate details:', {
        origin: `${origin.latitude}, ${origin.longitude}`,
        destination: `${destination.latitude}, ${destination.longitude}`,
        latDiff: Math.abs(origin.latitude - destination.latitude),
        lonDiff: Math.abs(origin.longitude - destination.longitude)
      });
    }
    
    // Additional validation
    if (distance === 0) {
      console.warn('⚠️ Calculated distance is exactly 0 - this indicates identical coordinates');
    }
    
    if (distance < 0.001) {
      console.warn('⚠️ Calculated distance is very small:', distance, 'km - coordinates might be very close');
    }
    
    // Calculate realistic duration based on travel mode
    let averageSpeed;
    switch (travelMode) {
      case 'walking':
        averageSpeed = 5; // 5 km/h walking speed
        break;
      case 'bicycling':
        averageSpeed = 15; // 15 km/h cycling speed
        break;
      case 'driving':
        averageSpeed = 40; // 40 km/h city driving
        break;
      case 'transit':
        averageSpeed = 25; // 25 km/h public transport
        break;
      default:
        averageSpeed = 5; // Default to walking
    }

    const duration = (distance / averageSpeed) * 60; // Convert to minutes

    let formattedDuration;
    if (duration < 1) {
      formattedDuration = '< 1 min';
    } else if (duration >= 60) {
      const hours = Math.floor(duration / 60);
      const mins = Math.round(duration % 60);
      formattedDuration = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    } else {
      formattedDuration = Math.round(duration) + ' min';
    }
    
    return {
      distance: `${distance.toFixed(1)} km`,
      duration: formattedDuration
    };
  };

  // Generate realistic traffic insights based on time and distance
  const generateTrafficInsights = (distance: string, duration: string, travelMode: string) => {
    const now = new Date();
    const hour = now.getHours();
    const distanceNum = parseFloat(distance.replace(' km', ''));
    
    // Traffic conditions based on time of day and distance
    let condition: 'light' | 'moderate' | 'heavy' = 'light';
    let estimatedDelay = '0 min';
    let alternativeRoutes = 1;
    
    // Peak hours: 7-9 AM and 5-7 PM
    const isPeakHours = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
    
    if (travelMode === 'driving') {
      if (isPeakHours && distanceNum > 2) {
        condition = 'heavy';
        estimatedDelay = `${Math.round(distanceNum * 2)} min delay`;
        alternativeRoutes = 3;
      } else if (isPeakHours || distanceNum > 5) {
        condition = 'moderate';
        estimatedDelay = `${Math.round(distanceNum)} min delay`;
        alternativeRoutes = 2;
      } else {
        condition = 'light';
        estimatedDelay = 'No delays';
        alternativeRoutes = 1;
      }
    } else if (travelMode === 'transit') {
      if (isPeakHours) {
        condition = 'moderate';
        estimatedDelay = '2-5 min delay';
        alternativeRoutes = 2;
      } else {
        condition = 'light';
        estimatedDelay = 'On time';
        alternativeRoutes = 1;
      }
    } else {
      // Walking and bicycling
      condition = 'light';
      estimatedDelay = 'No delays';
      alternativeRoutes = 1;
    }
    
    return {
      condition,
      estimatedDelay,
      alternativeRoutes
    };
  };

  // Get traffic condition styling
  const getTrafficStyle = (condition: 'light' | 'moderate' | 'heavy') => {
    switch (condition) {
      case 'light':
        return { color: '#4CAF50', icon: 'checkmark-circle' as const };
      case 'moderate':
        return { color: '#FF9800', icon: 'warning' as const };
      case 'heavy':
        return { color: '#F44336', icon: 'alert-circle' as const };
      default:
        return { color: '#4CAF50', icon: 'checkmark-circle' as const };
    }
  };

  const fetchBusinessDetails = async (businessId: string) => {
    try {
      const businessDoc = await getDoc(doc(db, 'businesses', businessId));
      if (businessDoc.exists()) {
        const data = businessDoc.data() as BusinessDetails;
        setSelectedBusinessDetails(data);
      } else {
        console.error('Business not found');
        setSelectedBusinessDetails(null);
      }
    } catch (error) {
      console.error('Error fetching business details:', error);
      setSelectedBusinessDetails(null);
    }
  };

  const fetchBusinessReviews = async (businessId: string) => {
    try {
      const reviewsRef = collection(db, 'businesses', businessId, 'reviews');
      
      // Set up real-time listener for reviews
      const unsubscribe = onSnapshot(reviewsRef, (reviewsSnapshot) => {
        const reviews: any[] = [];
        let totalRating = 0;
        let reviewCount = 0;
        
        reviewsSnapshot.forEach((doc) => {
          const reviewData = doc.data();
          const review = { id: doc.id, ...reviewData };
          reviews.push(review);
          if (reviewData.rating && typeof reviewData.rating === 'number') {
            totalRating += reviewData.rating;
            reviewCount++;
          }
        });
        
        const averageRating = reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : '0.0';
        
        setBusinessReviews(prev => ({
          ...prev,
          [businessId]: reviews
        }));
        
        setBusinessRatings(prev => ({
          ...prev,
          [businessId]: {
            average: averageRating,
            count: reviewCount
          }
        }));
      });
      
      // Store unsubscribe function for cleanup
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching reviews for business:', businessId, error);
    }
  };

  const calculateDistance = useCallback(async (destination: Place) => {
    if (!location) {
      return;
    }

    try {
      const origin = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      // Use businessLocation if available, otherwise fall back to latitude/longitude
      const destinationCoords = {
        latitude: destination?.businessLocation?.latitude || destination?.latitude || 0,
        longitude: destination?.businessLocation?.longitude || destination?.longitude || 0,
      };
      
      // Validate destination coordinates
      if (!destinationCoords.latitude || !destinationCoords.longitude) {
        return;
      }
      
      // Use OSRM for reliable routing
      try {
        const detailedRoute = await getRouteFromOSRM(origin, destinationCoords, selectedTravelMode);
        
        if (detailedRoute && detailedRoute.coordinates && detailedRoute.coordinates.length > 2) {
          setRouteDetails(detailedRoute);
          return;
        }
      } catch (osrmError) {
        // Fallback to OpenRouteService
        try {
          const orsRoute = await getRouteFromORS(origin, destinationCoords, selectedTravelMode);
          if (orsRoute && orsRoute.coordinates && orsRoute.coordinates.length > 2) {
            setRouteDetails(orsRoute);
            return;
          }
        } catch (orsError) {
          // Both APIs failed
        }
      }
      
      // Final fallback - enhanced estimated route
      const estimatedCoords = generateEstimatedRoute(origin, destinationCoords);
      const fallbackResult = calculateStraightLineDistance(origin, destinationCoords, selectedTravelMode);
      const trafficInfo = generateTrafficInsights(fallbackResult.distance, fallbackResult.duration, selectedTravelMode);
      
      setRouteDetails({
        coordinates: estimatedCoords,
        distance: fallbackResult.distance,
        duration: fallbackResult.duration,
        trafficInfo: trafficInfo
      });
    } catch (error) {
      // Emergency fallback
      const origin = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      const destinationCoords = {
        latitude: destination?.businessLocation?.latitude || destination?.latitude || 0,
        longitude: destination?.businessLocation?.longitude || destination?.longitude || 0,
      };
      
      if (destinationCoords.latitude && destinationCoords.longitude) {
        const estimatedCoords = generateEstimatedRoute(origin, destinationCoords);
        const fallbackResult = calculateStraightLineDistance(origin, destinationCoords, selectedTravelMode);
        const trafficInfo = generateTrafficInsights(fallbackResult.distance, fallbackResult.duration, selectedTravelMode);
        
        setRouteDetails({
          coordinates: estimatedCoords,
          distance: fallbackResult.distance,
          duration: fallbackResult.duration,
          trafficInfo: trafficInfo
        });
      }
    }
  }, [location, selectedTravelMode]);

  const handlePlaceSelect = useCallback(async (business: Place) => {
    setSelectedPlace(business);
    
    // Check if business is closed
    checkIfBusinessClosed(business);
    
    // Create business details object for the modal
    const businessDetails = {
      name: business.name,
      businessType: business.businessType || business.description || 'Business',
      location: business.location || business.address || 'Location not available',
      businessHours: business.businessHours || 'Business hours not available',
      contactNumber: business.contactNumber || 'Contact not available',
      image: business.image || '',
      allImages: business.allImages || [],
      latitude: business.latitude,
      longitude: business.longitude,
      description: business.description,
      openingTime: business.openingTime,
      closingTime: business.closingTime,
    };
    
    setSelectedBusinessDetails(businessDetails);
    
    setDetailsModalVisible(true);
    setCurrentImageIndex(0); // Reset image index for new business
    
    if (business.businessLocation) {
      calculateDistance(business);
    }
  }, [calculateDistance]);

  const centerOnUser = useCallback(() => {
    if (location) {
      adjustMapToRadius(circleRadius);
    }
  }, [location, circleRadius]);

  const increaseRadius = useCallback(() => {
    if (circleRadius < 2000) {
      const newRadius = Math.min(circleRadius + 100, 2000);
      setCircleRadius(newRadius);
      adjustMapToRadius(newRadius);
    }
  }, [circleRadius]);

  const decreaseRadius = useCallback(() => {
    if (circleRadius > 500) {
      const newRadius = Math.max(circleRadius - 100, 500);
      setCircleRadius(newRadius);
      adjustMapToRadius(newRadius);
    }
  }, [circleRadius]);

  const adjustMapToRadius = useCallback((radius: number) => {
    if (location && mapRef.current) {
      // Calculate appropriate zoom level based on radius
      // Formula: larger radius = larger delta (more zoomed out)
      const radiusInKm = radius / 1000; // Convert meters to km
      const latitudeDelta = radiusInKm * 0.018; // Roughly 1 degree ≈ 111km
      const longitudeDelta = radiusInKm * 0.018;
      
      console.log('🗺️ Adjusting map view for radius:', radius, 'meters');
      console.log('📏 Map deltas:', { latitudeDelta, longitudeDelta });
      
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: latitudeDelta,
        longitudeDelta: longitudeDelta,
      }, 500); // 500ms animation duration
    }
  }, [location]);

  // Memoize nearby businesses calculation for performance
  const nearbyBusinessesMemo = useMemo(() => {
    if (!location || !places.length) return [];
    return places.filter(place => {
      const dist = haversineDistance(
        location.coords.latitude,
        location.coords.longitude,
        place.businessLocation.latitude,
        place.businessLocation.longitude
      );
      return dist * 1000 <= circleRadius; // Use dynamic circleRadius instead of fixed 500
    });
  }, [location, places, circleRadius]);

  // Update nearby businesses state and check for new ones
  useEffect(() => {
    setNearbyBusinesses(nearbyBusinessesMemo);
    
    // Check for newly detected businesses
    const newBusinesses = nearbyBusinessesMemo.filter(business => !previouslyDetectedBusinessesRef.current.has(business.id));
    
    // Only show modal if there are NEW nearby businesses and not navigating
    if (newBusinesses.length > 0 && !isNavigating) {
      setShowNearbyModal(true);
    }
    
    // Update the set of previously detected businesses
    const currentBusinessIds = new Set(nearbyBusinessesMemo.map(business => business.id));
    previouslyDetectedBusinessesRef.current = currentBusinessIds;
  }, [nearbyBusinessesMemo, isNavigating]);

  // Reset previously detected businesses when radius changes significantly
  useEffect(() => {
    previouslyDetectedBusinessesRef.current = new Set();
  }, [circleRadius]);

  // Reset modal visibility on mount or refresh
  useEffect(() => {
    setShowNearbyModal(false);
  }, []);

  // Fetch reviews for nearby businesses and preload images
  useEffect(() => {
    if (nearbyBusinesses.length > 0) {
      nearbyBusinesses.forEach(business => {
        // Fetch reviews
        const unsubscribe = fetchBusinessReviews(business.id);
        setReviewUnsubscribes(prev => ({
          ...prev,
          [business.id]: unsubscribe
        }));

        // Preload business images for instant display
        const imageUri = business.allImages?.[0] || business.image;
        if (imageUri) {
          console.log('🖼️ Preloading business image:', business.name);
          preloadImage(imageUri);
        }
      });
    }
    
    // Cleanup function
    return () => {
      Object.values(reviewUnsubscribes).forEach(unsubscribe => {
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, [nearbyBusinesses]);

  const handleMarkerPress = useCallback(async (business: Place) => {
    // Track business view
    try {
      if (business.id) {
        const businessRef = doc(db, 'businesses', business.id);
        await updateDoc(businessRef, {
          viewCount: increment(1),
          lastViewedAt: new Date().toISOString(),
        });
        console.log('✅ View tracked for:', business.name);
      }
    } catch (error) {
      console.log('❌ Error tracking view:', error);
    }
    
    setSelectedPlace(business);
    setDetailsModalVisible(true);
    checkIfBusinessClosed(business);
    if (business.businessLocation) {
      calculateDistance(business);
    }
  }, [calculateDistance]);

  const stopNavigation = useCallback(() => {
    console.log('🛑 Stopping navigation');
    setIsNavigating(false);
    
    // Preserve the full detailed route after navigation stops
    if (routeDetails) {
      console.log('💾 Preserving full detailed route after navigation stop:', routeDetails.distance);
      // Keep the detailed coordinates that follow roads, don't simplify to straight line
      setRouteDetails(routeDetails);
    } else {
      setRouteDetails(null);
    }
    
    // Reset map to show all business markers
    setTimeout(() => {
      if (mapReady && places.length > 0 && mapRef.current && location) {
        console.log('🗺️ Resetting map view to show all businesses');
        const coordinates = places.map(place => ({
          latitude: place.businessLocation.latitude,
          longitude: place.businessLocation.longitude,
        }));
        
        coordinates.push({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
          animated: true,
        });
      }
    }, 500);
  }, [mapReady, places, location, routeDetails]);

  // Pre-compute routes for faster navigation
  useEffect(() => {
    const preComputeRoutes = async () => {
      if (!location || !selectedPlace || !detailsModalVisible) return;

      console.log('🔄 Pre-computing routes for faster navigation...');
      setIsLoading(true);
      
      try {
        const origin = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        const destination = {
          latitude: selectedPlace.businessLocation?.latitude || selectedPlace.latitude,
          longitude: selectedPlace.businessLocation?.longitude || selectedPlace.longitude,
        };

        // Pre-compute route for current travel mode first
        console.log('🔄 Pre-computing route with coordinates:', { origin, destination });
        const currentRoute = await getRouteFromORS(origin, destination, selectedTravelMode);
        if (currentRoute) {
          console.log(`✅ Current route (${selectedTravelMode}) pre-computed:`, {
            distance: currentRoute.distance,
            duration: currentRoute.duration,
            coordinatesCount: currentRoute.coordinates?.length || 0
          });
          
          // If we already have route details with a good distance, preserve it if API returns 0.0 km
          if (routeDetails && currentRoute.distance === "0.0 km" && routeDetails.distance !== "0.0 km") {
            console.log('🔄 Preserving existing good distance:', routeDetails.distance, 'over API result:', currentRoute.distance);
            currentRoute.distance = routeDetails.distance;
          }
          
          setRouteDetails(currentRoute);
        } else {
          console.warn('❌ Failed to pre-compute route, no route returned');
        }

        // Pre-compute other travel modes in background for instant switching
        const otherModes = ['driving', 'walking', 'bicycling', 'transit'].filter(mode => mode !== selectedTravelMode);
        
        // Use Promise.allSettled to continue even if some routes fail
        Promise.allSettled(
          otherModes.map(mode => getRouteFromORS(origin, destination, mode))
        ).then(results => {
          const successCount = results.filter(r => r.status === 'fulfilled').length;
          console.log(`🎯 Pre-computed ${successCount}/${otherModes.length} additional routes`);
        });

      } catch (error) {
        console.error('Error pre-computing routes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Only pre-compute when modal opens and we have necessary data
    // Don't override existing good route details
    if (detailsModalVisible && (!routeDetails || routeDetails.distance === "0.0 km")) {
      console.log('🔄 Pre-computing routes (no existing route or existing route has 0 distance)');
      preComputeRoutes();
    } else if (detailsModalVisible && routeDetails) {
      console.log('✅ Skipping route pre-computation - already have good route:', routeDetails.distance);
    }
     }, [detailsModalVisible, location, selectedPlace, selectedTravelMode, routeDetails?.distance]);

   // Auto-detection is now handled by useEffect hooks above

   // Fast route switching effect - uses cached routes immediately  
   useEffect(() => {
     const switchRouteMode = async () => {
       if (!location || !selectedPlace || !detailsModalVisible) return;

       const origin = {
         latitude: location.coords.latitude,
         longitude: location.coords.longitude,
       };

       const destination = {
         latitude: selectedPlace.businessLocation?.latitude || selectedPlace.latitude,
         longitude: selectedPlace.businessLocation?.longitude || selectedPlace.longitude,
       };

       const cacheKey = `${origin.latitude}-${origin.longitude}-${destination.latitude}-${destination.longitude}-${selectedTravelMode}`;
       
       // Check if we have this route cached
       if (routeCache.has(cacheKey)) {
         console.log(`🎯 Instant route switch to ${selectedTravelMode} using cache`);
         const cachedRoute = routeCache.get(cacheKey);
         setRouteDetails(cachedRoute);
       } else {
         console.log(`🔄 Calculating new route for ${selectedTravelMode}...`);
         
         // Calculate route immediately for this travel mode
         try {
           const newRoute = await getRouteFromORS(origin, destination, selectedTravelMode);
           if (newRoute) {
             console.log(`✅ New route calculated for ${selectedTravelMode}:`, {
               distance: newRoute.distance,
               duration: newRoute.duration
             });
             setRouteDetails(newRoute);
           } else {
             // If API fails, use fallback calculation with correct travel mode
             console.log(`⚠️ API failed for ${selectedTravelMode}, using fallback calculation`);
             const fallbackResult = calculateStraightLineDistance(origin, destination, selectedTravelMode);
             const fallbackTrafficInfo = generateTrafficInsights(fallbackResult.distance, fallbackResult.duration, selectedTravelMode);
             
             const fallbackRoute = {
               coordinates: [origin, destination],
               distance: fallbackResult.distance,
               duration: fallbackResult.duration,
               trafficInfo: fallbackTrafficInfo
             };
             
             setRouteDetails(fallbackRoute);
           }
         } catch (error) {
           console.error(`Error calculating route for ${selectedTravelMode}:`, error);
           // Fallback calculation
           const fallbackResult = calculateStraightLineDistance(origin, destination, selectedTravelMode);
           const fallbackTrafficInfo = generateTrafficInsights(fallbackResult.distance, fallbackResult.duration, selectedTravelMode);
           
           const fallbackRoute = {
             coordinates: [origin, destination],
             distance: fallbackResult.distance,
             duration: fallbackResult.duration,
             trafficInfo: fallbackTrafficInfo
           };
           
           setRouteDetails(fallbackRoute);
         }
       }
     };

     switchRouteMode();
   }, [selectedTravelMode]);

   // Monitor route details changes to ensure polyline renders immediately
   useEffect(() => {
     if (routeDetails?.coordinates && routeDetails.coordinates.length >= 2) {
       console.log('🔄 Route details updated, coordinates available:', routeDetails.coordinates.length);
       
       // Force a small delay to ensure polyline renders
       if (isNavigating && mapRef.current) {
         setTimeout(() => {
           console.log('🗺️ Auto-fitting map to updated route');
           mapRef.current?.fitToCoordinates(routeDetails.coordinates, {
             edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
             animated: true,
           });
         }, 300);
       }
     }
   }, [routeDetails?.coordinates, isNavigating]);

   // Monitor navigation state to ensure destination marker is visible
   useEffect(() => {
     if (isNavigating && selectedPlace && location && mapRef.current) {
       console.log('🗺️ Navigation started, fitting map to show user and destination');
       console.log('📍 Selected place:', {
         name: selectedPlace.name,
         lat: selectedPlace.latitude,
         lon: selectedPlace.longitude,
         businessLat: selectedPlace.businessLocation?.latitude,
         businessLon: selectedPlace.businessLocation?.longitude
       });
       
       const userLat = location.coords.latitude;
       const userLon = location.coords.longitude;
       const destLat = selectedPlace.businessLocation?.latitude || selectedPlace.latitude;
       const destLon = selectedPlace.businessLocation?.longitude || selectedPlace.longitude;
       
       console.log('🎯 Final coordinates for map fitting:', {
         user: { lat: userLat, lon: userLon },
         destination: { lat: destLat, lon: destLon }
       });
       
       if (destLat && destLon) {
         setTimeout(() => {
           if (mapRef.current) {
             console.log('🗺️ Fitting map to coordinates');
             mapRef.current.fitToCoordinates(
               [
                 { latitude: userLat, longitude: userLon },
                 { latitude: destLat, longitude: destLon }
               ],
               {
                 edgePadding: { top: 200, right: 100, bottom: 200, left: 100 },
                 animated: true,
               }
             );
           }
         }, 1000); // Increased delay to ensure marker is rendered
       } else {
         console.error('❌ Missing destination coordinates for map fitting');
       }
     }
   }, [isNavigating, selectedPlace, location]);

   // Monitor navigation state changes
   useEffect(() => {
     if (isNavigating && selectedPlace) {
       console.log('🎯 Navigation active for:', selectedPlace.name);
       console.log('📍 Route details during navigation:', {
         hasRouteDetails: !!routeDetails,
         coordinatesCount: routeDetails?.coordinates?.length || 0,
         distance: routeDetails?.distance || 'N/A',
         duration: routeDetails?.duration || 'N/A'
       });
     } else if (!isNavigating) {
       console.log('🛑 Navigation stopped');
     }
   }, [isNavigating, selectedPlace, routeDetails]);

   // Monitor radius changes and adjust map view accordingly
   useEffect(() => {
     if (!isNavigating && location && mapRef.current) {
       console.log('📐 Radius changed to:', circleRadius, 'meters - adjusting map view');
       adjustMapToRadius(circleRadius);
     }
   }, [circleRadius, isNavigating]);

   // Handle business passed via route parameters
   useEffect(() => {
     if (route.params?.business) {
       const business = route.params.business;
       console.log('📍 Business passed via navigation:', business.name);
       
       // Set the business as selected and open the modal
       setSelectedPlace(business);
       
       // Create business details from the passed business
       const businessDetails = {
         name: business.name,
         businessType: business.businessType || business.description || 'Business',
         location: business.location || business.address || 'Location not available',
         businessHours: business.businessHours || 'Business hours not available',
         contactNumber: business.contactNumber || 'Contact not available',
         image: business.image || '',
         allImages: business.allImages || [],
         latitude: business.latitude,
         longitude: business.longitude,
         description: business.description,
       };
       
       setSelectedBusinessDetails(businessDetails);
       setDetailsModalVisible(true);
       setCurrentImageIndex(0);
       
       // Calculate distance if we have location
       if (location && business.businessLocation) {
         calculateDistance(business);
       }
     }
   }, [route.params?.business, location]);

  // Update the getBusinessImage function
  const getBusinessImage = (place: Place | BusinessDetails) => {
    if ('image' in place && place.image) {
      return { uri: place.image };
    } else if ('allImages' in place && place.allImages && place.allImages.length > 0) {
      return { uri: place.allImages[0] };
    }
    return null;
  };

  // Add effect to fit map to markers when businesses load
  useEffect(() => {
    if (mapReady && places.length > 0 && mapRef.current) {
      // Auto-fit map to show all business markers
      const coordinates = places.map(place => ({
        latitude: place.businessLocation.latitude,
        longitude: place.businessLocation.longitude,
      }));
      
      // Add user location if available
      if (location || cachedLocation) {
        coordinates.push({
          latitude: location?.coords.latitude || cachedLocation?.coords.latitude || 0,
          longitude: location?.coords.longitude || cachedLocation?.coords.longitude || 0,
        });
      }
      
      if (coordinates.length > 0) {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
          animated: true,
        });
      }
    }
  }, [mapReady, places.length, location, cachedLocation]);

  // Update the FlatList data handling
  const getCarouselImages = (place: Place): string[] => {
    if (place.allImages && place.allImages.length > 0) {
      return place.allImages.filter((img): img is string => img !== undefined);
    }
    return place.image ? [place.image] : ['https://via.placeholder.com/400'];
  };

  // Update the handleStartNavigation function
  const handleStartNavigation = async () => {
    if (!location || !selectedPlace) {
      Alert.alert('Error', 'Location or destination not available');
      return;
    }

    setIsNavigationLoading(true);
    
    // Immediate UI feedback - close modal and show navigation mode
    setDetailsModalVisible(false);
    setIsNavigating(true);

    try {
      const origin = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      const destination = {
        latitude: selectedPlace?.businessLocation?.latitude || selectedPlace?.latitude || 0,
        longitude: selectedPlace?.businessLocation?.longitude || selectedPlace?.longitude || 0,
      };

      // Validate destination coordinates
      if (!destination.latitude || !destination.longitude) {
        Alert.alert('Error', 'Invalid destination coordinates');
        setIsNavigationLoading(false);
        return;
      }

      // If we already have route details, use them immediately
      if (routeDetails && routeDetails.coordinates && routeDetails.coordinates.length > 0) {
        console.log('✅ Using existing route details for navigation:', {
          coordinatesCount: routeDetails.coordinates.length,
          distance: routeDetails.distance,
          duration: routeDetails.duration
        });
        // Immediately fit the map to show the route
        setTimeout(() => {
          if (mapRef.current && routeDetails.coordinates && routeDetails.coordinates.length >= 2) {
            mapRef.current.fitToCoordinates(routeDetails.coordinates, {
              edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
              animated: true,
            });
          }
        }, 100);
        
        setIsNavigationLoading(false);
        return;
      }
      
      console.log('⚠️ No existing route details, creating fallback route');
      
      // Show immediate enhanced route for instant feedback (with waypoints)
      const estimatedCoords = generateEstimatedRoute(origin, destination);
      const fallbackResult = calculateStraightLineDistance(origin, destination, selectedTravelMode);
      const fallbackTrafficInfo = generateTrafficInsights(fallbackResult.distance, fallbackResult.duration, selectedTravelMode);
      
      const fallbackRoute = {
        coordinates: estimatedCoords,
        distance: fallbackResult.distance,
        duration: fallbackResult.duration,
        trafficInfo: fallbackTrafficInfo
      };
      
      setRouteDetails(fallbackRoute);
      console.log('✅ Set fallback route details:', {
        coordinatesCount: fallbackRoute.coordinates.length,
        distance: fallbackRoute.distance,
        duration: fallbackRoute.duration
      });
      
      // Force immediate re-render and map update
      setTimeout(() => {
        if (mapRef.current && estimatedCoords.length >= 2) {
          mapRef.current.fitToCoordinates(estimatedCoords, {
            edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
            animated: true,
          });
        }
      }, 50);

      // Get the real route using OSRM (more reliable than ORS)
      try {
        const route = await getRouteFromOSRM(origin, destination, selectedTravelMode);
        
        if (route && route.coordinates && route.coordinates.length > 2) {
          setRouteDetails(route);
          
          // Update map with real route - force immediate update
          setTimeout(() => {
            if (mapRef.current && route.coordinates && route.coordinates.length >= 2) {
              mapRef.current.fitToCoordinates(route.coordinates, {
                edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
                animated: true,
              });
            }
          }, 200);
        } else {
          throw new Error('OSRM returned insufficient coordinates');
        }
      } catch (osrmError) {
        // Fallback to OpenRouteService if OSRM fails
        try {
          const route = await getRouteFromORS(origin, destination, selectedTravelMode);
          
          if (route && route.coordinates && route.coordinates.length > 2) {
            setRouteDetails(route);
            
            // Update map with real route - force immediate update
            setTimeout(() => {
              if (mapRef.current && route.coordinates && route.coordinates.length >= 2) {
                mapRef.current.fitToCoordinates(route.coordinates, {
                  edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
                  animated: true,
                });
              }
            }, 200);
          }
        } catch (orsError) {
          // Both routing services failed, enhanced estimated route is already set above as fallback
        }
      }
    } catch (error) {
      Alert.alert('Navigation Error', 'Could not calculate detailed route. Using direct path.');
    } finally {
      setIsNavigationLoading(false);
    }
  };

  // OSRM routing function - more reliable than OpenRouteService
  const getRouteFromOSRM = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: string
  ) => {
    try {
      const transportMode = OSRM_TRANSPORT_MODES[mode as keyof typeof OSRM_TRANSPORT_MODES] || 'driving';
      const { latitude: startLat, longitude: startLng } = origin;
      const { latitude: endLat, longitude: endLng } = destination;

      // OSRM API call with full geometry for detailed road-following routes
      const response = await fetch(
        `${OSRM_BASE_URL}/${transportMode}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true&annotations=true`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`OSRM API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map((coord: number[]) => ({
          latitude: coord[1],
          longitude: coord[0]
        }));
        
        if (coordinates.length > 0) {
          const distance = `${(route.distance / 1000).toFixed(1)} km`;
          const duration = `${Math.round(route.duration / 60)} min`;
          
          // Generate traffic insights
          const trafficInfo = generateTrafficInsights(distance, duration, mode);
          
          return {
            coordinates,
            distance,
            duration,
            trafficInfo
          };
        }
      }
      
      throw new Error('No valid route found in OSRM response');
    } catch (error) {
      throw error;
    }
  };

  if (!hasPermission) {
    return (
      <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={{flex: 1}}>
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <Ionicons 
              name="location-outline" 
              size={iconSizes.xxxxl} 
              color={theme === 'dark' ? '#FFF' : '#333'} 
            />
            <Text style={[styles.permissionTitle, { color: theme === 'dark' ? '#FFF' : '#333' }]}>
              Location Access Required
            </Text>
            <Text style={[styles.permissionText, { color: theme === 'dark' ? '#CCC' : '#666' }]}>
              To show your location on the map and provide navigation features, we need access to your location.
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestLocationPermission}>
              <Text style={styles.permissionButtonText}>Enable Location Access</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={{flex: 1}}>
      <SafeAreaView style={styles.container}>
        {/* Header - hide during navigation */}
        {!isNavigating && (
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
        </View>
        )}

        {/* Search bar outside of map - hide during navigation */}
        {!isNavigating && (
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={iconSizes.md} color="#666" />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Search destination..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={searchPlaces}
            />
          </View>
          {searchResults.length > 0 && (
            <View style={styles.searchResultsContainer}>
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.searchResult}
                      onPress={() => {
                        console.log('Search result pressed for:', item.name);
                        handlePlaceSelect(item);
                      }}
                  >
                    <Text style={styles.searchResultName}>{item.name}</Text>
                    <Text style={styles.searchResultDesc}>{item.description}</Text>
          </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>
        )}
        
        <View style={styles.mapContainer}>
          <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
                latitude: cachedLocation?.coords.latitude || location?.coords.latitude || 10.7989,
                longitude: cachedLocation?.coords.longitude || location?.coords.longitude || 122.9744,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
            }}
            showsUserLocation={true}
            showsMyLocationButton={false}
              onMapReady={() => setMapReady(true)}
            >


              {/* Business markers - keep visible but dimmed during navigation, exclude destination when navigating */}
              {places
                .filter(place => !isNavigating || selectedPlace?.id !== place.id)
                .map((place) => (
                  <BusinessMarker
                    key={place.id}
                    place={place}
                    isNavigating={isNavigating}
                    isSelected={selectedPlace?.id === place.id}
                    onPress={handlePlaceSelect}
                    markerStyles={styles}
                    markerSize={markerSize}
                  />
                ))}



              {/* Destination marker - Default marker icon */}
              {isNavigating && selectedPlace?.businessLocation && (
              <Marker
                  key={`destination-${selectedPlace.id}`}
                coordinate={{
                    latitude: selectedPlace.businessLocation.latitude,
                    longitude: selectedPlace.businessLocation.longitude,
                  }}
                  title={`📍 ${selectedPlace.name}`}
                  description="Destination"
                  zIndex={2000}
                />
              )}

              {/* Route line - solid during navigation, no preview when not navigating */}
              {isNavigating && routeDetails?.coordinates && routeDetails.coordinates.length >= 2 && (
              <Polyline
                  coordinates={routeDetails.coordinates}
                  strokeColor="#4B50E6"
                  strokeWidth={6}
                  zIndex={1000}
                  geodesic={true}
                  lineJoin="round"
                  lineCap="round"
                  tappable={false}
                />
              )}

              {/* Connection line from user location to polyline start with dots */}
              {isNavigating && routeDetails?.coordinates && routeDetails.coordinates.length >= 2 && location && (() => {
                const userCoord = {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude
                };
                const polylineStart = routeDetails.coordinates[0];
                const gapDistance = calculateDistanceInMeters(userCoord, polylineStart);
                const hasGap = gapDistance > 20; // Show connection if gap is more than 20 meters
                
                if (hasGap) {
                  const connectionDots = generateDotsAlongLine(userCoord, polylineStart, 30);
                  return (
                    <>
                      {/* Dotted connection line */}
                      <Polyline
                        coordinates={[userCoord, polylineStart]}
                        strokeColor="#4B50E6"
                        strokeWidth={4}
                        lineDashPattern={[8, 4]}
                        zIndex={999}
                        geodesic={true}
                        lineJoin="round"
                        lineCap="round"
                      />
                      {/* Dots along the connection line */}
                      {connectionDots.map((dot, index) => (
                        <Circle
                          key={`start-dot-${index}`}
                          center={dot}
                          radius={4}
                          fillColor="#4B50E6"
                          strokeColor="#FFFFFF"
                          strokeWidth={1}
                          zIndex={998}
                        />
                      ))}
                    </>
                  );
                }
                return null;
              })()}

              {/* Connection line from polyline end to destination with dots */}
              {isNavigating && routeDetails?.coordinates && routeDetails.coordinates.length >= 2 && selectedPlace?.businessLocation && (() => {
                const polylineEnd = routeDetails.coordinates[routeDetails.coordinates.length - 1];
                const destinationCoord = {
                  latitude: selectedPlace.businessLocation.latitude,
                  longitude: selectedPlace.businessLocation.longitude
                };
                const gapDistance = calculateDistanceInMeters(polylineEnd, destinationCoord);
                const hasGap = gapDistance > 20; // Show connection if gap is more than 20 meters
                
                if (hasGap) {
                  const connectionDots = generateDotsAlongLine(polylineEnd, destinationCoord, 30);
                  return (
                    <>
                      {/* Dotted connection line */}
                      <Polyline
                        coordinates={[polylineEnd, destinationCoord]}
                        strokeColor="#4B50E6"
                        strokeWidth={4}
                        lineDashPattern={[8, 4]}
                        zIndex={999}
                        geodesic={true}
                        lineJoin="round"
                        lineCap="round"
                      />
                      {/* Dots along the connection line */}
                      {connectionDots.map((dot, index) => (
                        <Circle
                          key={`end-dot-${index}`}
                          center={dot}
                          radius={4}
                          fillColor="#4B50E6"
                          strokeColor="#FFFFFF"
                          strokeWidth={1}
                          zIndex={998}
                        />
                      ))}
                    </>
                  );
                }
                return null;
              })()}

              {/* Fallback straight line while calculating detailed route */}
              {isNavigationLoading && location && selectedPlace && (
              <Polyline
                  coordinates={[
                    {
                      latitude: location.coords.latitude,
                      longitude: location.coords.longitude,
                    },
                    {
                      latitude: selectedPlace.businessLocation?.latitude || selectedPlace.latitude,
                      longitude: selectedPlace.businessLocation?.longitude || selectedPlace.longitude,
                    }
                  ]}
                  strokeColor="rgba(75, 80, 230, 0.4)"
                  strokeWidth={3}
                  lineDashPattern={[5, 5]}
                  zIndex={999}
                />
              )}

              {/* User location circle - hide during navigation */}
              {!isNavigating && (location || cachedLocation) && (
                <Circle
                  center={{
                    latitude: location?.coords.latitude || cachedLocation?.coords.latitude || 0,
                    longitude: location?.coords.longitude || cachedLocation?.coords.longitude || 0,
                  }}
                  radius={circleRadius}
                  fillColor="rgba(75, 80, 230, 0.1)"
                  strokeColor="rgba(75, 80, 230, 0.3)"
                  strokeWidth={2}
              />
            )}
          </MapView>
          </View>



          {/* Radius control panel - hide during navigation */}
          {!isNavigating && showRadiusControl && (
            <View style={styles.radiusControlPanel}>
              <View style={styles.radiusButtons}>
                <TouchableOpacity 
                  style={[styles.radiusButtonSmall, circleRadius <= 500 && styles.radiusButtonDisabled]} 
                  onPress={decreaseRadius}
                  disabled={circleRadius <= 500}
                >
                  <Ionicons name="remove" size={iconSizes.sm} color={circleRadius <= 500 ? "#CCC" : "#3B2FEA"} />
                </TouchableOpacity>
                <Text style={styles.radiusValue}>{circleRadius}m</Text>
                <TouchableOpacity 
                  style={[styles.radiusButtonSmall, circleRadius >= 2000 && styles.radiusButtonDisabled]} 
                  onPress={increaseRadius}
                  disabled={circleRadius >= 2000}
                >
                  <Ionicons name="add" size={iconSizes.sm} color={circleRadius >= 2000 ? "#CCC" : "#3B2FEA"} />
                </TouchableOpacity>
              </View>
            </View>
          )}



          {/* Loading overlay - hide during navigation */}
          {!isNavigating && (location === null && cachedLocation === null) && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#4B50E6" />
              <Text style={styles.loadingText}>Getting your location...</Text>
            </View>
          )}
        </View>

        {/* Bottom panel - hide during navigation */}
        {!isNavigating && (
        <View style={styles.bottomPanel}>
          {loadingPlaces && (
              <View style={styles.businessLoadingOverlay}>
              <ActivityIndicator size="small" color="#667eea" />
                <Text style={styles.loadingText}>Loading businesses...</Text>
            </View>
          )}
          
            {selectedPlace && routeDetails && (
            <View style={styles.routeInfo}>
              <Text style={styles.routeTitle}>Route to {selectedPlace.name}</Text>
                <View style={styles.routeDetails}>
                  <Text style={styles.routeInfoItem}>
                    <Ionicons name="time" size={20} color="#666" />
                    <Text style={styles.routeInfoText}>{routeDetails.duration}</Text>
                  </Text>
                  <Text style={styles.routeInfoItem}>
                    <Ionicons name="navigate" size={20} color="#666" />
                    <Text style={styles.routeInfoText}>{routeDetails.distance}</Text>
              </Text>
                </View>
            </View>
          )}

          {isLoading && (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4B50E6" />
            </View>
          )}
        </View>
        )}

        {/* Navigation loading overlay */}
        {isNavigationLoading && (
          <View style={styles.navigationLoadingOverlay}>
            <View style={styles.navigationLoadingContent}>
              <ActivityIndicator size="large" color="#4B50E6" />
              <Text style={styles.navigationLoadingText}>Starting Navigation...</Text>
              <Text style={styles.navigationLoadingSubtext}>Optimizing route...</Text>
            </View>
          </View>
        )}

        {/* Clean Navigation UI - like Google Maps */}
        {isNavigating && (
          <>
            {/* Top navigation info bar */}
            <View style={styles.navigationTopBar}>
              <View style={styles.navigationInfo}>
                <Text style={styles.navigationDestination}>
                  {selectedPlace?.name || 'Destination'}
                </Text>
                {routeDetails && (
                  <View style={styles.navigationDetails}>
                    <Text style={styles.navigationTime}>{routeDetails.duration}</Text>
                    <Text style={styles.navigationDivider}>•</Text>
                    <Text style={styles.navigationDistance}>{routeDetails.distance}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Bottom navigation controls */}
            <View style={styles.navigationControls}>
              <TouchableOpacity style={styles.stopNavigationButton} onPress={stopNavigation}>
                <Ionicons name="close-circle" size={24} color="#fff" />
                <Text style={styles.stopNavigationText}>Stop</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Business Details Modal */}
        <Modal
          visible={detailsModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            console.log('❌ Modal onRequestClose called - NOT clearing selectedPlace');
            setDetailsModalVisible(false);
            // Keep selectedPlace and selectedBusinessDetails for faster reopening
            setCurrentImageIndex(0);
            // Preserve the full detailed route when modal closes (no need to simplify to straight line)
            if (!isNavigating && routeDetails) {
              console.log('💾 Modal closing - preserving full detailed route:', routeDetails.distance);
              // Keep the detailed coordinates that follow roads, don't simplify to straight line
              setRouteDetails(routeDetails);
            } else if (!isNavigating) {
              setRouteDetails(null);
            }
          }}
        >
          <View style={styles.detailsOverlay}>
            <View style={styles.detailsContainer}>
              {/* Close Button */}
              <TouchableOpacity 
                style={styles.closeButtonModal} 
                onPress={() => {
                  setDetailsModalVisible(false);
                  setIsBusinessClosed(false); // Reset business closed status
                  // Keep selectedPlace and selectedBusinessDetails for faster reopening
                  setCurrentImageIndex(0);
                  // Preserve distance info when modal closes, only clear detailed coordinates
                  if (!isNavigating && routeDetails && selectedPlace && location) {
                    const preservedRoute = {
                      coordinates: [
                        {
                          latitude: location.coords.latitude,
                          longitude: location.coords.longitude,
                        },
                        {
                          latitude: selectedPlace.businessLocation?.latitude || selectedPlace.latitude,
                          longitude: selectedPlace.businessLocation?.longitude || selectedPlace.longitude,
                        }
                      ],
                      distance: routeDetails.distance,
                      duration: routeDetails.duration,
                      trafficInfo: routeDetails.trafficInfo
                    };
                    setRouteDetails(preservedRoute);
                  } else if (!isNavigating) {
                    setRouteDetails(null);
                  }
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ResponsiveText size="xl" weight="bold" color="#333" style={styles.closeButtonText}>×</ResponsiveText>
              </TouchableOpacity>

              {/* Image Carousel */}
              {selectedBusinessDetails && (
                <View style={styles.imageCarouselContainer}>
                  {selectedBusinessDetails.allImages && selectedBusinessDetails.allImages.length > 0 ? (
                    <>
                      <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        style={styles.imageScrollView}
                        pagingEnabled
                        onMomentumScrollEnd={(event) => {
                          const index = Math.round(event.nativeEvent.contentOffset.x / dimensions.width);
                          setCurrentImageIndex(index);
                        }}
                      >
                        {selectedBusinessDetails.allImages.map((img, idx) => (
                          <CachedImage
                            key={idx}
                            source={{ uri: img }}
                            style={styles.carouselImage}
                            resizeMode="cover"
                          />
                        ))}
                      </ScrollView>
                      
                      {/* Image indicators */}
                      {selectedBusinessDetails.allImages.length > 1 && (
                        <View style={styles.imageIndicators}>
                          {selectedBusinessDetails.allImages.map((_, index: number) => (
                            <View
                              key={index}
                              style={[
                                styles.indicator,
                                index === currentImageIndex ? styles.activeIndicator : styles.inactiveIndicator
                              ]}
                            />
                          ))}
                        </View>
                      )}
                    </>
                  ) : (
                    <ResponsiveView style={styles.noImageContainer}>
                      <Ionicons name="image-outline" size={iconSizes.xxxxl} color="#ccc" />
                      <ResponsiveText size="sm" color="#999" style={styles.noImageText}>No images available</ResponsiveText>
                    </ResponsiveView>
                  )}
                </View>
              )}

              {/* Content Container */}
              <View style={styles.contentContainer}>
                {/* Show loading if details are not loaded */}
                {!selectedBusinessDetails ? (
                  <ResponsiveView style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator size="large" color="#4B50E6" />
                    <ResponsiveText size="md" color="#666" style={{ marginTop: 16 }}>Loading business details...</ResponsiveText>
                  </ResponsiveView>
                ) : (
                  <ScrollView 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContentContainer}
                  >
                    {/* Business Info */}
                    <ResponsiveView style={styles.businessInfo}>
                      <ResponsiveText size="lg" weight="600" color="#333" style={styles.businessName}>{selectedBusinessDetails?.name}</ResponsiveText>
                      <ResponsiveText size="sm" color="#666" style={styles.businessType}>{selectedBusinessDetails?.businessType}</ResponsiveText>
                      
                      <View style={styles.locationRow}>
                        <Ionicons name="location" size={iconSizes.sm} color="#666" />
                        <ResponsiveText size="sm" color="#666" style={styles.locationText} numberOfLines={2}>
                          {selectedBusinessDetails?.location || 'Location not available'}
                        </ResponsiveText>
                      </View>
                      {selectedBusinessDetails?.businessHours && (
                        <View style={styles.timeRow}>
                          <Ionicons name="time" size={iconSizes.sm} color="#666" />
                          <ResponsiveText size="sm" color="#666" style={styles.timeText}>{selectedBusinessDetails.businessHours}</ResponsiveText>
                        </View>
                      )}
                      {selectedBusinessDetails?.contactNumber && (
                        <View style={styles.infoRow}>
                          <Ionicons name="call" size={iconSizes.sm} color="#666" />
                          <ResponsiveText size="sm" color="#666" style={styles.infoText}>{selectedBusinessDetails.contactNumber}</ResponsiveText>
                        </View>
                      )}

                    </ResponsiveView>

                    {/* Travel Modes */}
                    <ResponsiveView style={styles.travelModesContainer}>
                      <View style={styles.travelModeRow}>
                        <TouchableOpacity 
                          style={[styles.travelModeButton, selectedTravelMode === 'driving' && styles.selectedMode]}
                          onPress={() => {
                            setSelectedTravelMode('driving');
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="car" size={iconSizes.md} color={selectedTravelMode === 'driving' ? '#007AFF' : '#666'} />
                          <ResponsiveText size="sm" color={selectedTravelMode === 'driving' ? '#007AFF' : '#666'} weight={selectedTravelMode === 'driving' ? '600' : 'normal'} style={[styles.travelModeText, selectedTravelMode === 'driving' && styles.selectedModeText]}>Driving</ResponsiveText>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.travelModeButton, selectedTravelMode === 'walking' && styles.selectedMode]}
                          onPress={() => {
                            setSelectedTravelMode('walking');
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="walk" size={iconSizes.md} color={selectedTravelMode === 'walking' ? '#007AFF' : '#666'} />
                          <ResponsiveText size="sm" color={selectedTravelMode === 'walking' ? '#007AFF' : '#666'} weight={selectedTravelMode === 'walking' ? '600' : 'normal'} style={[styles.travelModeText, selectedTravelMode === 'walking' && styles.selectedModeText]}>Walking</ResponsiveText>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.travelModeRow}>
                        <TouchableOpacity 
                          style={[styles.travelModeButton, selectedTravelMode === 'bicycling' && styles.selectedMode]}
                          onPress={() => {
                            setSelectedTravelMode('bicycling');
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="bicycle" size={iconSizes.md} color={selectedTravelMode === 'bicycling' ? '#007AFF' : '#666'} />
                          <ResponsiveText size="sm" color={selectedTravelMode === 'bicycling' ? '#007AFF' : '#666'} weight={selectedTravelMode === 'bicycling' ? '600' : 'normal'} style={[styles.travelModeText, selectedTravelMode === 'bicycling' && styles.selectedModeText]}>Bicycling</ResponsiveText>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.travelModeButton, selectedTravelMode === 'transit' && styles.selectedMode]}
                          onPress={() => {
                            setSelectedTravelMode('transit');
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="bus" size={iconSizes.md} color={selectedTravelMode === 'transit' ? '#007AFF' : '#666'} />
                          <ResponsiveText size="sm" color={selectedTravelMode === 'transit' ? '#007AFF' : '#666'} weight={selectedTravelMode === 'transit' ? '600' : 'normal'} style={[styles.travelModeText, selectedTravelMode === 'transit' && styles.selectedModeText]}>Transit</ResponsiveText>
                        </TouchableOpacity>
                      </View>
                    </ResponsiveView>

                    {/* Route Info */}
                    <ResponsiveView style={styles.routeInfo}>
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#4B50E6" />
                      ) : routeDetails ? (
                        <ResponsiveView style={styles.routeInfoContainer}>
                          <View style={styles.routeInfoRow}>
                            <View style={styles.routeInfoItem}>
                              <Ionicons name="time" size={iconSizes.sm} color="#666" />
                              <ResponsiveText size="sm" color="#666" style={styles.routeInfoText}>{routeDetails.duration}</ResponsiveText>
                            </View>
                            <View style={styles.routeInfoItem}>
                              <Ionicons name="navigate" size={iconSizes.sm} color="#666" />
                              <ResponsiveText size="sm" color="#666" style={styles.routeInfoText}>{routeDetails.distance}</ResponsiveText>
                            </View>
                          </View>
                          
                          {/* Traffic Insights */}
                          {routeDetails.trafficInfo && (
                            <ResponsiveView style={styles.trafficContainer}>
                              <View style={styles.trafficHeader}>
                                <Ionicons 
                                  name="car-sport" 
                                  size={iconSizes.xs} 
                                  color="#666" 
                                />
                                <ResponsiveText size="xs" weight="600" color="#666" style={styles.trafficHeaderText}>Traffic Insights</ResponsiveText>
                              </View>
                              
                              <ResponsiveView style={styles.trafficContentContainer}>
                                <View style={styles.trafficRow}>
                                  <Ionicons 
                                    name={getTrafficStyle(routeDetails.trafficInfo.condition).icon} 
                                    size={iconSizes.sm} 
                                    color={getTrafficStyle(routeDetails.trafficInfo.condition).color} 
                                  />
                                  <ResponsiveText size="sm" weight="600" color={getTrafficStyle(routeDetails.trafficInfo.condition).color} style={styles.trafficText}>
                                    {routeDetails.trafficInfo.condition} traffic
                                  </ResponsiveText>
                                </View>
                                
                                <View style={styles.trafficRow}>
                                  <Ionicons name="time-outline" size={iconSizes.xs} color="#666" />
                                  <ResponsiveText size="sm" color="#666" style={styles.trafficDetailText}>
                                    {routeDetails.trafficInfo.estimatedDelay}
                                  </ResponsiveText>
                                </View>
                                
                                <View style={styles.trafficRow}>
                                  <Ionicons name="git-branch-outline" size={iconSizes.xs} color="#666" />
                                  <ResponsiveText size="sm" color="#666" style={styles.trafficDetailText}>
                                    {routeDetails.trafficInfo.alternativeRoutes} route{routeDetails.trafficInfo.alternativeRoutes > 1 ? 's' : ''} available
                                  </ResponsiveText>
                                </View>
                              </ResponsiveView>
                            </ResponsiveView>
                          )}
                        </ResponsiveView>
                      ) : (
                        <ResponsiveText size="sm" color="#666" style={styles.routeInfoText}>Calculating route...</ResponsiveText>
                      )}
                    </ResponsiveView>

                    {/* Business Closed Status */}
                    {isBusinessClosed && (
                      <ResponsiveView style={styles.closedStatusContainer}>
                        <Ionicons name="time-outline" size={iconSizes.md} color="#d32f2f" />
                        <ResponsiveText size="sm" weight="600" color="#d32f2f" style={styles.closedStatusText}>This business is currently closed</ResponsiveText>
                      </ResponsiveView>
                    )}

                    {/* Navigate Button */}
                    <TouchableOpacity 
                      style={[styles.navigateButton, (isLoading || isNavigationLoading || isBusinessClosed) && styles.navigateButtonDisabled]} 
                      onPress={handleStartNavigation}
                      disabled={isLoading || isNavigationLoading || isBusinessClosed}
                      activeOpacity={0.8}
                    >
                      {isNavigationLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="navigate" size={iconSizes.md} color="#fff" />
                      )}
                      <ResponsiveText size="md" weight="600" color="#fff" style={styles.navigateButtonText}>
                        {isBusinessClosed ? 'Business Closed' : isNavigationLoading ? 'Starting Navigation...' : isLoading ? 'Calculating...' : 'Navigate'}
                      </ResponsiveText>
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </View>
            </View>
          </View>
        </Modal>

        {/* Nearby Businesses Modal */}
        <Modal
          visible={showNearbyModal && !isNavigating && nearbyBusinesses.length > 0}
          transparent
          animationType="fade"
          onRequestClose={() => setShowNearbyModal(false)}
        >
          <ResponsiveView style={styles.nearbyOverlay}>
            <ResponsiveView style={styles.nearbyModal}>
              <ResponsiveText size="lg" weight="700" color="#222" style={styles.nearbyTitle}>Discover What's Just Steps Away!</ResponsiveText>
              <ScrollView
                style={{ width: '100%', maxHeight: responsiveHeight(35) }}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: spacing.xs }}
              >
                {nearbyBusinesses.map((biz, idx) => {
                  const rating = businessRatings[biz.id];
                  const reviews = businessReviews[biz.id] || [];
                  const averageRating = rating?.average || '0.0';
                  const reviewCount = rating?.count || 0;
                  
                  const businessImageUri = biz.allImages?.[0] || biz.image || 'https://via.placeholder.com/54';
                  
                  return (
                    <ResponsiveView key={biz.id} style={styles.nearbyCard}>
                      <CachedImage
                        source={{ uri: businessImageUri }}
                        style={styles.nearbyImage}
                        resizeMode="cover"
                      />
                      <ResponsiveView style={{ flex: 1, marginLeft: isSmallScreen ? spacing.xs : spacing.sm, minWidth: 0 }}>
                        <ResponsiveText size="md" weight="700" color="#181848" style={styles.nearbyName} numberOfLines={1}>{biz.name}</ResponsiveText>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs / 2 }}>
                          <Ionicons name="location" size={isSmallScreen ? iconSizes.xs : iconSizes.sm} color="#1976d2" />
                          <ResponsiveText size="xs" color="#1976d2" style={styles.nearbyDistance}>{
                            `${Math.round(haversineDistance(location?.coords?.latitude || 0, location?.coords?.longitude || 0, biz.businessLocation.latitude, biz.businessLocation.longitude) * 1000)}m`
                          }</ResponsiveText>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs / 2 }}>
                          <Ionicons name="star" size={isSmallScreen ? iconSizes.xs : iconSizes.sm} color="#FFD700" />
                          <ResponsiveText size="xs" color="#888" style={styles.nearbyRating}>
                            {averageRating} ({reviewCount})
                          </ResponsiveText>
                        </View>
                      </ResponsiveView>
                      <TouchableOpacity 
                        style={styles.nearbyNavigateBtn} 
                        onPress={() => { 
                          setShowNearbyModal(false); 
                          handlePlaceSelect(biz);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="navigate" size={iconSizes.sm} color="#8D5C2C" />
                        <ResponsiveText size="xs" weight="600" color="#8D5C2C" style={styles.nearbyNavigateText}>Navigate</ResponsiveText>
                      </TouchableOpacity>
                    </ResponsiveView>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={styles.nearbyCloseBtn} onPress={() => setShowNearbyModal(false)} activeOpacity={0.8}>
                <ResponsiveView style={styles.nearbyCloseSolid}>
                  <ResponsiveText size="md" weight="700" color="#fff" style={styles.nearbyCloseText}>Close</ResponsiveText>
                </ResponsiveView>
              </TouchableOpacity>
            </ResponsiveView>
          </ResponsiveView>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default Navigate; 