import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Alert, Image, ScrollView, Platform, StatusBar, Modal, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../contexts/AuthContext';
import { db, storage } from '../../../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import NotificationService from '../../../services/NotificationService';

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

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Post</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Card Container */}
        <View style={styles.card}>
          {/* Business Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Business</Text>
            <TouchableOpacity 
              style={styles.businessSelector}
              onPress={() => setBusinessDropdownVisible(true)}
            >
              <Text style={styles.businessSelectorText}>
                {businesses.find(b => b.id === selectedBusinessId)?.businessName || 'Select Business'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#667eea" />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Content Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What's happening?</Text>
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
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Image Upload */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Photo</Text>
            <Text style={styles.sectionSubtitle}>Optional - Make your post more engaging</Text>
            
            {selectedImage ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => setSelectedImage(null)}
                >
                  <Ionicons name="close-circle" size={28} color="#ff4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.imagePickerButton} onPress={showImagePicker}>
                <Ionicons name="camera" size={32} color="#667eea" />
                <Text style={styles.imagePickerText}>Tap to add photo</Text>
                <Text style={styles.imagePickerSubtext}>Camera or Gallery</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Post Button */}
          <TouchableOpacity 
            style={[styles.postButton, uploading && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={uploading}
          >
            <Text style={styles.postButtonText}>
              {uploading ? 'Publishing...' : 'Publish Post'}
            </Text>
            {!uploading && <Ionicons name="send" size={20} color="#fff" style={{ marginLeft: 8 }} />}
          </TouchableOpacity>
        </View>
      </ScrollView>

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
              <Text style={styles.modalTitle}>Select Business</Text>
              <TouchableOpacity onPress={() => setBusinessDropdownVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
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
                >
                  <Text style={[
                    styles.businessOptionText,
                    selectedBusinessId === item.id && styles.businessOptionTextSelected
                  ]}>
                    {item.businessName}
                  </Text>
                  {selectedBusinessId === item.id && (
                    <Ionicons name="checkmark" size={20} color="#667eea" />
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
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  businessSelectorText: {
    color: '#495057',
    fontSize: 16,
    fontWeight: '500',
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
  },
  selectedImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  imagePickerButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#667eea',
    borderStyle: 'dashed',
  },
  imagePickerText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  imagePickerSubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
  postButton: {
    backgroundColor: '#667eea',
    borderRadius: 15,
    paddingVertical: 18,
    paddingHorizontal: 32,
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
    fontSize: 18,
    fontWeight: 'bold',
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  businessOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  businessOptionSelected: {
    backgroundColor: '#f0f8ff',
  },
  businessOptionText: {
    fontSize: 16,
    color: '#333',
  },
  businessOptionTextSelected: {
    color: '#667eea',
    fontWeight: 'bold',
  },
});

export default BusinessCreatePostScreen; 