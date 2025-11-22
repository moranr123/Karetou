import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../../contexts/AuthContext';
import { db, storage } from '../../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import LoadingImage from '../../../components/LoadingImage';
import { useResponsive } from '../../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../../components';

const { width: screenWidth } = Dimensions.get('window');

const businessTypes = ['Coffee Shop', 'Tourist Spot', 'Restaurant'];

type RootStackParamList = {
  EditBusiness: {
    business: any;
    focusOnHours?: boolean;
  };
};

type EditBusinessScreenNavigationProp = StackNavigationProp<RootStackParamList>;
type EditBusinessScreenRouteProp = RouteProp<RootStackParamList, 'EditBusiness'>;

interface LocationData {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const EditBusinessScreen = () => {
  const navigation = useNavigation<EditBusinessScreenNavigationProp>();
  const route = useRoute<EditBusinessScreenRouteProp>();
  const { user, theme } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius, getResponsiveWidth, getResponsiveHeight, dimensions } = useResponsive();

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;
  
  const isSmallScreen = dimensions.width < 360;
  
  const businessData = route.params?.business;
  const focusOnHours = route.params?.focusOnHours || false;
  
  const [permitPhoto, setPermitPhoto] = useState<string | null>(businessData?.permitPhoto || null);
  const [permitNumber, setPermitNumber] = useState(businessData?.permitNumber || '');
  const [businessName, setBusinessName] = useState(businessData?.businessName || '');
  const [businessOwner, setBusinessOwner] = useState(businessData?.businessOwner || '');
  const [selectedType, setSelectedType] = useState<string | null>(businessData?.selectedType || null);
  const [contactNumber, setContactNumber] = useState(businessData?.contactNumber || '');
  const [optionalContactNumber, setOptionalContactNumber] = useState(businessData?.optionalContactNumber || '');
  const [businessImages, setBusinessImages] = useState<string[]>(businessData?.businessImages || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Business Location State
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    businessData?.businessLocation || null
  );
  const [locationAddress, setLocationAddress] = useState<string>(businessData?.businessAddress || '');
  const [showLocationModal, setShowLocationModal] = useState(false);
  
  // Custom Time Picker State
  const [startTime, setStartTime] = useState<{ hour: number; minute: number } | null>(null);
  const [endTime, setEndTime] = useState<{ hour: number; minute: number } | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<'start' | 'end'>('start');
  const [tempHour, setTempHour] = useState(9);
  const [tempMinute, setTempMinute] = useState(0);

  useEffect(() => {
    // Parse business hours if available
    if (businessData?.businessHours) {
      const hours = businessData.businessHours.split(' - ');
      if (hours.length === 2) {
        const parseTime = (timeStr: string) => {
          const [time, period] = timeStr.split(' ');
          const [hourStr, minuteStr] = time.split(':');
          let hour = parseInt(hourStr);
          const minute = parseInt(minuteStr);
          
          if (period === 'PM' && hour !== 12) hour += 12;
          if (period === 'AM' && hour === 12) hour = 0;
          
          return { hour, minute };
        };
        
        setStartTime(parseTime(hours[0]));
        setEndTime(parseTime(hours[1]));
      }
    }
  }, [businessData]);

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

  const handleLocationSelect = async (event: any) => {
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
  };

