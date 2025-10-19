import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../../contexts/AuthContext';
import { db, storage } from '../../../firebase';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useResponsive } from '../../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../../components';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type RootStackParamList = {
  BusinessLocation: {
    permitPhoto: string;
    permitNumber: string;
    businessName: string;
    businessOwner: string;
    selectedType: string;
    selectedCategories: string[];
    businessHours: string;
    contactNumber: string;
    optionalContactNumber: string;
    frontIDPhoto: string;
    backIDPhoto: string;
    businessImages: string[];
  };
};

type BusinessLocationScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'BusinessLocation'
>;

type BusinessLocationScreenRouteProp = RouteProp<
  RootStackParamList,
  'BusinessLocation'
>;

interface LocationData {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const BusinessLocationScreen = () => {
  const navigation = useNavigation<BusinessLocationScreenNavigationProp>();
  const route = useRoute<BusinessLocationScreenRouteProp>();
  const { user, theme } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius, getResponsiveWidth, getResponsiveHeight } = useResponsive();

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  // Progress tracking
  const registrationSteps = [
    { id: 1, title: 'Business Info', description: 'Basic details' },
    { id: 2, title: 'Verification', description: 'ID verification' },
    { id: 3, title: 'Location', description: 'Set location' },
    { id: 4, title: 'Complete', description: 'Final review' }
  ];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to set your business location.');
        setIsLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const newLocation: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setCurrentLocation(newLocation);
      setSelectedLocation(newLocation);
      
