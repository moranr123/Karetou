import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Alert, Image, ScrollView, Platform, StatusBar, Modal, FlatList, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../contexts/AuthContext';
import { db, storage } from '../../../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import NotificationService from '../../../services/NotificationService';
import { useResponsive } from '../../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../../components';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Business {
  id: string;
  businessName: string;
  businessImages?: string[];
  status: string;
  userId: string;
  selectedType?: string;
}

const BusinessCreatePostScreen = () => {
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [businessDropdownVisible, setBusinessDropdownVisible] = useState(false);
  
  const { user, theme } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius, getResponsiveWidth, getResponsiveHeight, dimensions } = useResponsive();

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;
  
  const isSmallScreen = dimensions.width < 360;

  // Fetch user's active businesses
  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!user?.uid) return;
      
      try {
        const businessesQuery = query(
          collection(db, 'businesses'),
          where('userId', '==', user.uid),
          where('status', '==', 'approved')
        );
        
        const snapshot = await getDocs(businessesQuery);
        const businessData: Business[] = [];
        
        snapshot.forEach(doc => {
          businessData.push({ id: doc.id, ...doc.data() } as Business);
        });
        
        console.log('Found businesses for user:', businessData.length, businessData.map(b => b.businessName));
        
        setBusinesses(businessData);
        if (businessData.length > 0) {
          setSelectedBusinessId(businessData[0].id);
        }
      } catch (error) {
        console.error('Error fetching businesses:', error);
        Alert.alert('Error', 'Failed to load your businesses');
      } finally {
        setLoading(false);
      }
    };

    fetchBusinesses();
  }, [user?.uid]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const showImagePicker = () => {
    Alert.alert(
      'Select Image',
      'Choose how you want to add an image',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Gallery', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const uploadImage = async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const filename = `posts/${user?.uid}/${Date.now()}.jpg`;
    const imageRef = ref(storage, filename);
    
    await uploadBytes(imageRef, blob);
    return await getDownloadURL(imageRef);
  };

  const handlePost = async () => {
    if (!content.trim() && !selectedImage) {
      Alert.alert('Error', 'Please add some content or an image');
      return;
    }

    if (!selectedBusinessId) {
      Alert.alert('Error', 'Please select a business');
      return;
    }

    setUploading(true);

    try {
      let imageUrl = '';
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      const selectedBusiness = businesses.find(b => b.id === selectedBusinessId);
      
      const postData = {
        businessId: selectedBusinessId,
        businessName: selectedBusiness?.businessName || 'Unknown Business',
        businessImage: selectedBusiness?.businessImages && selectedBusiness.businessImages.length > 0 ? selectedBusiness.businessImages[0] : '',
        content: content.trim(),
        imageUrl,
        createdAt: serverTimestamp(),
        likes: [],
        comments: [],
        savedBy: [],
        ownerId: user?.uid
      };

      const docRef = await addDoc(collection(db, 'posts'), postData);

      // Send notification to all regular users about the new post
      const notificationService = NotificationService.getInstance();
      await notificationService.notifyNewPost(
        docRef.id,
        selectedBusiness?.businessName || 'Unknown Business',
        selectedBusiness?.selectedType || 'Business',
        content.trim(),
        user?.uid || ''
      );

      Alert.alert('Success', 'Post created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setContent('');
            setSelectedImage(null);
          }
        }
      ]);
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading your businesses...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (businesses.length === 0) {
    return (
      <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.emptyContainer}>
            <Ionicons name="storefront-outline" size={60} color="#999" />
            <Text style={styles.emptyText}>No Active Businesses</Text>
            <Text style={styles.emptySubtext}>
              You need to have at least one verified business to create posts
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <ResponsiveText size="xl" weight="bold" color={theme === 'dark' ? '#FFF' : '#000'} style={styles.headerTitle}>
            Create Post
          </ResponsiveText>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Main Card Container */}
        <ResponsiveView style={styles.card}>
          {/* Business Selection */}
          <ResponsiveView style={styles.section}>
            <ResponsiveText size="lg" weight="700" color="#333" style={styles.sectionTitle}>
              Select Business
            </ResponsiveText>
            <TouchableOpacity 
              style={styles.businessSelector}
              onPress={() => setBusinessDropdownVisible(true)}
              activeOpacity={0.7}
            >
              <ResponsiveText size="md" weight="500" color="#495057" style={styles.businessSelectorText} numberOfLines={1}>
                {businesses.find(b => b.id === selectedBusinessId)?.businessName || 'Select Business'}
              </ResponsiveText>
              <Ionicons name="chevron-down" size={iconSizes.md} color="#667eea" />
            </TouchableOpacity>
          </ResponsiveView>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Content Input */}
          <ResponsiveView style={styles.section}>
            <ResponsiveText size="lg" weight="700" color="#333" style={styles.sectionTitle}>
              What's happening?
            </ResponsiveText>
            <TextInput
              style={styles.contentInput}
              placeholder="Share something with your customers..."
              placeholderTextColor="#999"
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </ResponsiveView>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Image Upload */}
          <ResponsiveView style={styles.section}>
            <ResponsiveText size="lg" weight="700" color="#333" style={styles.sectionTitle}>
              Add Photo
            </ResponsiveText>
            <ResponsiveText size="sm" color="#666" style={styles.sectionSubtitle}>
              Optional - Make your post more engaging
            </ResponsiveText>
            
            {selectedImage ? (
              <View style={styles.imageContainer}>
                <Image 
                  source={{ uri: selectedImage }} 
                  style={styles.selectedImage}
                  resizeMode="cover"
                />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => setSelectedImage(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={iconSizes.xl} color="#ff4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.imagePickerButton} 
                onPress={showImagePicker}
                activeOpacity={0.7}
              >
                <Ionicons name="camera" size={iconSizes.xxl} color="#667eea" />
                <ResponsiveText size="md" weight="600" color="#667eea" style={styles.imagePickerText}>
                  Tap to add photo
                </ResponsiveText>
                <ResponsiveText size="sm" color="#999" style={styles.imagePickerSubtext}>
                  Camera or Gallery
                </ResponsiveText>
              </TouchableOpacity>
            )}
          </ResponsiveView>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Post Button */}
          <TouchableOpacity 
            style={[styles.postButton, uploading && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <ResponsiveText size="lg" weight="bold" color="#fff" style={styles.postButtonText}>
              {uploading ? 'Publishing...' : 'Publish Post'}
            </ResponsiveText>
            {!uploading && <Ionicons name="send" size={iconSizes.md} color="#fff" style={{ marginLeft: 8 }} />}
          </TouchableOpacity>
        </ResponsiveView>
      </ScrollView>
      </SafeAreaView>

      {/* Business Selection Modal */}
      <Modal
        visible={businessDropdownVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setBusinessDropdownVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.businessModal}>
            <View style={styles.modalHeader}>
              <ResponsiveText size="lg" weight="bold" color="#333" style={styles.modalTitle}>
                Select Business
              </ResponsiveText>
              <TouchableOpacity 
                onPress={() => setBusinessDropdownVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={iconSizes.lg} color="#333" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={businesses}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.businessOption,
                    selectedBusinessId === item.id && styles.businessOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedBusinessId(item.id);
                    setBusinessDropdownVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <ResponsiveText 
                    size="md" 
                    weight={selectedBusinessId === item.id ? "bold" : "normal"}
                    color={selectedBusinessId === item.id ? "#667eea" : "#333"}
                    style={styles.businessOptionText}
                  >
                    {item.businessName}
                  </ResponsiveText>
                  {selectedBusinessId === item.id && (
                    <Ionicons name="checkmark" size={iconSizes.md} color="#667eea" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 44 : 44,
    paddingBottom: 16,
    paddingHorizontal: '5%',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    minHeight: 60,
  },
  headerTitle: {
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: '5%',
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: '6%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  sectionSubtitle: {
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 20,
  },
  businessSelector: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    minHeight: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  businessSelectorText: {
    flex: 1,
    marginRight: 8,
  },
  contentInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    color: '#495057',
    fontSize: 16,
    minHeight: 140,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  imageContainer: {
    position: 'relative',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 300,
  },
  selectedImage: {
    width: '100%',
    aspectRatio: 4/3,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: '8%',
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#667eea',
    borderStyle: 'dashed',
  },
  imagePickerText: {
    marginTop: 8,
  },
  imagePickerSubtext: {
    marginTop: 4,
  },
  postButton: {
    backgroundColor: '#667eea',
    borderRadius: 15,
    paddingVertical: 18,
    paddingHorizontal: 32,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#667eea',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  postButtonDisabled: {
    opacity: 0.6,
  },
  postButtonText: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#333',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  businessModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 60,
  },
  modalTitle: {
    flex: 1,
  },
  businessOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  businessOptionSelected: {
    backgroundColor: '#f0f8ff',
  },
  businessOptionText: {
    flex: 1,
    marginRight: 8,
  },
});

export default BusinessCreatePostScreen; 