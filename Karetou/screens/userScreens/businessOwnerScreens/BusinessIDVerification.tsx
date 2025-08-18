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

const { width: screenWidth } = Dimensions.get('window');

type RootStackParamList = {
  BusinessIDVerification: {
    permitPhoto: string;
    permitNumber: string;
    businessName: string;
    businessOwner: string;
    selectedType: string;
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
  const [frontIDPhoto, setFrontIDPhoto] = useState<string | null>(null);
  const [backIDPhoto, setBackIDPhoto] = useState<string | null>(null);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return false;
    }
    return true;
  };

  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera permissions to make this work!');
      return false;
    }
    return true;
  };

  const handleChoosePhoto = async (type: 'front' | 'back', source: 'camera' | 'gallery') => {
    let hasPermission = false;
    
    if (source === 'camera') {
      hasPermission = await requestCameraPermissions();
    } else {
      hasPermission = await requestPermissions();
    }

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

  const renderPhotoSection = (type: 'front' | 'back', photo: string | null, setPhoto: (uri: string) => void) => (
    <View style={styles.photoSection}>
      <Text style={styles.photoLabel}>{type === 'front' ? 'Front' : 'Back'} Photo</Text>
      <TouchableOpacity 
        onPress={() => setPhoto} 
        style={styles.photoContainer}
      >
        {photo ? (
          <LoadingImage source={{ uri: photo }} style={styles.photoPreview} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="id-card-outline" size={40} color="#666" />
            <Text style={styles.photoText}>Upload {type === 'front' ? 'Front' : 'Back'} Photo</Text>
          </View>
        )}
      </TouchableOpacity>
      
      <View style={styles.photoOptions}>
        <TouchableOpacity 
          style={styles.photoOption}
          onPress={() => handleChoosePhoto(type, 'camera')}
        >
          <Ionicons name="camera" size={20} color="#667eea" />
          <Text style={styles.photoOptionText}>Camera</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.photoOption}
          onPress={() => handleChoosePhoto(type, 'gallery')}
        >
          <Ionicons name="images" size={20} color="#667eea" />
          <Text style={styles.photoOptionText}>Gallery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.formCard}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.title}>ID Verification</Text>
            </View>

            <Text style={styles.description}>
              Please upload clear photos of your valid ID (front and back) for verification purposes.
            </Text>

            {/* Front ID Photo */}
            {renderPhotoSection('front', frontIDPhoto, setFrontIDPhoto)}

            {/* Back ID Photo */}
            {renderPhotoSection('back', backIDPhoto, setBackIDPhoto)}

            {/* Submit Button */}
            <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
              <Text style={styles.submitButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    lineHeight: 22,
  },
  photoSection: {
    marginBottom: 30,
  },
  photoLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  photoContainer: {
    marginBottom: 15,
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
  photoOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  photoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  photoOptionText: {
    marginLeft: 8,
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
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default BusinessIDVerificationScreen; 