  const handleChoosePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setPermitPhoto(result.assets[0].uri);
    }
  };

  const handleChooseBusinessImage = async () => {
    if (businessImages.length >= 5) {
      Alert.alert('Maximum Images', 'You can upload a maximum of 5 business images.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setBusinessImages([...businessImages, result.assets[0].uri]);
    }
  };

  const removeBusinessImage = (index: number) => {
    setBusinessImages(businessImages.filter((_, i) => i !== index));
  };

  const showTimepicker = (mode: 'start' | 'end') => {
    const currentTime = mode === 'start' ? startTime : endTime;
    if (currentTime) {
      setTempHour(currentTime.hour);
      setTempMinute(currentTime.minute);
    } else {
      setTempHour(9);
      setTempMinute(0);
    }
    setTimePickerMode(mode);
    setShowTimePicker(true);
  };

  const confirmTime = () => {
    const newTime = { hour: tempHour, minute: tempMinute };
    if (timePickerMode === 'start') {
      setStartTime(newTime);
    } else {
      setEndTime(newTime);
    }
    setShowTimePicker(false);
  };

  const cancelTime = () => {
    setShowTimePicker(false);
  };

  const formatTime = (time: { hour: number; minute: number } | null) => {
    if (!time) return 'Select Time';
    const displayHour = time.hour === 0 ? 12 : time.hour > 12 ? time.hour - 12 : time.hour;
    const period = time.hour >= 12 ? 'PM' : 'AM';
    const displayMinute = time.minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${period}`;
  };

  const handleSave = () => {
    // Validation
    if (!businessName.trim()) {
      Alert.alert('Missing Information', 'Please enter your business name.');
      return;
    }
    if (!selectedType) {
      Alert.alert('Missing Information', 'Please select a business type.');
      return;
    }
    if (!startTime || !endTime) {
      Alert.alert('Missing Information', 'Please set your business hours.');
      return;
    }
    if (!contactNumber.trim()) {
      Alert.alert('Missing Information', 'Please enter your contact number.');
      return;
    }
    if (!selectedLocation) {
      Alert.alert('Missing Information', 'Please select your business location.');
      return;
    }

    Alert.alert(
      'Save Changes',
      'Are you sure you want to save these changes?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Save',
          style: 'default',
          onPress: () => proceedToSave()
        }
      ]
    );
  };

  const proceedToSave = async () => {
    if (!user?.uid || !businessData?.id) {
      Alert.alert('Error', 'Unable to save changes. Please try again.');
      return;
    }

    setIsSubmitting(true);

    try {
      const businessHours = `${formatTime(startTime)} - ${formatTime(endTime)}`;
      
      // Upload images to Firebase Storage first if they are new (not URLs)
      let permitPhotoURL = permitPhoto;
      const businessImageURLs: string[] = [];
      
      // Upload permit photo if it's a local file
      if (permitPhoto && !permitPhoto.startsWith('http')) {
        permitPhotoURL = await uploadImageToStorage(permitPhoto, 'permit');
      }
      
      // Upload business images if they are local files
      for (let i = 0; i < businessImages.length; i++) {
        if (businessImages[i].startsWith('http')) {
          // Already uploaded, keep the URL
          businessImageURLs.push(businessImages[i]);
        } else {
          // Local file, upload to storage
          const businessImageURL = await uploadImageToStorage(businessImages[i], `business_image_${i + 1}`);
          businessImageURLs.push(businessImageURL);
        }
      }
      
      const updatedBusinessData = {
        ...businessData,
        permitPhoto: permitPhotoURL,
        permitNumber,
        businessName,
        businessOwner,
        selectedType,
        businessHours,
        contactNumber,
        optionalContactNumber,
        businessImages: businessImageURLs,
        businessLocation: selectedLocation,
        businessAddress: locationAddress,
        lastUpdated: new Date().toISOString(),
      };

      // Update existing business
      await setDoc(doc(db, 'businesses', businessData.id), updatedBusinessData, { merge: true });
      
      Alert.alert(
        'Changes Saved!',
        'Your business information has been updated successfully.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error('Error saving business:', error);
      Alert.alert(
        'Save Failed',
        'There was an error saving your business information. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadImageToStorage = async (imageUri: string, imageName: string): Promise<string> => {
    try {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }

      console.log(`Uploading ${imageName} to Firebase Storage...`);
      
      // Fetch the image
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Create storage reference
      const imageRef = ref(storage, `business-registration/${user.uid}/${imageName}_${Date.now()}`);
      
      // Upload the blob
      await uploadBytes(imageRef, blob);
      
      // Get download URL
      const downloadURL = await getDownloadURL(imageRef);
      
      console.log(`${imageName} uploaded successfully:`, downloadURL);
      return downloadURL;
    } catch (error) {
      console.error(`Error uploading ${imageName}:`, error);
      throw new Error(`Failed to upload ${imageName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const generateTimeOptions = (type: 'hour' | 'minute') => {
    if (type === 'hour') {
      return Array.from({ length: 24 }, (_, i) => i);
    } else {
      return Array.from({ length: 60 }, (_, i) => i);
    }
  };

  // If focusOnHours is true, show only business hours editing
  if (focusOnHours) {
    return (
      <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.formCard}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity 
                  onPress={() => navigation.goBack()} 
                  style={styles.backButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="arrow-back" size={iconSizes.lg} color="#333" />
                </TouchableOpacity>
                <ResponsiveText size="xl" weight="bold" color="#333" style={styles.title}>
                  Change Business Hours
                </ResponsiveText>
              </View>

              {/* Business Info Display */}
              <ResponsiveView style={styles.businessInfoCard}>
                <ResponsiveText size="lg" weight="bold" color="#333" style={styles.businessInfoTitle}>
                  {businessData?.businessName}
                </ResponsiveText>
                <ResponsiveText size="sm" color="#666" style={styles.businessInfoSubtitle}>
                  Update your operating hours
                </ResponsiveText>
              </ResponsiveView>

              {/* Business Hours Section */}
              <ResponsiveView style={styles.hoursSection}>
                <ResponsiveText size="md" weight="600" color="#333" style={styles.label}>
                  Operating Hours
                </ResponsiveText>
                <ResponsiveText size="sm" color="#666" style={styles.subLabel}>
                  Set your daily opening and closing times
                </ResponsiveText>
                
                <View style={styles.timeContainer}>
                  <TouchableOpacity 
                    onPress={() => showTimepicker('start')} 
                    style={styles.timeButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={iconSizes.md} color="#667eea" />
                    <View style={styles.timeButtonContent}>
                      <ResponsiveText size="xs" color="#666" style={styles.timeLabel}>
                        Opening Time
                      </ResponsiveText>
                      <ResponsiveText size="md" weight="500" color="#333" style={styles.timeButtonText}>
                        {formatTime(startTime)}
                      </ResponsiveText>
                    </View>
                    <Ionicons name="chevron-forward" size={iconSizes.md} color="#999" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => showTimepicker('end')} 
                    style={styles.timeButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={iconSizes.md} color="#667eea" />
                    <View style={styles.timeButtonContent}>
                      <ResponsiveText size="xs" color="#666" style={styles.timeLabel}>
                        Closing Time
                      </ResponsiveText>
                      <ResponsiveText size="md" weight="500" color="#333" style={styles.timeButtonText}>
                        {formatTime(endTime)}
                      </ResponsiveText>
                    </View>
                    <Ionicons name="chevron-forward" size={iconSizes.md} color="#999" />
                  </TouchableOpacity>
                </View>

                {/* Current Hours Display */}
                {startTime && endTime && (
                  <ResponsiveView style={styles.currentHoursDisplay}>
                    <ResponsiveText size="sm" color="#666" style={styles.currentHoursLabel}>
                      Current Hours:
                    </ResponsiveText>
                    <ResponsiveText size="md" weight="600" color="#333" style={styles.currentHoursText}>
                      {formatTime(startTime)} - {formatTime(endTime)}
                    </ResponsiveText>
                  </ResponsiveView>
                )}
              </ResponsiveView>

              {/* Save Button */}
              <TouchableOpacity 
                style={[styles.submitButton, (!startTime || !endTime) && styles.submitButtonDisabled]} 
                onPress={handleSave}
                disabled={!startTime || !endTime || isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={iconSizes.md} color="#fff" />
                    <ResponsiveText size="md" weight="bold" color="#fff" style={styles.submitButtonText}>
                      Save Business Hours
                    </ResponsiveText>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>

        {/* Time Picker Modal - Available for both focused and full edit modes */}
        <Modal
          visible={showTimePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={cancelTime}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.timePickerModal}>
              <View style={styles.timePickerHeader}>
                <TouchableOpacity 
                  onPress={cancelTime}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <ResponsiveText size="md" color="#667eea" style={styles.cancelButton}>
                    Cancel
                  </ResponsiveText>
                </TouchableOpacity>
                <ResponsiveText size="lg" weight="bold" color="#333" style={styles.timePickerTitle}>
                  {timePickerMode === 'start' ? 'Opening Time' : 'Closing Time'}
                </ResponsiveText>
                <TouchableOpacity 
                  onPress={confirmTime}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <ResponsiveText size="md" weight="600" color="#667eea" style={styles.confirmButton}>
                    Done
                  </ResponsiveText>
                </TouchableOpacity>
              </View>
              
              <View style={styles.timePickerContent}>
                <View style={styles.timeColumn}>
                  <ResponsiveText size="sm" weight="600" color="#666" style={styles.timeColumnLabel}>
                    Hour
                  </ResponsiveText>
                  <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
                    {generateTimeOptions('hour').map((hour) => (
                      <TouchableOpacity
                        key={hour}
                        style={[
                          styles.timeOption,
                          tempHour === hour && styles.selectedTimeOption,
                        ]}
                        onPress={() => setTempHour(hour)}
                        activeOpacity={0.7}
                      >
                        <ResponsiveText
                          size="lg"
                          weight={tempHour === hour ? "bold" : "normal"}
                          color={tempHour === hour ? "#fff" : "#333"}
                          style={[
                            styles.timeOptionText,
                            tempHour === hour && styles.selectedTimeOptionText,
                          ]}
                        >
                          {hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}
                        </ResponsiveText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                
                <View style={styles.timeColumn}>
                  <ResponsiveText size="sm" weight="600" color="#666" style={styles.timeColumnLabel}>
                    Minute
                  </ResponsiveText>
                  <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
                    {generateTimeOptions('minute').map((minute) => (
                      <TouchableOpacity
                        key={minute}
                        style={[
                          styles.timeOption,
                          tempMinute === minute && styles.selectedTimeOption,
                        ]}
                        onPress={() => setTempMinute(minute)}
                        activeOpacity={0.7}
                      >
                        <ResponsiveText
                          size="lg"
                          weight={tempMinute === minute ? "bold" : "normal"}
                          color={tempMinute === minute ? "#fff" : "#333"}
                          style={[
                            styles.timeOptionText,
                            tempMinute === minute && styles.selectedTimeOptionText,
                          ]}
                        >
                          {minute.toString().padStart(2, '0')}
                        </ResponsiveText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                
                <View style={styles.timeColumn}>
                  <ResponsiveText size="sm" weight="600" color="#666" style={styles.timeColumnLabel}>
                    AM/PM
                  </ResponsiveText>
                  <View style={styles.ampmContainer}>
                    <TouchableOpacity
                      style={[
                        styles.ampmButton,
                        tempHour < 12 && styles.selectedAmpmButton,
                      ]}
                      onPress={() => setTempHour(tempHour < 12 ? tempHour : tempHour - 12)}
                      activeOpacity={0.7}
                    >
                      <ResponsiveText
                        size="md"
                        weight={tempHour < 12 ? "bold" : "normal"}
                        color={tempHour < 12 ? "#fff" : "#333"}
                        style={[
                          styles.ampmButtonText,
                          tempHour < 12 && styles.selectedAmpmButtonText,
                        ]}
                      >
                        AM
                      </ResponsiveText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.ampmButton,
                        tempHour >= 12 && styles.selectedAmpmButton,
                      ]}
                      onPress={() => setTempHour(tempHour >= 12 ? tempHour : tempHour + 12)}
                      activeOpacity={0.7}
                    >
                      <ResponsiveText
                        size="md"
                        weight={tempHour >= 12 ? "bold" : "normal"}
                        color={tempHour >= 12 ? "#fff" : "#333"}
                        style={[
                          styles.ampmButtonText,
                          tempHour >= 12 && styles.selectedAmpmButtonText,
                        ]}
                      >
                        PM
                      </ResponsiveText>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.formCard}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity 
                onPress={() => navigation.goBack()} 
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={iconSizes.lg} color="#333" />
              </TouchableOpacity>
              <ResponsiveText size="xl" weight="bold" color="#333" style={styles.title}>
                Edit Business Profile
              </ResponsiveText>
            </View>

            {/* Business Name */}
            <ResponsiveText size="md" weight="600" color="#333" style={styles.label}>
              Business Name
            </ResponsiveText>
            <TextInput
              style={styles.input}
              placeholder="Enter business name"
              placeholderTextColor="#aaa"
              value={businessName}
              onChangeText={setBusinessName}
            />

            {/* Business Location */}
            <ResponsiveText size="md" weight="600" color="#333" style={styles.label}>
              Business Location
            </ResponsiveText>
            <TouchableOpacity 
              style={styles.locationButton}
              onPress={() => setShowLocationModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.locationButtonContent}>
                <Ionicons name="location-outline" size={iconSizes.md} color="#667eea" />
                <View style={styles.locationTextContainer}>
                  <ResponsiveText size="md" weight="500" color="#333" style={styles.locationButtonText} numberOfLines={1}>
                    {locationAddress || 'Select business location'}
                  </ResponsiveText>
                  {selectedLocation && (
                    <ResponsiveText size="xs" color="#666" style={styles.locationCoordinates}>
                      {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                    </ResponsiveText>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={iconSizes.md} color="#999" />
              </View>
            </TouchableOpacity>

            {/* Business Hours */}
            <ResponsiveText size="md" weight="600" color="#333" style={styles.label}>
              Business Hours
            </ResponsiveText>
            <View style={styles.timeContainer}>
              <TouchableOpacity 
                onPress={() => showTimepicker('start')} 
                style={styles.timeButton}
                activeOpacity={0.7}
              >
                <ResponsiveText size="md" weight="500" color="#333" style={styles.timeButtonText}>
                  Start: {formatTime(startTime)}
                </ResponsiveText>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => showTimepicker('end')} 
                style={styles.timeButton}
                activeOpacity={0.7}
              >
                <ResponsiveText size="md" weight="500" color="#333" style={styles.timeButtonText}>
                  End: {formatTime(endTime)}
                </ResponsiveText>
              </TouchableOpacity>
            </View>

            {/* Contact Number */}
            <ResponsiveText size="md" weight="600" color="#333" style={styles.label}>
              Contact Number
            </ResponsiveText>
            <TextInput
              style={styles.input}
              placeholder="Enter contact number"
              placeholderTextColor="#aaa"
              value={contactNumber}
              onChangeText={setContactNumber}
              keyboardType="phone-pad"
            />

            {/* Optional Contact Number */}
            <ResponsiveText size="md" weight="600" color="#333" style={styles.label}>
              Optional Contact Number
            </ResponsiveText>
            <TextInput
              style={styles.input}
              placeholder="Enter optional contact number"
              placeholderTextColor="#aaa"
              value={optionalContactNumber}
              onChangeText={setOptionalContactNumber}
              keyboardType="phone-pad"
            />

            {/* Business Images */}
            <ResponsiveText size="md" weight="600" color="#333" style={styles.label}>
              Business Images
            </ResponsiveText>
            <ResponsiveText size="sm" color="#666" style={styles.subLabel}>
              Update photos of your establishment, products, or services
            </ResponsiveText>
            
            <View style={styles.businessImagesContainer}>
              <View style={styles.businessImagesRow}>
                {[0, 1, 2].map((index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.businessImageSlot}
                    onPress={index < businessImages.length ? () => {} : handleChooseBusinessImage}
                  >
                    {businessImages[index] ? (
                      <View style={styles.businessImageWrapper}>
                        <LoadingImage 
                          source={{ uri: businessImages[index] }} 
                          style={styles.businessImagePreview}
                          placeholder="camera" 
                        />
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => removeBusinessImage(index)}
                        >
                          <Ionicons name="close-circle" size={24} color="#FF4444" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.businessImagePlaceholder}>
                        <Ionicons name="camera" size={iconSizes.xl} color="#999" />
                        <ResponsiveText size="xs" color="#666" style={styles.businessImageText}>
                          Add Photo
                        </ResponsiveText>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* Second row for additional images */}
              {businessImages.length > 3 && (
                <View style={styles.businessImagesRow}>
                  {[3, 4].map((index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.businessImageSlot}
                      onPress={() => {}}
                      activeOpacity={0.7}
                    >
                      {businessImages[index] ? (
                        <View style={styles.businessImageWrapper}>
                          <LoadingImage 
                            source={{ uri: businessImages[index] }} 
                            style={styles.businessImagePreview}
                            placeholder="camera"
                            resizeMode="cover"
                          />
                          <TouchableOpacity
                            style={styles.removeImageButton}
                            onPress={() => removeBusinessImage(index)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="close-circle" size={iconSizes.lg} color="#FF4444" />
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {/* Add More Images Button */}
              {businessImages.length >= 3 && businessImages.length < 5 && (
                <TouchableOpacity 
                  onPress={handleChooseBusinessImage} 
                  style={styles.addMoreImagesButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle" size={iconSizes.md} color="#667eea" />
                  <ResponsiveText size="sm" weight="500" color="#333" style={styles.addMoreImagesText}>
                    Add More Images ({businessImages.length}/5)
                  </ResponsiveText>
                </TouchableOpacity>
              )}
            </View>

            {/* Save Button */}
            <TouchableOpacity 
              onPress={handleSave} 
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <View style={styles.buttonLoadingContainer}>
                  <ActivityIndicator size="small" color="white" style={styles.loadingIndicator} />
                  <ResponsiveText size="md" weight="bold" color="#fff" style={styles.submitButtonText}>
                    Saving Changes...
                  </ResponsiveText>
                </View>
              ) : (
                <ResponsiveText size="md" weight="bold" color="#fff" style={styles.submitButtonText}>
                  Save Changes
                </ResponsiveText>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Location Selection Modal */}
        <Modal
          visible={showLocationModal}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setShowLocationModal(false)}
        >
          <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.modalContainer}>
            <SafeAreaView style={styles.modalSafeArea}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity 
                  onPress={() => setShowLocationModal(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={iconSizes.lg} color="#000" />
                </TouchableOpacity>
                <ResponsiveText size="lg" weight="bold" color="#000" style={styles.modalTitle}>
                  Select Business Location
                </ResponsiveText>
                <TouchableOpacity 
                  onPress={() => setShowLocationModal(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <ResponsiveText size="md" weight="600" color="#000" style={styles.doneButton}>
                    Done
                  </ResponsiveText>
                </TouchableOpacity>
              </View>

              {/* Map */}
              <View style={styles.mapContainer}>
                {selectedLocation && (
                  <MapView
                    style={styles.map}
                    initialRegion={selectedLocation}
                    onPress={handleLocationSelect}
                  >
                    <Marker
                      coordinate={{
                        latitude: selectedLocation.latitude,
                        longitude: selectedLocation.longitude,
                      }}
                      title="Business Location"
                      description="Your business location"
                    />
                  </MapView>
                )}
              </View>

              {/* Location Info */}
              {locationAddress && (
                <ResponsiveView style={styles.selectedLocationInfo}>
                  <Ionicons name="location" size={iconSizes.md} color="#667eea" />
                  <ResponsiveText size="sm" color="#333" style={styles.selectedLocationText} numberOfLines={2}>
                    {locationAddress}
                  </ResponsiveText>
                </ResponsiveView>
              )}
            </SafeAreaView>
          </LinearGradient>
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
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    minHeight: 50,
  },
  backButton: {
    marginRight: 15,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
  },
  label: {
    marginBottom: 15,
  },
  subLabel: {
    marginBottom: 15,
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 48,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  locationButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    minHeight: 48,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  locationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  locationButtonText: {
    // Styles handled by ResponsiveText
  },
  locationCoordinates: {
    marginTop: 2,
  },
  photoContainer: {
    marginBottom: 30,
  },
  photoPlaceholder: {
    height: 200,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoText: {
    marginTop: 8,
    fontSize: 16,
    color: '#666',
  },
  photoPreview: {
    height: 200,
    borderRadius: 10,
    width: '100%',
  },
  businessTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 25,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  selectedTypeButton: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    textAlign: 'center',
  },
  selectedTypeButtonText: {
    color: 'white',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: '2%',
  },
  timeButton: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    minHeight: 50,
    borderRadius: 10,
    flex: 0.48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  timeButtonText: {
    // Styles handled by ResponsiveText
  },
  businessImagesContainer: {
    marginBottom: 20,
  },
  businessImagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: '2%',
  },
  businessImageSlot: {
    width: '31%',
    aspectRatio: 1,
    minWidth: 80,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  businessImageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  businessImagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  businessImageText: {
    marginTop: 5,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  addMoreImagesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 25,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  addMoreImagesText: {
    color: '#333',
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: '#667eea',
    minHeight: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 15,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIndicator: {
    marginRight: 10,
  },
  // Location Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    minHeight: 60,
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  doneButton: {
    // Styles handled by ResponsiveText
  },
  mapContainer: {
    flex: 1,
    margin: 20,
    minHeight: 200,
    borderRadius: 15,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  selectedLocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    margin: 20,
    marginTop: 0,
    padding: 15,
    minHeight: 50,
    borderRadius: 10,
  },
  selectedLocationText: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  // Time Picker Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '60%',
    width: '90%',
    maxWidth: 400,
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  timePickerTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  cancelButton: {
    // Styles handled by ResponsiveText
  },
  confirmButton: {
    // Styles handled by ResponsiveText
  },
  timePickerContent: {
    flexDirection: 'row',
    minHeight: 200,
    maxHeight: 300,
  },
  timeColumn: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  timeColumnLabel: {
    paddingVertical: 10,
  },
  timeScrollView: {
    flex: 1,
    width: '100%',
  },
  timeOption: {
    paddingVertical: 15,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedTimeOption: {
    backgroundColor: '#667eea',
  },
  timeOptionText: {
    // Styles handled by ResponsiveText
  },
  selectedTimeOptionText: {
    // Styles handled by ResponsiveText
  },
  ampmContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  ampmButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    minHeight: 44,
    marginVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    minWidth: 60,
    alignItems: 'center',
  },
  selectedAmpmButton: {
    backgroundColor: '#667eea',
  },
  ampmButtonText: {
    // Styles handled by ResponsiveText
  },
  selectedAmpmButtonText: {
    // Styles handled by ResponsiveText
  },
  // Focused Business Hours Styles
  businessInfoCard: {
    backgroundColor: '#f8f9ff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  businessInfoTitle: {
    marginBottom: 5,
  },
  businessInfoSubtitle: {
    // Styles handled by ResponsiveText
  },
  hoursSection: {
    marginBottom: 30,
  },
  timeButtonContent: {
    flex: 1,
    marginLeft: 15,
    minWidth: 0,
  },
  timeLabel: {
    marginBottom: 2,
  },
  currentHoursDisplay: {
    backgroundColor: '#f0f8ff',
    borderRadius: 10,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#e0e8ff',
  },
  currentHoursLabel: {
    marginBottom: 5,
  },
  currentHoursText: {
    // Styles handled by ResponsiveText
  },
});

export default EditBusinessScreen; 