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

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Default location (Manila coordinates)
  const defaultLocation: LocationData = {
    latitude: 14.5995,
    longitude: 120.9842,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getAddressFromCoordinates = async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (results.length > 0) {
        const result = results[0];
        const addressParts = [
          result.street,
          result.district,
          result.city,
          result.region,
          result.country,
        ].filter(Boolean);
        
        return addressParts.join(', ');
      }
      return 'Unknown location';
    } catch (error) {
      console.error('Error getting address:', error);
      return 'Unknown location';
    }
  };

  const animateToLocation = (location: LocationData) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(location, 1000);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setIsLoading(true);
      
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to set your business location.');
        setCurrentLocation(defaultLocation);
        setSelectedLocation(defaultLocation);
        const address = await getAddressFromCoordinates(defaultLocation.latitude, defaultLocation.longitude);
        setLocationAddress(address);
        setIsLoading(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newLocation: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setCurrentLocation(newLocation);
      setSelectedLocation(newLocation);
      
      // Get address for current location
      const address = await getAddressFromCoordinates(newLocation.latitude, newLocation.longitude);
      setLocationAddress(address);
      
      // Animate map to the location
      animateToLocation(newLocation);
    } catch (error) {
      console.error('Error getting location:', error);
      setCurrentLocation(defaultLocation);
      setSelectedLocation(defaultLocation);
      const address = await getAddressFromCoordinates(defaultLocation.latitude, defaultLocation.longitude);
      setLocationAddress(address);
    } finally {
      setIsLoading(false);
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
    
    // Get address for the selected location
    const address = await getAddressFromCoordinates(latitude, longitude);
    setLocationAddress(address);
    
    // Animate map to the location
    animateToLocation(newLocation);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a location to search.');
      return;
    }

    try {
      // Use expo-location geocoding to search for location
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
    
    // Get address for the selected location
    const address = await getAddressFromCoordinates(result.latitude, result.longitude);
    setLocationAddress(address);
    
    // Animate map to the location
    animateToLocation(newLocation);
    
    // Clear search results
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
    } else {
      getCurrentLocation();
    }
  };

  const uploadImageToStorage = async (imageUri: string, imageName: string): Promise<string> => {
    try {
      console.log('Starting upload for:', imageName, 'URI:', imageUri);
      
      // Convert the image URI to a blob using XMLHttpRequest (better compatibility with RN)
      const response = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () {
          resolve(xhr.response);
        };
        xhr.onerror = function (e) {
          console.log('XHR Error:', e);
          reject(new TypeError('Network request failed'));
        };
        xhr.responseType = 'blob';
        xhr.open('GET', imageUri, true);
        xhr.send(null);
      });

      console.log('Blob created, size:', response.size);
      
      // Create a reference to the storage location
      const imageRef = ref(storage, `business-images/${user?.uid}/${imageName}_${Date.now()}`);
      
      console.log('Uploading to Firebase Storage...');
      // Upload the blob to Firebase Storage
      await uploadBytes(imageRef, response);
      
      console.log('Getting download URL...');
      // Get the download URL
      const downloadURL = await getDownloadURL(imageRef);
      console.log('Upload successful, URL:', downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error(`Failed to upload ${imageName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      // Validate that all required images are present
      if (!route.params.permitPhoto || !route.params.frontIDPhoto || !route.params.backIDPhoto) {
        Alert.alert('Missing Images', 'Please ensure all required photos (permit, front ID, back ID) are uploaded before submitting.');
        setIsSubmitting(false);
        return;
      }

      // Validate business images (minimum 3)
      if (!route.params.businessImages || route.params.businessImages.length < 3) {
        Alert.alert('Missing Business Images', 'Please upload at least 3 business images before submitting.');
        setIsSubmitting(false);
        return;
      }

      // Upload images to Firebase Storage first
      console.log('Uploading images to Firebase Storage...');
      const permitPhotoURL = await uploadImageToStorage(route.params.permitPhoto, 'permit');
      const frontIDPhotoURL = await uploadImageToStorage(route.params.frontIDPhoto, 'front_id');
      const backIDPhotoURL = await uploadImageToStorage(route.params.backIDPhoto, 'back_id');
      
      // Upload business images
      console.log('Uploading business images...');
      const businessImageURLs: string[] = [];
      for (let i = 0; i < route.params.businessImages.length; i++) {
        const businessImageURL = await uploadImageToStorage(route.params.businessImages[i], `business_image_${i + 1}`);
        businessImageURLs.push(businessImageURL);
      }
      
      const completeFormData = {
        ...route.params,
        // Replace local file URIs with Firebase Storage URLs
        permitPhoto: permitPhotoURL,
        frontIDPhoto: frontIDPhotoURL,
        backIDPhoto: backIDPhotoURL,
        businessImages: businessImageURLs,
        businessLocation: selectedLocation,
        businessAddress: locationAddress,
        userId: user.uid,
        userEmail: user.email,
        registrationDate: new Date().toISOString(),
        status: 'pending', // pending, approved, rejected
      };

      // Save to businesses collection
      const businessRef = await addDoc(collection(db, 'businesses'), completeFormData);

      // Update user document to include business registration
      await setDoc(doc(db, 'users', user.uid), {
        hasBusinessRegistration: true,
        businessId: businessRef.id,
        lastUpdated: new Date().toISOString(),
      }, { merge: true });

      console.log('Business registration saved successfully:', businessRef.id);
      
      Alert.alert(
        'Registration Complete!', 
        'Your business registration has been submitted successfully. We will review your application and contact you soon.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('BusinessMain' as any)
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
                <ScrollView style={styles.searchResultsList} showsVerticalScrollIndicator={false}>
                  {searchResults.map((result, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.searchResultItem}
                      onPress={() => handleSelectSearchResult(result, index)}
                    >
                      <Ionicons name="location-outline" size={20} color="#667eea" />
                      <View style={styles.searchResultText}>
                        <Text style={styles.searchResultTitle}>
                          {searchQuery} (Result {index + 1})
                        </Text>
                        <Text style={styles.searchResultSubtitle}>
                          Lat: {result.latitude.toFixed(4)}, Lng: {result.longitude.toFixed(4)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.closeSearchResults}
                  onPress={() => {
                    setShowSearchResults(false);
                    setSearchResults([]);
                  }}
                >
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Map */}
          <View style={styles.mapContainer}>
            {selectedLocation && (
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={selectedLocation}
                onPress={handleMapPress}
              >
                <Marker
                  coordinate={{
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                  }}
                  title="Business Location"
                  description="Tap to select this location"
                />
              </MapView>
            )}
            
            {/* Floating Current Location Button */}
            <TouchableOpacity onPress={handleUseCurrentLocation} style={styles.floatingLocationButton}>
              <Ionicons name="location" size={24} color="#667eea" />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.bottomContainer}
          >
            {/* Location Info */}
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Selected Location:</Text>
              <Text style={styles.locationText}>
                {locationAddress || 'No location selected'}
              </Text>
              <Text style={styles.instructionText}>
                Tap on the map to select your business location or search for a specific address.
              </Text>
            </View>

            {/* Next Button */}
            <TouchableOpacity 
              onPress={handleNext} 
              style={[styles.nextButton, isSubmitting && styles.nextButtonDisabled]}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <View style={styles.buttonLoadingContainer}>
                  <ActivityIndicator size="small" color="white" style={styles.loadingIndicator} />
                  <Text style={styles.nextButtonText}>Saving Registration...</Text>
                </View>
              ) : (
                <Text style={styles.nextButtonText}>Complete Registration</Text>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </TouchableWithoutFeedback>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 20,
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  searchButton: {
    backgroundColor: '#667eea',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minHeight: 300,
  },
  map: {
    flex: 1,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  locationInfo: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    marginBottom: 15,
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    lineHeight: 20,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  nextButton: {
    backgroundColor: '#667eea',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  floatingLocationButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchResultsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    marginTop: 10,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchResultsList: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultText: {
    marginLeft: 10,
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  searchResultSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  closeSearchResults: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIndicator: {
    marginRight: 10,
  },
});

export default BusinessLocationScreen; 