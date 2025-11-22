import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LoadingImage from '../../../components/LoadingImage';
import { useAuth } from '../../../contexts/AuthContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../../components';

const { width: screenWidth } = Dimensions.get('window');

type RootStackParamList = {
  BusinessIDVerification: {
    permitPhoto: string;
    permitNumber: string;
    businessName: string;
    businessOwner: string;
    selectedType: string;
    selectedCategories: string[];
    businessHours: string;
    contactNumber: string;
    optionalContactNumber: string;
    businessImages: string[];
  };
};

type BusinessIDVerificationScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'BusinessIDVerification'
>;

type BusinessIDVerificationScreenRouteProp = RouteProp<
  RootStackParamList,
  'BusinessIDVerification'
>;

const BusinessIDVerificationScreen = () => {
  const navigation = useNavigation<BusinessIDVerificationScreenNavigationProp>();
  const route = useRoute<BusinessIDVerificationScreenRouteProp>();
  const { theme } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius, getResponsiveWidth, getResponsiveHeight } = useResponsive();
  const [frontIDPhoto, setFrontIDPhoto] = useState<string | null>(null);
  const [backIDPhoto, setBackIDPhoto] = useState<string | null>(null);

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  // Progress tracking
  const registrationSteps = [
    { id: 1, title: 'Business Info', description: 'Basic details' },
    { id: 2, title: 'Verification', description: 'ID verification' },
    { id: 3, title: 'Location', description: 'Set location' },
    { id: 4, title: 'Complete', description: 'Final review' }
  ];

  const requestPermissions = async (type: 'camera' | 'gallery') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera permissions to take photos!');
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to select photos!');
        return false;
      }
    }
    return true;
  };

  const showImagePickerOptions = (type: 'front' | 'back') => {
    Alert.alert(
      `Select ${type === 'front' ? 'Front' : 'Back'} Photo`,
      'Choose how you want to add the photo',
      [
        {
          text: 'Camera',
          onPress: () => handleChoosePhoto(type, 'camera'),
        },
        {
          text: 'Gallery',
          onPress: () => handleChoosePhoto(type, 'gallery'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleChoosePhoto = async (type: 'front' | 'back', source: 'camera' | 'gallery') => {
    const hasPermission = await requestPermissions(source);
    if (!hasPermission) return;

    let result;
    if (source === 'camera') {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
    }

    if (!result.canceled) {
      if (type === 'front') {
        setFrontIDPhoto(result.assets[0].uri);
      } else {
        setBackIDPhoto(result.assets[0].uri);
      }
    }
  };

  const handleSubmit = () => {
    if (!frontIDPhoto || !backIDPhoto) {
      Alert.alert('Incomplete Form', 'Please upload both front and back photos of your valid ID.');
      return;
    }

    const completeFormData = {
      ...route.params,
      frontIDPhoto,
      backIDPhoto,
    };

    navigation.navigate('BusinessLocation' as any, completeFormData);
  };

  // Calculate current progress (Step 2 - Verification)
  const calculateProgress = () => {
    // Step 2 is always 50% complete when on this screen
    // It only becomes 100% when user navigates to next step
    return 50;
  };

  const currentProgress = calculateProgress();
  const currentStep = 2; // We're on step 2

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
      marginBottom: spacing.xl,
      minHeight: 50,
    },
    backButton: {
      marginRight: spacing.md,
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      flex: 1,
    },
    description: {
      marginBottom: spacing.xl,
      lineHeight: fontSizes.md * 1.4,
      paddingHorizontal: spacing.xs,
    },
    photoSection: {
      marginBottom: spacing.xl,
    },
    photoLabel: {
      marginBottom: spacing.sm,
    },
    photoContainer: {
      marginBottom: spacing.sm,
    },
    photoPlaceholder: {
      minHeight: getResponsiveHeight(20),
      maxHeight: 250,
      aspectRatio: 4/3,
      backgroundColor: '#f8f9fa',
      borderRadius: borderRadius.md,
      borderWidth: 2,
      borderColor: '#ddd',
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.md,
    },
    photoText: {
      marginTop: spacing.sm,
      textAlign: 'center',
      paddingHorizontal: spacing.sm,
    },
    photoPreview: {
      minHeight: getResponsiveHeight(20),
      maxHeight: 250,
      aspectRatio: 4/3,
      borderRadius: borderRadius.md,
      width: '100%',
    },
    photoPreviewContainer: {
      position: 'relative',
      minHeight: getResponsiveHeight(20),
      maxHeight: 250,
      aspectRatio: 4/3,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
    },
    changePhotoBadge: {
      position: 'absolute',
      bottom: spacing.sm,
      right: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      minHeight: 28,
      borderRadius: borderRadius.sm,
    },
    changePhotoText: {
      color: '#fff',
      marginLeft: spacing.xs,
    },
    submitButton: {
      backgroundColor: '#667eea',
      minHeight: 50,
      borderRadius: borderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
    },
    submitButtonText: {
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

  const renderPhotoSection = (type: 'front' | 'back', photo: string | null) => (
    <ResponsiveView style={styles.photoSection}>
      <ResponsiveText size="md" weight="600" color="#333" style={styles.photoLabel}>
        {type === 'front' ? 'Front' : 'Back'} Photo
      </ResponsiveText>
      <TouchableOpacity 
        onPress={() => showImagePickerOptions(type)} 
        style={styles.photoContainer}
        activeOpacity={0.7}
      >
        {photo ? (
          <View style={styles.photoPreviewContainer}>
            <LoadingImage 
              source={{ uri: photo }} 
              style={styles.photoPreview}
              resizeMode="cover"
            />
            <View style={styles.changePhotoBadge}>
              <Ionicons name="camera" size={iconSizes.sm} color="#fff" />
              <ResponsiveText size="xs" weight="500" color="#fff" style={styles.changePhotoText}>
                Tap to change
              </ResponsiveText>
            </View>
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="card-outline" size={iconSizes.xxxxl} color="#666" />
            <ResponsiveText size="md" color="#666" style={styles.photoText}>
              Tap to upload {type === 'front' ? 'Front' : 'Back'} Photo
            </ResponsiveText>
          </View>
        )}
      </TouchableOpacity>
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
              <TouchableOpacity 
                onPress={() => navigation.goBack()} 
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={iconSizes.lg} color="#333" />
              </TouchableOpacity>
              <ResponsiveText size="xl" weight="bold" color="#333" style={styles.title}>
                ID Verification
              </ResponsiveText>
            </View>

            <ResponsiveText size="md" color="#666" style={styles.description}>
              Please upload clear photos of your valid ID (front and back) for verification purposes.
            </ResponsiveText>

            {renderPhotoSection('front', frontIDPhoto)}
            {renderPhotoSection('back', backIDPhoto)}

            <TouchableOpacity 
              onPress={handleSubmit} 
              style={styles.submitButton}
              activeOpacity={0.8}
            >
              <ResponsiveText size="lg" weight="bold" color="#fff" style={styles.submitButtonText}>
                Next
              </ResponsiveText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default BusinessIDVerificationScreen;
