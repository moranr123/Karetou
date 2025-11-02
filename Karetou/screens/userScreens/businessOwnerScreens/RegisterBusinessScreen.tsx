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
import { useResponsive } from '../../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../../components';

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
  
  const [permitPhoto, setPermitPhoto] = useState<string | null>(null);
  const [permitNumber, setPermitNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessOwner, setBusinessOwner] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [contactNumber, setContactNumber] = useState('');
  const [optionalContactNumber, setOptionalContactNumber] = useState('');
  const [contactNumberError, setContactNumberError] = useState('');
  const [optionalContactNumberError, setOptionalContactNumberError] = useState('');
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
    if (contactNumber.length !== 11 || !contactNumber.startsWith('09')) {
      Alert.alert('Invalid Contact Number', 'Contact number must start with 09 and be exactly 11 digits.');
      return;
    }
    if (optionalContactNumber.trim() && (optionalContactNumber.length !== 11 || !optionalContactNumber.startsWith('09'))) {
      Alert.alert('Invalid Optional Contact Number', 'Optional contact number must start with 09 and be exactly 11 digits.');
      return;
    }
    if (optionalContactNumber.trim() && contactNumber === optionalContactNumber) {
      Alert.alert('Duplicate Contact Numbers', 'Contact number and optional contact number cannot be the same.');
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

  const validateAndFormatPhoneNumber = (input: string, isOptional: boolean = false): string => {
    // Remove all non-digit characters
    let digitsOnly = input.replace(/\D/g, '');
    
    // If empty and optional, allow it
    if (isOptional && digitsOnly === '') {
      return '';
    }
    
    // If user starts typing with "9", auto-prefix with "0" to make "09"
    if (digitsOnly.length === 1 && digitsOnly === '9') {
      return '09';
    }
    
    // If user types starting with "9" (not "09"), prefix with "0"
    if (digitsOnly.length > 0 && digitsOnly.startsWith('9') && !digitsOnly.startsWith('09')) {
      digitsOnly = '0' + digitsOnly;
    }
    
    // Limit to 11 digits maximum
    return digitsOnly.slice(0, 11);
  };

  const handleContactNumberChange = (text: string) => {
    const formatted = validateAndFormatPhoneNumber(text, false);
    setContactNumber(formatted);
    
    // Validate the formatted number
    if (formatted.length > 0) {
      if (!formatted.startsWith('09')) {
        setContactNumberError('Phone number must start with 09');
      } else if (formatted.length < 11) {
        setContactNumberError('Phone number must be exactly 11 digits');
      } else if (formatted === optionalContactNumber) {
        setContactNumberError('Contact number cannot be the same as optional contact number');
      } else {
        setContactNumberError('');
        // Clear optional contact number error if it was about matching
        if (optionalContactNumberError === 'Optional contact number cannot be the same as contact number') {
          setOptionalContactNumberError('');
        }
      }
    } else {
      setContactNumberError('');
    }
  };

  const handleOptionalContactNumberChange = (text: string) => {
    const formatted = validateAndFormatPhoneNumber(text, true);
    setOptionalContactNumber(formatted);
    
    // Validate the formatted number only if it's not empty
    if (formatted.length > 0) {
      if (!formatted.startsWith('09')) {
        setOptionalContactNumberError('Phone number must start with 09');
      } else if (formatted.length < 11) {
        setOptionalContactNumberError('Phone number must be exactly 11 digits');
      } else if (formatted === contactNumber) {
        setOptionalContactNumberError('Optional contact number cannot be the same as contact number');
      } else {
        setOptionalContactNumberError('');
        // Clear contact number error if it was about matching
        if (contactNumberError === 'Contact number cannot be the same as optional contact number') {
          setContactNumberError('');
        }
      }
    } else {
      setOptionalContactNumberError('');
    }
  };

  const generateTimeOptions = (type: 'hour' | 'minute') => {
    if (type === 'hour') {
      return Array.from({ length: 24 }, (_, i) => i);
    } else {
      return Array.from({ length: 60 }, (_, i) => i);
    }
  };

  // Calculate current progress - only based on step completion, not individual fields
  const calculateProgress = () => {
    // Step 1 is always 25% complete when on this screen
    // It only becomes 100% when user navigates to next step
    return 25;
  };

  const currentProgress = calculateProgress();
  const currentStep = Math.ceil((currentProgress / 100) * registrationSteps.length);

  // --- Styles ---
  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    scrollContainer: {
      flexGrow: 1,
      padding: spacing.lg,
    },
    progressContainer: {
      backgroundColor: '#fff',
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
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
    formCard: {
      backgroundColor: 'white',
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
      position: 'relative',
    },
    backButton: {
      position: 'absolute',
      left: 0,
      zIndex: 1,
    },
    title: {
      fontSize: fontSizes.xl,
      fontWeight: 'bold',
      color: '#333',
      textAlign: 'center',
      flex: 1,
    },
    label: {
      fontSize: fontSizes.md,
      fontWeight: '600',
      color: '#333',
      marginBottom: spacing.sm,
    },
    subLabel: {
      fontSize: fontSizes.sm,
      color: '#666',
      marginBottom: spacing.sm,
      lineHeight: fontSizes.sm * 1.4,
    },
    input: {
      backgroundColor: '#f8f9fa',
      borderRadius: borderRadius.md,
      padding: spacing.md,
      fontSize: fontSizes.md,
      marginBottom: spacing.xl,
      borderWidth: 1,
      borderColor: '#ddd',
    },
    photoContainer: {
      marginBottom: spacing.xl,
    },
    photoPlaceholder: {
      height: getResponsiveHeight(25),
      backgroundColor: '#f8f9fa',
      borderRadius: borderRadius.md,
      borderWidth: 2,
      borderColor: '#ddd',
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
    },
    photoText: {
      marginTop: spacing.sm,
      fontSize: fontSizes.md,
      color: '#666',
    },
    photoPreview: {
      height: getResponsiveHeight(25),
      borderRadius: borderRadius.md,
      width: '100%',
    },
    businessTypeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    typeButton: {
      flex: 1,
      backgroundColor: '#f8f9fa',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: borderRadius.xl,
      marginHorizontal: spacing.xs,
      borderWidth: 1,
      borderColor: '#ddd',
      alignItems: 'center',
    },
    selectedTypeButton: {
      backgroundColor: '#667eea',
      borderColor: '#667eea',
    },
    typeButtonText: {
      fontSize: fontSizes.sm,
      color: '#333',
      fontWeight: '500',
      textAlign: 'center',
    },
    selectedTypeButtonText: {
      color: '#fff',
    },
    categoryListContainer: {
      marginBottom: spacing.xl,
    },
    categoryCheckboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: '#f8f9fa',
      borderRadius: borderRadius.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: '#ddd',
    },
    categoryCheckboxContainer: {
      marginRight: spacing.sm,
    },
    categoryCheckboxLabel: {
      fontSize: fontSizes.md,
      fontWeight: '500',
      color: '#333',
      flex: 1,
    },
    timeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    timeButton: {
      backgroundColor: '#f8f9fa',
      padding: spacing.md,
      borderRadius: borderRadius.md,
      flex: 0.48,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#ddd',
    },
    timeButtonText: {
      fontSize: fontSizes.md,
      color: '#333',
      fontWeight: '500',
    },
    submitButton: {
      backgroundColor: '#667eea',
      height: getResponsiveHeight(6),
      borderRadius: borderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    submitButtonText: {
      color: '#fff',
      fontSize: fontSizes.lg,
      fontWeight: 'bold',
    },
    businessImagesContainer: {
      marginBottom: spacing.lg,
    },
    businessImagesRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    businessImageSlot: {
      width: getResponsiveWidth(28),
      height: getResponsiveWidth(28),
      backgroundColor: '#f8f9fa',
      borderRadius: borderRadius.md,
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
      borderRadius: borderRadius.sm,
    },
    removeImageButton: {
      position: 'absolute',
      top: -5,
      right: -5,
      backgroundColor: '#fff',
      borderRadius: borderRadius.sm,
    },
    businessImagePlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    businessImageText: {
      fontSize: fontSizes.xs,
      color: '#666',
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    addMoreImagesButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8f9fa',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.xl,
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: '#ddd',
    },
    addMoreImagesText: {
      color: '#333',
      fontSize: fontSizes.md,
      marginLeft: spacing.sm,
      fontWeight: '500',
    },
    imageCounter: {
      marginTop: spacing.sm,
      alignItems: 'center',
    },
    imageCounterText: {
      fontSize: fontSizes.sm,
      fontWeight: '500',
    },
    imageCounterSuccess: {
      color: '#4CAF50',
    },
    imageCounterWarning: {
      color: '#ffc107',
    },
    errorText: {
      fontSize: fontSizes.sm,
      color: '#FF4444',
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    inputError: {
      borderColor: '#FF4444',
      borderWidth: 2,
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
      borderRadius: borderRadius.xl,
      maxHeight: '60%',
      width: '90%',
      maxWidth: 400,
    },
    timePickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
    },
    timePickerTitle: {
      fontSize: fontSizes.lg,
      fontWeight: '600',
      color: '#333',
    },
    cancelButton: {
      fontSize: fontSizes.md,
      color: '#666',
    },
    confirmButton: {
      fontSize: fontSizes.md,
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
      fontSize: fontSizes.md,
      fontWeight: '600',
      color: '#333',
      paddingVertical: spacing.sm,
    },
    timeScrollView: {
      flex: 1,
      width: '100%',
    },
    timeOption: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    selectedTimeOption: {
      backgroundColor: '#f0f4ff',
    },
    timeOptionText: {
      fontSize: fontSizes.lg,
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
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginVertical: spacing.xs,
      borderRadius: borderRadius.sm,
      backgroundColor: '#f0f0f0',
      minWidth: 60,
      alignItems: 'center',
    },
    selectedAmpmButton: {
      backgroundColor: '#667eea',
    },
    ampmButtonText: {
      fontSize: fontSizes.md,
      color: '#333',
      fontWeight: '500',
    },
    selectedAmpmButtonText: {
      color: '#fff',
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

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Progress Bar */}
          <ProgressBar />
          
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
            <Text style={styles.subLabel}>Must start with 09 and be 11 digits (e.g., 09123456789)</Text>
            <TextInput
              style={[styles.input, contactNumberError && styles.inputError]}
              placeholder="09XXXXXXXXX"
              placeholderTextColor="#aaa"
              value={contactNumber}
              onChangeText={handleContactNumberChange}
              keyboardType="phone-pad"
              maxLength={11}
            />
            {contactNumberError ? (
              <Text style={styles.errorText}>{contactNumberError}</Text>
            ) : null}

            {/* Optional Contact Number */}
            <Text style={styles.label}>Optional Contact Number</Text>
            <Text style={styles.subLabel}>Must start with 09 and be 11 digits (e.g., 09123456789)</Text>
            <TextInput
              style={[styles.input, optionalContactNumberError && styles.inputError]}
              placeholder="09XXXXXXXXX"
              placeholderTextColor="#aaa"
              value={optionalContactNumber}
              onChangeText={handleOptionalContactNumberChange}
              keyboardType="phone-pad"
              maxLength={11}
            />
            {optionalContactNumberError ? (
              <Text style={styles.errorText}>{optionalContactNumberError}</Text>
            ) : null}

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

export default RegisterBusinessScreen; 