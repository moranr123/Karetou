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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import LoadingImage from '../../../components/LoadingImage';

const { width: screenWidth } = Dimensions.get('window');
const businessTypes = ['Coffee Shop', 'Tourist Spot', 'Restaurant'];
const businessCategories = [
  'Historical Landmarks',
  'Korean BBQ',
  'Modern/Minimalist Cafés',
  'Budget-Friendly Eats',
  'Fine Dining',
  'Heritage Cafés',
  'Nature Spots',
  'Amusement',
];

const RegisterBusinessScreen = () => {
  const navigation = useNavigation();
  const { user, theme } = useAuth();

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;
  
  const [permitPhoto, setPermitPhoto] = useState<string | null>(null);
  const [permitNumber, setPermitNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessOwner, setBusinessOwner] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [contactNumber, setContactNumber] = useState('');
  const [optionalContactNumber, setOptionalContactNumber] = useState('');
  const [businessImages, setBusinessImages] = useState<string[]>([]);

  // Custom Time Picker State
  const [startTime, setStartTime] = useState<{ hour: number; minute: number } | null>(null);
  const [endTime, setEndTime] = useState<{ hour: number; minute: number } | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<'start' | 'end'>('start');
  const [tempHour, setTempHour] = useState(9);
  const [tempMinute, setTempMinute] = useState(0);

  // Fetch user's full name from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setBusinessOwner(userData.fullName || '');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };

    fetchUserData();
  }, [user?.uid]);

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

  const handleNext = () => {
    // Validation
    if (!permitPhoto) {
      Alert.alert('Missing Information', 'Please upload your business permit photo.');
      return;
    }
    if (!permitNumber.trim()) {
      Alert.alert('Missing Information', 'Please enter your permit number.');
      return;
    }
    if (!businessName.trim()) {
      Alert.alert('Missing Information', 'Please enter your business name.');
      return;
    }
    if (!selectedType) {
      Alert.alert('Missing Information', 'Please select a business type.');
      return;
    }
    if (selectedCategories.length === 0) {
      Alert.alert('Missing Information', 'Please select at least one business category.');
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
    if (businessImages.length < 3) {
      Alert.alert('Missing Images', 'Please upload at least 3 business images.');
      return;
    }

    // Navigate to Business ID Verification screen
    const businessHours = `${formatTime(startTime)} - ${formatTime(endTime)}`;
    
    (navigation as any).navigate('BusinessIDVerification', {
      permitPhoto,
      permitNumber,
      businessName,
      businessOwner,
      selectedType,
      selectedCategories,
      businessHours,
      contactNumber,
      optionalContactNumber,
      businessImages,
    });
  };

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(item => item !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const generateTimeOptions = (type: 'hour' | 'minute') => {
    if (type === 'hour') {
      return Array.from({ length: 24 }, (_, i) => i);
    } else {
      return Array.from({ length: 60 }, (_, i) => i);
    }
  };

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.formCard}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.title}>Register Business</Text>
            </View>

            {/* Permit Photo */}
            <Text style={styles.label}>Business Permit Photo *</Text>
            <TouchableOpacity onPress={handleChoosePhoto} style={styles.photoContainer}>
              {permitPhoto ? (
                <LoadingImage 
                  source={{ uri: permitPhoto }} 
                  style={styles.photoPreview}
                  placeholder="business" 
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="document-outline" size={40} color="#666" />
                  <Text style={styles.photoText}>Upload Permit Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Permit Number */}
            <Text style={styles.label}>Permit Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter permit number"
              placeholderTextColor="#aaa"
              value={permitNumber}
              onChangeText={setPermitNumber}
            />

            {/* Business Name */}
            <Text style={styles.label}>Business Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter business name"
              placeholderTextColor="#aaa"
              value={businessName}
              onChangeText={setBusinessName}
            />

            {/* Business Owner */}
            <Text style={styles.label}>Business Owner *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter business owner name"
              placeholderTextColor="#aaa"
              value={businessOwner}
              onChangeText={setBusinessOwner}
            />

            {/* Business Type */}
            <Text style={styles.label}>Business Type *</Text>
            <View style={styles.businessTypeRow}>
              {businessTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    selectedType === type && styles.selectedTypeButton,
                  ]}
                  onPress={() => setSelectedType(type)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      selectedType === type && styles.selectedTypeButtonText,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Business Category */}
            <Text style={styles.label}>Business Category * (Select all that apply)</Text>
            <View style={styles.categoryListContainer}>
              {businessCategories.map((category) => {
                const isSelected = selectedCategories.includes(category);
                return (
                  <TouchableOpacity
                    key={category}
                    style={styles.categoryCheckboxRow}
                    onPress={() => toggleCategory(category)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.categoryCheckboxContainer}>
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={28}
                        color={isSelected ? '#667eea' : '#999'}
                      />
                    </View>
                    <Text style={styles.categoryCheckboxLabel}>{category}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Business Hours */}
            <Text style={styles.label}>Business Hours *</Text>
            <View style={styles.timeContainer}>
              <TouchableOpacity onPress={() => showTimepicker('start')} style={styles.timeButton}>
                <Text style={styles.timeButtonText}>
                  Start: {formatTime(startTime)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => showTimepicker('end')} style={styles.timeButton}>
                <Text style={styles.timeButtonText}>
                  End: {formatTime(endTime)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Contact Number */}
            <Text style={styles.label}>Contact Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter contact number"
              placeholderTextColor="#aaa"
              value={contactNumber}
              onChangeText={setContactNumber}
              keyboardType="phone-pad"
            />

            {/* Optional Contact Number */}
            <Text style={styles.label}>Optional Contact Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter optional contact number"
              placeholderTextColor="#aaa"
              value={optionalContactNumber}
              onChangeText={setOptionalContactNumber}
              keyboardType="phone-pad"
            />

            {/* Business Images Section */}
            <Text style={styles.label}>Business Images (Minimum 3 Required) *</Text>
            <Text style={styles.subLabel}>Showcase your business with photos of your establishment, products, or services</Text>
            
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
                        <Ionicons name="camera" size={30} color="#999" />
                        <Text style={styles.businessImageText}>
                          {index < 3 ? 'Required' : 'Optional'}
                        </Text>
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
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {/* Add More Images Button */}
              {businessImages.length >= 3 && businessImages.length < 5 && (
                <TouchableOpacity onPress={handleChooseBusinessImage} style={styles.addMoreImagesButton}>
                  <Ionicons name="add-circle" size={20} color="#667eea" />
                  <Text style={styles.addMoreImagesText}>Add More Images ({businessImages.length}/5)</Text>
                </TouchableOpacity>
              )}
              
              {/* Image Counter */}
              <View style={styles.imageCounter}>
                <Text style={[
                  styles.imageCounterText,
                  businessImages.length >= 3 ? styles.imageCounterSuccess : styles.imageCounterWarning
                ]}>
                  {businessImages.length}/3 minimum images uploaded
                  {businessImages.length >= 3 && ' ✓'}
                </Text>
              </View>
            </View>

            {/* Next Button */}
            <TouchableOpacity onPress={handleNext} style={styles.submitButton}>
              <Text style={styles.submitButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Custom Time Picker Modal */}
        <Modal
          visible={showTimePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={cancelTime}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.timePickerModal}>
              <View style={styles.timePickerHeader}>
                <TouchableOpacity onPress={cancelTime}>
                  <Text style={styles.cancelButton}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.timePickerTitle}>
                  {timePickerMode === 'start' ? 'Start Time' : 'End Time'}
                </Text>
                <TouchableOpacity onPress={confirmTime}>
                  <Text style={styles.confirmButton}>Done</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.timePickerContent}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeColumnLabel}>Hour</Text>
                  <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
                    {generateTimeOptions('hour').map((hour) => (
                      <TouchableOpacity
                        key={hour}
                        style={[
                          styles.timeOption,
                          tempHour === hour && styles.selectedTimeOption,
                        ]}
                        onPress={() => setTempHour(hour)}
                      >
                        <Text
                          style={[
                            styles.timeOptionText,
                            tempHour === hour && styles.selectedTimeOptionText,
                          ]}
                        >
                          {hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                
                <View style={styles.timeColumn}>
                  <Text style={styles.timeColumnLabel}>Minute</Text>
                  <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
                    {generateTimeOptions('minute').map((minute) => (
                      <TouchableOpacity
                        key={minute}
                        style={[
                          styles.timeOption,
                          tempMinute === minute && styles.selectedTimeOption,
                        ]}
                        onPress={() => setTempMinute(minute)}
                      >
                        <Text
                          style={[
                            styles.timeOptionText,
                            tempMinute === minute && styles.selectedTimeOptionText,
                          ]}
                        >
                          {minute.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                
                <View style={styles.timeColumn}>
                  <Text style={styles.timeColumnLabel}>AM/PM</Text>
                  <View style={styles.ampmContainer}>
                    <TouchableOpacity
                      style={[
                        styles.ampmButton,
                        tempHour < 12 && styles.selectedAmpmButton,
                      ]}
                      onPress={() => setTempHour(tempHour < 12 ? tempHour : tempHour - 12)}
                    >
                      <Text
                        style={[
                          styles.ampmButtonText,
                          tempHour < 12 && styles.selectedAmpmButtonText,
                        ]}
                      >
                        AM
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.ampmButton,
                        tempHour >= 12 && styles.selectedAmpmButton,
                      ]}
                      onPress={() => setTempHour(tempHour >= 12 ? tempHour : tempHour + 12)}
                    >
                      <Text
                        style={[
                          styles.ampmButtonText,
                          tempHour >= 12 && styles.selectedAmpmButtonText,
                        ]}
                      >
                        PM
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
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
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  subLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#ddd',
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
    color: '#fff',
  },
  categoryListContainer: {
    marginBottom: 30,
  },
  categoryCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  categoryCheckboxContainer: {
    marginRight: 12,
  },
  categoryCheckboxLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  timeButton: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    flex: 0.48,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  timeButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#667eea',
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  businessImagesContainer: {
    marginBottom: 20,
  },
  businessImagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  businessImageSlot: {
    width: screenWidth * 0.28,
    height: screenWidth * 0.28,
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
  },
  businessImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessImageText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  addMoreImagesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  addMoreImagesText: {
    color: '#333',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  imageCounter: {
    marginTop: 10,
    alignItems: 'center',
  },
  imageCounterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  imageCounterSuccess: {
    color: '#4CAF50',
  },
  imageCounterWarning: {
    color: '#ffc107',
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
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  confirmButton: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: '600',
  },
  timePickerContent: {
    flexDirection: 'row',
    height: 200,
  },
  timeColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timeColumnLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingVertical: 10,
  },
  timeScrollView: {
    flex: 1,
    width: '100%',
  },
  timeOption: {
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedTimeOption: {
    backgroundColor: '#f0f4ff',
  },
  timeOptionText: {
    fontSize: 18,
    color: '#333',
  },
  selectedTimeOptionText: {
    color: '#667eea',
    fontWeight: '600',
  },
  ampmContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ampmButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
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
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectedAmpmButtonText: {
    color: '#fff',
  },
});

export default RegisterBusinessScreen; 