      const address = await getAddressFromCoordinates(newLocation.latitude, newLocation.longitude);
      setLocationAddress(address);
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Failed to get your current location. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getAddressFromCoordinates = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        return `${address.street || ''} ${address.city || ''} ${address.region || ''} ${address.country || ''}`.trim();
      }
      return 'Location selected';
    } catch (error) {
      console.error('Error getting address:', error);
      return 'Location selected';
    }
  };

  const animateToLocation = (location: LocationData) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(location, 1000);
    }
  };

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const newLocation: LocationData = {
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    
    setSelectedLocation(newLocation);
    
    const address = await getAddressFromCoordinates(latitude, longitude);
    setLocationAddress(address);
    
    animateToLocation(newLocation);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a location to search.');
      return;
    }

    try {
      const results = await Location.geocodeAsync(searchQuery);
      
      if (results.length > 0) {
        setSearchResults(results);
        setShowSearchResults(true);
      } else {
        Alert.alert('Not Found', 'Location not found. Please try a different search term.');
      }
    } catch (error) {
      console.error('Error searching location:', error);
      Alert.alert('Error', 'Failed to search for location. Please try again.');
    }
  };

  const handleSelectSearchResult = async (result: any, index: number) => {
    const newLocation: LocationData = {
      latitude: result.latitude,
      longitude: result.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    
    setSelectedLocation(newLocation);
    
    const address = await getAddressFromCoordinates(result.latitude, result.longitude);
    setLocationAddress(address);
    
    animateToLocation(newLocation);
    
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleUseCurrentLocation = async () => {
    if (currentLocation) {
      setSelectedLocation(currentLocation);
      const address = await getAddressFromCoordinates(currentLocation.latitude, currentLocation.longitude);
      setLocationAddress(address);
      animateToLocation(currentLocation);
    }
  };

  const uploadImageToStorage = async (imageUri: string, imageName: string): Promise<string> => {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      const imageRef = ref(storage, `business_registrations/${user?.uid}/${imageName}`);
      await uploadBytes(imageRef, blob);
      
      const downloadURL = await getDownloadURL(imageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleNext = async () => {
    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a location for your business.');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated. Please log in again.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!route.params.permitPhoto || !route.params.frontIDPhoto || !route.params.backIDPhoto) {
        Alert.alert('Missing Images', 'Please ensure all required photos (permit, front ID, back ID) are uploaded before submitting.');
        setIsSubmitting(false);
        return;
      }

      if (!route.params.businessImages || route.params.businessImages.length < 3) {
        Alert.alert('Missing Business Images', 'Please upload at least 3 business images before submitting.');
        setIsSubmitting(false);
        return;
      }

      const permitPhotoURL = await uploadImageToStorage(route.params.permitPhoto, 'permit');
      const frontIDPhotoURL = await uploadImageToStorage(route.params.frontIDPhoto, 'front_id');
      const backIDPhotoURL = await uploadImageToStorage(route.params.backIDPhoto, 'back_id');
      
      const businessImageURLs: string[] = [];
      for (let i = 0; i < route.params.businessImages.length; i++) {
        const businessImageURL = await uploadImageToStorage(route.params.businessImages[i], `business_image_${i + 1}`);
        businessImageURLs.push(businessImageURL);
      }
      
      const completeFormData = {
        ...route.params,
        permitPhoto: permitPhotoURL,
        frontIDPhoto: frontIDPhotoURL,
        backIDPhoto: backIDPhotoURL,
        businessImages: businessImageURLs,
        businessLocation: selectedLocation,
        businessAddress: locationAddress,
        status: 'pending',
        userId: user.uid, // Add userId field for backward compatibility
        registrationDate: new Date().toISOString(), // Save as ISO string for admin panel compatibility
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'businesses', user.uid), completeFormData);
      
      Alert.alert(
        'Registration Submitted!',
        'Your business registration has been submitted for review. You will be notified once it\'s approved.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('BusinessMain' as any);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error saving business registration:', error);
      Alert.alert(
        'Registration Failed', 
        'There was an error saving your business registration. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => setIsSubmitting(false)
          }
        ]
      );
    }
  };

  // Calculate current progress (Step 3 - Location)
  const calculateProgress = () => {
    // Step 3 is always 75% complete when on this screen
    // It only becomes 100% when user completes registration
    return 75;
  };

  const currentProgress = calculateProgress();
  const currentStep = 3; // We're on step 3

  // --- Styles ---
  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    backButton: {
      marginRight: spacing.md,
    },
    title: {
      fontSize: fontSizes.xl,
      fontWeight: 'bold',
      color: '#333',
    },
    progressContainer: {
      backgroundColor: '#fff',
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    progressTitle: {
      flex: 1,
    },
    progressPercentage: {
      fontWeight: '600',
    },
    progressBarContainer: {
      height: 8,
      backgroundColor: '#f0f0f0',
      borderRadius: 4,
      marginBottom: spacing.lg,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      backgroundColor: '#667eea',
      borderRadius: 4,
    },
    stepsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    stepItem: {
      flex: 1,
      alignItems: 'center',
      position: 'relative',
    },
    stepCircle: {
      width: getResponsiveWidth(8),
      height: getResponsiveWidth(8),
      borderRadius: getResponsiveWidth(4),
      backgroundColor: '#f0f0f0',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    stepCircleCompleted: {
      backgroundColor: '#4CAF50',
    },
    stepCircleCurrent: {
      backgroundColor: '#667eea',
    },
    stepCircleUpcoming: {
      backgroundColor: '#f0f0f0',
    },
    stepTextContainer: {
      alignItems: 'center',
      maxWidth: getResponsiveWidth(20),
    },
    stepTitle: {
      textAlign: 'center',
      marginBottom: 2,
    },
    stepDescription: {
      textAlign: 'center',
      lineHeight: fontSizes.xs * 1.2,
    },
    stepConnector: {
      position: 'absolute',
      top: getResponsiveWidth(4),
      left: '50%',
      width: '100%',
      height: 2,
      backgroundColor: '#f0f0f0',
      zIndex: -1,
    },
    stepConnectorCompleted: {
      backgroundColor: '#4CAF50',
    },
    searchContainer: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    searchIcon: {
      marginRight: spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: fontSizes.md,
      color: '#333',
    },
    searchButton: {
      backgroundColor: '#667eea',
      borderRadius: borderRadius.sm,
      padding: spacing.sm,
      marginLeft: spacing.sm,
    },
    searchResultsContainer: {
      backgroundColor: '#fff',
      borderRadius: borderRadius.md,
      marginTop: spacing.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    searchResultItem: {
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    searchResultText: {
      fontSize: fontSizes.md,
      color: '#333',
    },
    mapContainer: {
      height: getResponsiveHeight(40),
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
    },
    map: {
      flex: 1,
    },
    locationInfo: {
      backgroundColor: '#fff',
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    locationInfoTitle: {
      fontSize: fontSizes.lg,
      fontWeight: 'bold',
      color: '#333',
      marginBottom: spacing.sm,
    },
    locationInfoText: {
      fontSize: fontSizes.md,
      color: '#666',
      lineHeight: fontSizes.md * 1.4,
    },
    nextButton: {
      backgroundColor: '#667eea',
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    nextButtonDisabled: {
      backgroundColor: '#ccc',
    },
    nextButtonText: {
      color: '#fff',
      fontSize: fontSizes.lg,
      fontWeight: 'bold',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingIndicator: {
      marginBottom: spacing.lg,
    },
    loadingText: {
      fontSize: fontSizes.lg,
      color: '#333',
    },
  });

  // Progress Bar Component
  const ProgressBar = () => (
    <ResponsiveView style={styles.progressContainer}>
      <ResponsiveView style={styles.progressHeader}>
        <ResponsiveText size="lg" weight="600" color="#333" style={styles.progressTitle}>
          Registration Progress
        </ResponsiveText>
        <ResponsiveText size="sm" color="#666" style={styles.progressPercentage}>
          {Math.round(currentProgress)}% Complete
        </ResponsiveText>
      </ResponsiveView>
      
      {/* Progress Bar */}
      <ResponsiveView style={styles.progressBarContainer}>
        <ResponsiveView style={[styles.progressBar, { width: `${currentProgress}%` }]}>
          <></>
        </ResponsiveView>
      </ResponsiveView>
      
      {/* Steps */}
      <ResponsiveView style={styles.stepsContainer}>
        {registrationSteps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep - 1;
          const isUpcoming = index > currentStep - 1;
          
          return (
            <ResponsiveView key={step.id} style={styles.stepItem}>
              <ResponsiveView style={[
                styles.stepCircle,
                isCompleted && styles.stepCircleCompleted,
                isCurrent && styles.stepCircleCurrent,
                isUpcoming && styles.stepCircleUpcoming
              ]}>
                {isCompleted ? (
                  <Ionicons name="checkmark" size={iconSizes.sm} color="#fff" />
                ) : (
                  <ResponsiveText size="xs" weight="600" color={isCurrent ? "#667eea" : "#999"}>
                    {step.id}
                  </ResponsiveText>
                )}
              </ResponsiveView>
              <ResponsiveView style={styles.stepTextContainer}>
                <ResponsiveText 
                  size="xs" 
                  weight={isCurrent ? "600" : "500"} 
                  color={isCompleted || isCurrent ? "#333" : "#999"}
                  style={styles.stepTitle}
                >
                  {step.title}
                </ResponsiveText>
                <ResponsiveText 
                  size="xs" 
                  color={isCompleted || isCurrent ? "#666" : "#999"}
                  style={styles.stepDescription}
                >
                  {step.description}
                </ResponsiveText>
              </ResponsiveView>
              {index < registrationSteps.length - 1 && (
                <ResponsiveView style={[
                  styles.stepConnector,
                  isCompleted && styles.stepConnectorCompleted
                ]}>
                  <></>
                </ResponsiveView>
              )}
            </ResponsiveView>
          );
        })}
      </ResponsiveView>
    </ResponsiveView>
  );

  if (isLoading) {
    return (
      <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" style={styles.loadingIndicator} />
            <Text style={styles.loadingText}>Getting your location...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.title}>Business Location</Text>
          </View>

          {/* Progress Bar */}
          <ProgressBar />

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#667eea" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a location..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <View style={styles.searchResultsContainer}>
                {searchResults.map((result, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.searchResultItem}
                    onPress={() => handleSelectSearchResult(result, index)}
                  >
                    <Text style={styles.searchResultText}>
                      {result.name || `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Map */}
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={selectedLocation || currentLocation || {
                latitude: 10.6407,
                longitude: 122.9689,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onPress={handleMapPress}
              showsUserLocation={true}
              showsMyLocationButton={false}
            >
              {selectedLocation && (
                <Marker
                  coordinate={{
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                  }}
                  title="Business Location"
                  description={locationAddress}
                />
              )}
            </MapView>
          </View>

          {/* Location Info */}
          {selectedLocation && (
            <View style={styles.locationInfo}>
              <Text style={styles.locationInfoTitle}>Selected Location</Text>
              <Text style={styles.locationInfoText}>{locationAddress}</Text>
            </View>
          )}

          {/* Next Button */}
          <TouchableOpacity
            style={[styles.nextButton, isSubmitting && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextButtonText}>Complete Registration</Text>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </LinearGradient>
  );
};

export default BusinessLocationScreen;
