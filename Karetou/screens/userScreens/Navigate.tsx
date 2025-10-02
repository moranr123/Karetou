import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { collection, query, getDocs, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import LoadingImage from '../../components/LoadingImage';
import { useRoute, RouteProp } from '@react-navigation/native';

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
};

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
  const mapRef = useRef<MapView>(null);
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
            businessLocation: data.businessLocation,
            allImages: data.businessImages || [], // Map businessImages from Firestore to allImages
            image: data.businessImages && data.businessImages.length > 0 ? data.businessImages[0] : '', // First image as main image
            location: data.businessAddress || data.location
          };
          
          // Log business coordinates for debugging
          console.log(`🏢 Loaded business "${business.name}":`, {
            lat: business.latitude,
            lon: business.longitude,
            hasBusinessLocation: !!data.businessLocation,
            businessLocation: data.businessLocation
          });
          
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

  const searchPlaces = (query: string) => {
    setSearchQuery(query);
    if (query.length > 2) {
      const filtered = places.filter(place =>
        place.name.toLowerCase().includes(query.toLowerCase()) ||
        place.description?.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  };

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
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(
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

      clearTimeout(timeoutId);

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
    } catch (error) {
      console.error(`Error fetching directions from OpenRouteService (attempt ${retryCount + 1}):`, error);
      
      // Retry up to 2 times with different parameters
      if (retryCount < 2) {
        console.log(`🔄 Retrying OpenRouteService request (attempt ${retryCount + 2})...`);
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        
        try {
          return await getRouteFromORS(origin, destination, mode, retryCount + 1);
        } catch (retryError) {
          console.error(`Retry ${retryCount + 2} also failed:`, retryError);
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

  const handlePlaceSelect = async (business: Place) => {
    setSelectedPlace(business);
    
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
    };
    
    setSelectedBusinessDetails(businessDetails);
    
    setDetailsModalVisible(true);
    setCurrentImageIndex(0); // Reset image index for new business
    
    if (business.businessLocation) {
      calculateDistance(business);
    }
  };

  const centerOnUser = () => {
    if (location) {
      adjustMapToRadius(circleRadius);
    }
  };

  const increaseRadius = () => {
    if (circleRadius < 2000) {
      const newRadius = Math.min(circleRadius + 100, 2000);
      setCircleRadius(newRadius);
      adjustMapToRadius(newRadius);
    }
  };

  const decreaseRadius = () => {
    if (circleRadius > 500) {
      const newRadius = Math.max(circleRadius - 100, 500);
      setCircleRadius(newRadius);
      adjustMapToRadius(newRadius);
    }
  };

  const adjustMapToRadius = (radius: number) => {
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
  };

  // Check for nearby businesses when userLocation or places change
  useEffect(() => {
    if (!location || !places.length) return;
    const nearby = places.filter(place => {
      const dist = haversineDistance(
        location.coords.latitude,
        location.coords.longitude,
        place.businessLocation.latitude,
        place.businessLocation.longitude
      );
      return dist * 1000 <= circleRadius; // Use dynamic circleRadius instead of fixed 500
    });
    setNearbyBusinesses(nearby);
    
    // Check for newly detected businesses
    const newBusinesses = nearby.filter(business => !previouslyDetectedBusinessesRef.current.has(business.id));
    
    // Only show modal if there are NEW nearby businesses and not navigating
    if (newBusinesses.length > 0 && !isNavigating) {
      setShowNearbyModal(true);
    }
    
    // Update the set of previously detected businesses
    const currentBusinessIds = new Set(nearby.map(business => business.id));
    previouslyDetectedBusinessesRef.current = currentBusinessIds;
  }, [location, places, isNavigating, circleRadius]);

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

  const handleMarkerPress = (business: Place) => {
    setSelectedPlace(business);
    setDetailsModalVisible(true);
    if (business.businessLocation) {
      calculateDistance(business);
    }
  };

  const calculateDistance = async (destination: Place) => {
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
  };

  const stopNavigation = () => {
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
  };

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
     } else if (!isNavigating) {
       console.log('🛑 Navigation stopped');
     }
   }, [isNavigating, selectedPlace]);

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
              size={screenWidth * 0.15} 
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
            <Ionicons name="search" size={screenWidth * 0.05} color="#666" />
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


              {/* Business markers - keep visible but dimmed during navigation */}
              {places.map((place) => (
              <Marker
                key={place.id}
                coordinate={{
                    latitude: place.businessLocation.latitude,
                    longitude: place.businessLocation.longitude
                }}
                title={place.name}
                  description={place.businessType}
                                    onPress={() => {
                    handlePlaceSelect(place);
                  }}
                >
                  <View style={{
                    backgroundColor: 
                      isNavigating && selectedPlace?.id === place.id ? '#FF3B30' :
                      isNavigating ? 'rgba(75, 80, 230, 0.3)' : '#4B50E6',
                    borderRadius: 20,
                    padding: isNavigating && selectedPlace?.id === place.id ? 12 : 8,
                    borderWidth: isNavigating && selectedPlace?.id === place.id ? 4 : 2,
                    borderColor: '#fff',
                    elevation: isNavigating && selectedPlace?.id === place.id ? 8 : (isNavigating ? 1 : 3),
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isNavigating && selectedPlace?.id === place.id ? 0.4 : (isNavigating ? 0.1 : 0.25),
                    shadowRadius: 3.84,
                  }}>
                    <Ionicons 
                      name={isNavigating && selectedPlace?.id === place.id ? "location" : "business"}
                      size={isNavigating && selectedPlace?.id === place.id ? 24 : 20} 
                      color={
                        isNavigating && selectedPlace?.id === place.id ? '#fff' :
                        isNavigating ? 'rgba(255, 255, 255, 0.5)' : '#fff'
                      } 
                    />
                  </View>
                </Marker>
              ))}



              {/* Destination marker - Large red target marker */}
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
                >
                  <View style={styles.destinationMarker}>
                    <Ionicons name="location" size={36} color="#fff" />
                  </View>
                </Marker>
              )}

              {/* Route line - solid during navigation, no preview when not navigating */}
              {routeDetails?.coordinates && routeDetails.coordinates.length >= 2 && (
              <Polyline
                  coordinates={routeDetails.coordinates}
                  strokeColor={isNavigating ? "#4B50E6" : "transparent"}
                  strokeWidth={isNavigating ? 6 : 0}
                  lineDashPattern={[0]}
                  zIndex={1000}
                  geodesic={true}
                  lineJoin="round"
                  lineCap="round"
                />
              )}

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
                  <Ionicons name="remove" size={screenWidth * 0.04} color={circleRadius <= 500 ? "#CCC" : "#3B2FEA"} />
                </TouchableOpacity>
                <Text style={styles.radiusValue}>{circleRadius}m</Text>
                <TouchableOpacity 
                  style={[styles.radiusButtonSmall, circleRadius >= 2000 && styles.radiusButtonDisabled]} 
                  onPress={increaseRadius}
                  disabled={circleRadius >= 2000}
                >
                  <Ionicons name="add" size={screenWidth * 0.04} color={circleRadius >= 2000 ? "#CCC" : "#3B2FEA"} />
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
              >
                <Text style={styles.closeButtonText}>×</Text>
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
                          const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
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
                    <View style={styles.noImageContainer}>
                      <Ionicons name="image-outline" size={60} color="#ccc" />
                      <Text style={styles.noImageText}>No images available</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Content Container */}
              <View style={styles.contentContainer}>
                {/* Show loading if details are not loaded */}
                {!selectedBusinessDetails ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator size="large" color="#4B50E6" />
                    <Text style={{ marginTop: 16, color: '#666', fontSize: 16 }}>Loading business details...</Text>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Business Info */}
                    <View style={styles.businessInfo}>
                      <Text style={styles.businessName}>{selectedBusinessDetails?.name}</Text>
                      <Text style={styles.businessType}>{selectedBusinessDetails?.businessType}</Text>
                      
                      <View style={styles.locationRow}>
                        <Ionicons name="location" size={16} color="#666" />
                        <Text style={styles.locationText} numberOfLines={2}>
                          {selectedBusinessDetails?.location || 'Location not available'}
                        </Text>
                      </View>
                      {selectedBusinessDetails?.businessHours && (
                        <View style={styles.timeRow}>
                          <Ionicons name="time" size={16} color="#666" />
                          <Text style={styles.timeText}>{selectedBusinessDetails.businessHours}</Text>
                        </View>
                      )}
                      {selectedBusinessDetails?.contactNumber && (
                        <View style={styles.infoRow}>
                          <Ionicons name="call" size={16} color="#666" />
                          <Text style={styles.infoText}>{selectedBusinessDetails.contactNumber}</Text>
                        </View>
                      )}

                    </View>

                    {/* Travel Modes */}
                    <View style={styles.travelModesContainer}>
                      <View style={styles.travelModeRow}>
                        <TouchableOpacity 
                          style={[styles.travelModeButton, selectedTravelMode === 'driving' && styles.selectedMode]}
                          onPress={() => {
                            setSelectedTravelMode('driving');
                          }}
                        >
                          <Ionicons name="car" size={20} color={selectedTravelMode === 'driving' ? '#007AFF' : '#666'} />
                          <Text style={[styles.travelModeText, selectedTravelMode === 'driving' && styles.selectedModeText]}>Driving</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.travelModeButton, selectedTravelMode === 'walking' && styles.selectedMode]}
                          onPress={() => {
                            setSelectedTravelMode('walking');
                          }}
                        >
                          <Ionicons name="walk" size={20} color={selectedTravelMode === 'walking' ? '#007AFF' : '#666'} />
                          <Text style={[styles.travelModeText, selectedTravelMode === 'walking' && styles.selectedModeText]}>Walking</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.travelModeRow}>
                        <TouchableOpacity 
                          style={[styles.travelModeButton, selectedTravelMode === 'bicycling' && styles.selectedMode]}
                          onPress={() => {
                            setSelectedTravelMode('bicycling');
                          }}
                        >
                          <Ionicons name="bicycle" size={20} color={selectedTravelMode === 'bicycling' ? '#007AFF' : '#666'} />
                          <Text style={[styles.travelModeText, selectedTravelMode === 'bicycling' && styles.selectedModeText]}>Bicycling</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.travelModeButton, selectedTravelMode === 'transit' && styles.selectedMode]}
                          onPress={() => {
                            setSelectedTravelMode('transit');
                          }}
                        >
                          <Ionicons name="bus" size={20} color={selectedTravelMode === 'transit' ? '#007AFF' : '#666'} />
                          <Text style={[styles.travelModeText, selectedTravelMode === 'transit' && styles.selectedModeText]}>Transit</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Route Info */}
                    <View style={styles.routeInfo}>
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#4B50E6" />
                      ) : routeDetails ? (
                        <View style={styles.routeInfoContainer}>
                          <View style={styles.routeInfoRow}>
                            <View style={styles.routeInfoItem}>
                              <Ionicons name="time" size={16} color="#666" />
                              <Text style={styles.routeInfoText}>{routeDetails.duration}</Text>
                            </View>
                            <View style={styles.routeInfoItem}>
                              <Ionicons name="navigate" size={16} color="#666" />
                              <Text style={styles.routeInfoText}>{routeDetails.distance}</Text>
                            </View>
                          </View>
                          
                          {/* Traffic Insights */}
                          {routeDetails.trafficInfo && (
                            <View style={styles.trafficContainer}>
                              <View style={styles.trafficHeader}>
                                <Ionicons 
                                  name="car-sport" 
                                  size={14} 
                                  color="#666" 
                                />
                                <Text style={styles.trafficHeaderText}>Traffic Insights</Text>
                              </View>
                              
                              <View style={styles.trafficContent}>
                                <View style={styles.trafficRow}>
                                  <Ionicons 
                                    name={getTrafficStyle(routeDetails.trafficInfo.condition).icon} 
                                    size={16} 
                                    color={getTrafficStyle(routeDetails.trafficInfo.condition).color} 
                                  />
                                  <Text style={[styles.trafficText, { 
                                    color: getTrafficStyle(routeDetails.trafficInfo.condition).color,
                                    textTransform: 'capitalize'
                                  }]}>
                                    {routeDetails.trafficInfo.condition} traffic
                                  </Text>
                                </View>
                                
                                <View style={styles.trafficRow}>
                                  <Ionicons name="time-outline" size={14} color="#666" />
                                  <Text style={styles.trafficDetailText}>
                                    {routeDetails.trafficInfo.estimatedDelay}
                                  </Text>
                                </View>
                                
                                <View style={styles.trafficRow}>
                                  <Ionicons name="git-branch-outline" size={14} color="#666" />
                                  <Text style={styles.trafficDetailText}>
                                    {routeDetails.trafficInfo.alternativeRoutes} route{routeDetails.trafficInfo.alternativeRoutes > 1 ? 's' : ''} available
                                  </Text>
                                </View>
                              </View>
                            </View>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.routeInfoText}>Calculating route...</Text>
                      )}
                    </View>

                    {/* Navigate Button */}
                    <TouchableOpacity 
                      style={[styles.navigateButton, (isLoading || isNavigationLoading) && styles.navigateButtonDisabled]} 
                      onPress={handleStartNavigation}
                      disabled={isLoading || isNavigationLoading}
                    >
                      {isNavigationLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="navigate" size={20} color="#fff" />
                      )}
                      <Text style={styles.navigateButtonText}>
                        {isNavigationLoading ? 'Starting Navigation...' : isLoading ? 'Calculating...' : 'Navigate'}
                      </Text>
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
          <View style={styles.nearbyOverlay}>
            <View style={styles.nearbyModal}>
              <Text style={styles.nearbyTitle}>Discover What's Just Steps Away!</Text>
              {nearbyBusinesses.map((biz, idx) => {
                const rating = businessRatings[biz.id];
                const reviews = businessReviews[biz.id] || [];
                const averageRating = rating?.average || '0.0';
                const reviewCount = rating?.count || 0;
                
                const businessImageUri = biz.allImages?.[0] || biz.image || 'https://via.placeholder.com/54';
                
                return (
                  <View key={biz.id} style={styles.nearbyCard}>
                    <CachedImage
                      source={{ uri: businessImageUri }}
                      style={styles.nearbyImage}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.nearbyName}>{biz.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Ionicons name="location" size={14} color="#1976d2" />
                        <Text style={styles.nearbyDistance}>{
                          `${Math.round(haversineDistance(location?.coords?.latitude || 0, location?.coords?.longitude || 0, biz.businessLocation.latitude, biz.businessLocation.longitude) * 1000)} Meters`
                        }</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Ionicons name="star" size={14} color="#FFD700" />
                        <Text style={styles.nearbyRating}>
                          {averageRating} ({reviewCount} {reviewCount === 1 ? 'Review' : 'Reviews'})
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={styles.nearbyNavigateBtn} 
                      onPress={() => { 
                        setShowNearbyModal(false); 
                        handlePlaceSelect(biz);
                      }}
                    >
                      <Ionicons name="navigate" size={18} color="#8D5C2C" />
                      <Text style={styles.nearbyNavigateText}>Navigate</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              <TouchableOpacity style={styles.nearbyCloseBtn} onPress={() => setShowNearbyModal(false)}>
                <View style={styles.nearbyCloseSolid}>
                  <Text style={styles.nearbyCloseText}>Close</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerSpacer: {
    width: 40,
  },
  searchBarContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  searchBarInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  searchResultsContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    maxHeight: 200,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  searchResult: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  searchResultDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionTitle: {
    fontSize: screenWidth * 0.06,
    fontWeight: 'bold',
    marginTop: screenHeight * 0.03,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  permissionButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: screenWidth * 0.08,
    paddingVertical: screenHeight * 0.02,
    borderRadius: screenWidth * 0.05,
    marginTop: screenHeight * 0.04,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: screenWidth * 0.045,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -40 }],
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  detailsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailsContainer: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.34,
    shadowRadius: 6.27,
  },
  contentContainer: {
    padding: 16,
  },
  businessInfo: {
    marginBottom: 16,
    alignItems: 'center',
  },
  businessName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  businessType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    alignSelf: 'stretch',
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    alignSelf: 'stretch',
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    alignSelf: 'stretch',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  travelModesContainer: {
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 8,
  },
  travelModeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  travelModeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
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
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  selectedModeText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  routeInfo: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    minHeight: 80,
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
    marginBottom: 12,
  },
  routeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  routeInfoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  trafficContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  trafficHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trafficHeaderText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  trafficContent: {
    paddingLeft: 4,
  },
  trafficRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  trafficText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  trafficDetailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  navigateButton: {
    backgroundColor: '#4B50E6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  navigateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: screenWidth * 0.05,
    marginBottom: screenHeight * 0.02,
    borderRadius: screenWidth * 0.05,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  mapLocationButton: {
    position: 'absolute',
    bottom: screenHeight * 0.03,
    right: screenWidth * 0.04,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: screenWidth * 0.025,
    borderRadius: screenWidth * 0.025,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  radiusControlPanel: {
    position: 'absolute',
    bottom: screenHeight * 0.03,
    right: screenWidth * 0.04,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: screenWidth * 0.02,
    borderRadius: screenWidth * 0.05,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    minWidth: screenWidth * 0.25,
    alignItems: 'center',
    height: screenHeight * 0.08,
  },
  radiusButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: screenHeight * 0.01,
    top: screenHeight * 0.01,
  },
  radiusValue: {
    fontSize: screenWidth * 0.03,
    color: '#3B2FEA',
  },
  radiusButtonSmall: {
    backgroundColor: 'rgba(59, 47, 234, 0.1)',
    padding: screenWidth * 0.025,
    borderRadius: screenWidth * 0.025,
    marginHorizontal: screenWidth * 0.02,
    borderWidth: 1,
    borderColor: 'rgba(59, 47, 234, 0.3)',
  },
  radiusButtonDisabled: {
    backgroundColor: 'rgba(204, 204, 204, 0.1)',
    borderColor: 'rgba(59, 47, 234, 0.3)',
    borderWidth: 1,
  },
  bottomPanel: {
    paddingHorizontal: screenWidth * 0.05,
    paddingBottom: screenHeight * 0.02,
  },
  routeDetails: {
    flexDirection: 'column',
    gap: 10,
  },
  routeTitle: {
    fontSize: screenWidth * 0.045,
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(75, 80, 230, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4B50E6',
  },
  userMarkerNavigation: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4B50E6',
  },
  destinationMarker: {
    backgroundColor: '#FF3B30',
    borderRadius: 35,
    padding: 15,
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
  navigationControls: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    alignItems: 'center',
  },
  stopNavigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  stopNavigationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  businessImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f5f5f5',
  },
  closeButtonModal: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#333',
    fontWeight: '600',
  },
  navigateButtonDisabled: {
    opacity: 0.7,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontWeight: '600',
  },
  imageCarouselContainer: {
    height: 220,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  imageScrollView: {
    flex: 1,
  },
  carouselImage: {
    width: screenWidth * 0.85,
    height: 200,
    marginTop: 10,
    marginLeft: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000',
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 10,
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
    backgroundColor: '#4B50E6',
  },
  inactiveIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  businessLoadingOverlay: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    zIndex: 1000,
  },
  imageContainer: {
    width: screenWidth * 0.85,
    height: 200,
    backgroundColor: '#f5f5f5',
    marginTop: 10,
    marginLeft: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000',
  },
  noImageContainer: {
    width: screenWidth * 0.85,
    height: 200,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginLeft: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000',
  },
  noImageText: {
    marginTop: 10,
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
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
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  navigationLoadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
    textAlign: 'center',
  },
  navigationLoadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  navigationTopBar: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  navigationDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B50E6',
  },
  navigationDivider: {
    fontSize: 16,
    color: '#999',
    marginHorizontal: 8,
  },
  navigationDistance: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  // Nearby Businesses Modal Styles
  nearbyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nearbyModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 8,
  },
  nearbyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
    textAlign: 'center',
  },
  nearbyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  nearbyImage: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  nearbyName: {
    fontWeight: '700',
    fontSize: 16,
    color: '#181848',
  },
  nearbyDistance: {
    fontSize: 13,
    color: '#1976d2',
    marginLeft: 4,
  },
  nearbyRating: {
    fontSize: 13,
    color: '#888',
    marginLeft: 4,
  },
  nearbyNavigateBtn: {
    backgroundColor: '#F6E3D1',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  nearbyNavigateText: {
    color: '#8D5C2C',
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 14,
  },
  nearbyCloseBtn: {
    width: '100%',
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  nearbyCloseSolid: {
    backgroundColor: '#3B2FEA',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyCloseText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },


});

export default Navigate; 