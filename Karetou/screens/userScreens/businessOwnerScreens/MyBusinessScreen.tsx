import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  RefreshControl,
  Modal,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../firebase';
import { doc, collection, query, where, getDocs, deleteDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import LoadingImage from '../../../components/LoadingImage';

const { width: screenWidth } = Dimensions.get('window');

const MyBusinessScreen = () => {
  const { user, theme, refreshData } = useAuth();
  const navigation = useNavigation();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [displayToggleLoading, setDisplayToggleLoading] = useState(false);

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  // Set up real-time listener for business data
  useEffect(() => {
    if (!user?.uid) return;

    console.log('🔄 Setting up real-time business listener for user:', user.uid);
    
    // Query for businesses using the old userId field structure (for backward compatibility)
    const businessQuery = query(
      collection(db, 'businesses'),
      where('userId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(
      businessQuery,
      (snapshot) => {
        const businessList: any[] = [];
        
        snapshot.forEach((doc) => {
          const business = doc.data();
          // Only include active (approved) and pending businesses, exclude rejected
          if (business.status === 'approved' || business.status === 'pending') {
            businessList.push({
              id: doc.id,
              ...business
            });
          }
        });
        
        // Sort by registration date (newest first)
        businessList.sort((a, b) => new Date(b.registrationDate || b.createdAt || 0).getTime() - new Date(a.registrationDate || a.createdAt || 0).getTime());
        
        setBusinesses(businessList);
        setLoading(false);
        
        console.log('✅ Business data updated in real-time:', businessList.length, 'businesses');
      },
      (error) => {
        console.error('Error in business listener:', error);
        setLoading(false);
        Alert.alert('Error', 'Failed to load business information.');
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log('🧹 Cleaning up business listener');
      unsubscribe();
    };
  }, [user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    // The real-time listener will automatically update the data
    // Just trigger a manual refresh in case of any missed updates
    refreshData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#4CAF50';
      case 'rejected':
        return '#F44336';
      case 'pending':
        return '#FF9800';
      default:
        return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Active';
      case 'rejected':
        return 'Rejected';
      case 'pending':
        return 'Pending Review';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading business information...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const handleBusinessCardPress = (business: any) => {
    setSelectedBusiness(business);
    setCurrentImageIndex(0);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedBusiness(null);
    setCurrentImageIndex(0);
  };

  const handleDeleteBusiness = (business: any) => {
    Alert.alert(
      'Delete Business',
      `Are you sure you want to delete "${business.businessName}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteBusiness(business.id),
        },
      ]
    );
  };

  const deleteBusiness = async (businessId: string) => {
    try {
      // Delete from main businesses collection
      await deleteDoc(doc(db, 'businesses', businessId));
      
      // Also remove from userAppBusinesses collection if it exists there
      try {
        await deleteDoc(doc(db, 'userAppBusinesses', businessId));
        console.log('✅ Business removed from user app collection');
      } catch (userAppError) {
        console.log('ℹ️ Business was not in user app collection (this is normal if it was never deployed)');
      }
      
      Alert.alert('Success', 'Business deleted successfully and removed from user app.');
      // Refresh the business list
      refreshData();
    } catch (error) {
      console.error('Error deleting business:', error);
      Alert.alert('Error', 'Failed to delete business. Please try again.');
    }
  };

  const handleEditBusiness = (business: any) => {
    setModalVisible(false);
    (navigation as any).navigate('EditBusiness', { business });
  };

  // Function to toggle business display in user app
  const handleToggleDisplayInUserApp = async (business: any) => {
    try {
      setDisplayToggleLoading(true);
      const newDisplayStatus = !business.displayInUserApp;
      
      // Update business document with display status
      await updateDoc(doc(db, 'businesses', business.id), {
        displayInUserApp: newDisplayStatus,
        displayUpdatedAt: new Date().toISOString()
      });

      // If enabling display, add to userAppBusinesses collection
      if (newDisplayStatus) {
        await setDoc(doc(db, 'userAppBusinesses', business.id), {
          businessId: business.id,
          businessName: business.businessName,
          businessType: business.selectedType,
          businessAddress: business.businessAddress,
          contactNumber: business.contactNumber,
          businessHours: business.businessHours,
          businessImages: business.businessImages || [],
          businessLocation: business.businessLocation || null,
          rating: business.rating || 4.5,
          reviews: business.reviews || '0 Reviews',
          userId: business.userId,
          status: business.status,
          addedToUserAppAt: new Date().toISOString()
        });
        
        Alert.alert(
          '✅ Business Added to User App!', 
          `${business.businessName} is now visible to users in the app and can be found on the map for navigation.`
        );
      } else {
        // Remove from userAppBusinesses collection
        await deleteDoc(doc(db, 'userAppBusinesses', business.id));
        
        Alert.alert(
          '🚫 Business Removed from User App', 
          `${business.businessName} is no longer visible to users in the app.`
        );
      }

      // Update the selected business state immediately to reflect changes in the modal
      setSelectedBusiness((prev: any) => ({
        ...prev,
        displayInUserApp: newDisplayStatus,
        displayUpdatedAt: new Date().toISOString()
      }));

      // Refresh data to show updated status
      refreshData();
    } catch (error) {
      console.error('Error toggling display status:', error);
      Alert.alert('Error', 'Failed to update business display status. Please try again.');
    } finally {
      setDisplayToggleLoading(false);
    }
  };

  const renderImageCarousel = () => {
    if (!selectedBusiness?.businessImages || selectedBusiness.businessImages.length === 0) {
      return (
        <View style={styles.noImagesContainer}>
          <Ionicons name="image-outline" size={60} color="#999" />
          <Text style={styles.noImagesText}>No business images available</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={selectedBusiness.businessImages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => index.toString()}
        onMomentumScrollEnd={(event) => {
          const slideSize = screenWidth - 40;
          const index = Math.floor(event.nativeEvent.contentOffset.x / slideSize);
          setCurrentImageIndex(index);
        }}
        renderItem={({ item, index }) => (
          <View style={styles.carouselImageContainer}>
            <LoadingImage
              source={{ uri: item }}
              style={styles.carouselImage}
              resizeMode="cover"
              placeholder="business"
            />
          </View>
        )}
      />
    );
  };

  const renderImageIndicators = () => {
    if (!selectedBusiness?.businessImages || selectedBusiness.businessImages.length <= 1) {
      return null;
    }

    return (
      <View style={styles.indicatorContainer}>
        {selectedBusiness.businessImages.map((_: string, index: number) => (
          <View
            key={index}
            style={[
              styles.indicator,
              index === currentImageIndex ? styles.activeIndicator : styles.inactiveIndicator
            ]}
          />
        ))}
      </View>
    );
  };

  const renderBusinessCard = (business: any) => (
    <View key={business.id} style={styles.businessCard}>
      <TouchableOpacity 
        style={styles.cardContent}
        onPress={() => handleBusinessCardPress(business)}
        activeOpacity={0.7}
      >
        {/* Business Image */}
        <View style={styles.imageContainer}>
          {business.businessImages && business.businessImages.length > 0 ? (
            <LoadingImage
              source={{ uri: business.businessImages[0] }}
              style={styles.businessCardImage}
              resizeMode="cover"
              placeholder="business"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="business" size={32} color="#667eea" />
            </View>
          )}
        </View>

        {/* Business Info */}
        <View style={styles.cardInfo}>
          <Text style={styles.businessName} numberOfLines={1}>{business.businessName}</Text>
          <Text style={styles.businessType} numberOfLines={1}>{business.selectedType}</Text>
          
          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(business.status) }]}>
            <Text style={styles.statusText}>{getStatusText(business.status)}</Text>
          </View>
        </View>

        {/* Arrow Icon */}
        <View style={styles.arrowContainer}>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </View>
      </TouchableOpacity>

      {/* Delete Button */}
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => handleDeleteBusiness(business)}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={20} color="#F44336" />
      </TouchableOpacity>
    </View>
  );

  if (businesses.length === 0 && !loading) {
    return (
      <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView 
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFF' : '#000'} />
            </TouchableOpacity>
            <Text style={styles.title}>My Businesses</Text>
            <View style={styles.businessCount}>
              <Text style={styles.businessCountText}>0 Active</Text>
            </View>
          </View>

            <View style={styles.noBusinessContainer}>
              <Ionicons name="business-outline" size={80} color={theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.3)'} />
              <Text style={styles.noBusinessTitle}>No Active Businesses</Text>
              <Text style={styles.subtitle}>
                You don't have any active or pending businesses. Register your business to get started.
              </Text>
              <TouchableOpacity style={styles.registerButton}>
                <Text style={styles.registerButtonText}>Register Business</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFF' : '#000'} />
            </TouchableOpacity>
            <Text style={styles.title}>My Businesses</Text>
            <View style={styles.businessCount}>
              <Text style={styles.businessCountText}>{businesses.length} Active</Text>
            </View>
          </View>

          {/* Summary Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{businesses.filter(b => b.status === 'approved').length}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{businesses.filter(b => b.status === 'pending').length}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{businesses.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>

          {/* Business Cards */}
          {businesses.map((business) => renderBusinessCard(business))}
        </ScrollView>

        {/* Business Details Modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeModal}
        >
          <SafeAreaView style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedBusiness?.businessName}</Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Action Buttons - Moved to Top */}
              <View style={styles.topButtonContainer}>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => handleEditBusiness(selectedBusiness)}
                >
                  <Ionicons name="create-outline" size={20} color="#667eea" />
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                </TouchableOpacity>

                {selectedBusiness?.status === 'approved' && (
                  <TouchableOpacity 
                    style={[
                      styles.displayButton, 
                      selectedBusiness?.displayInUserApp && styles.displayButtonHide,
                      displayToggleLoading && styles.displayButtonDisabled
                    ]} 
                    onPress={() => handleToggleDisplayInUserApp(selectedBusiness)}
                    disabled={displayToggleLoading}
                  >
                    {displayToggleLoading ? (
                      <>
                        <ActivityIndicator size="small" color={selectedBusiness?.displayInUserApp ? "#F44336" : "#4CAF50"} />
                        <Text style={[
                          styles.displayButtonText,
                          selectedBusiness?.displayInUserApp && styles.displayButtonTextHide
                        ]}>
                          {selectedBusiness?.displayInUserApp ? 'Hiding...' : 'Adding...'}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons 
                          name={selectedBusiness?.displayInUserApp ? "eye-off-outline" : "eye-outline"} 
                          size={20} 
                          color={selectedBusiness?.displayInUserApp ? "#F44336" : "#4CAF50"}
                        />
                        <Text style={[
                          styles.displayButtonText,
                          selectedBusiness?.displayInUserApp && styles.displayButtonTextHide
                        ]}>
                          {selectedBusiness?.displayInUserApp ? 'Hide from User App' : 'Display in User App'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Business Images Carousel */}
              <View style={styles.carouselContainer}>
                {renderImageCarousel()}
                {renderImageIndicators()}
              </View>

              {/* Business Details */}
              <View style={styles.modalDetailsContainer}>
                {/* Basic Info */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Business Information</Text>
                  
                  <View style={styles.modalDetailRow}>
                    <Ionicons name="business" size={20} color="#667eea" />
                    <View style={styles.modalDetailTextContainer}>
                      <Text style={styles.modalDetailLabel}>Business Type</Text>
                      <Text style={styles.modalDetailValue}>{selectedBusiness?.selectedType}</Text>
                    </View>
                  </View>

                  <View style={styles.modalDetailRow}>
                    <Ionicons name="time" size={20} color="#667eea" />
                    <View style={styles.modalDetailTextContainer}>
                      <Text style={styles.modalDetailLabel}>Business Hours</Text>
                      <Text style={styles.modalDetailValue}>{selectedBusiness?.businessHours}</Text>
                    </View>
                  </View>

                  <View style={styles.modalDetailRow}>
                    <Ionicons name="call" size={20} color="#667eea" />
                    <View style={styles.modalDetailTextContainer}>
                      <Text style={styles.modalDetailLabel}>Contact Number</Text>
                      <Text style={styles.modalDetailValue}>{selectedBusiness?.contactNumber}</Text>
                    </View>
                  </View>

                  {selectedBusiness?.optionalContactNumber && (
                    <View style={styles.modalDetailRow}>
                      <Ionicons name="call-outline" size={20} color="#667eea" />
                      <View style={styles.modalDetailTextContainer}>
                        <Text style={styles.modalDetailLabel}>Alternative Contact</Text>
                        <Text style={styles.modalDetailValue}>{selectedBusiness?.optionalContactNumber}</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.modalDetailRow}>
                    <Ionicons name="location" size={20} color="#667eea" />
                    <View style={styles.modalDetailTextContainer}>
                      <Text style={styles.modalDetailLabel}>Address</Text>
                      <Text style={styles.modalDetailValue}>{selectedBusiness?.businessAddress}</Text>
                    </View>
                  </View>
                </View>

                {/* Registration Info */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Registration Information</Text>
                  
                  <View style={styles.modalDetailRow}>
                    <Ionicons name="calendar" size={20} color="#667eea" />
                    <View style={styles.modalDetailTextContainer}>
                      <Text style={styles.modalDetailLabel}>Registration Date</Text>
                      <Text style={styles.modalDetailValue}>
                        {selectedBusiness ? new Date(selectedBusiness.registrationDate).toLocaleDateString() : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalDetailRow}>
                    <Ionicons name="checkmark-circle" size={20} color={selectedBusiness ? getStatusColor(selectedBusiness.status) : '#999'} />
                    <View style={styles.modalDetailTextContainer}>
                      <Text style={styles.modalDetailLabel}>Status</Text>
                      <Text style={[styles.modalDetailValue, { color: selectedBusiness ? getStatusColor(selectedBusiness.status) : '#999' }]}>
                        {selectedBusiness ? getStatusText(selectedBusiness.status) : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
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
  content: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#000',
    fontWeight: '600',
  },
  noBusinessContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  businessCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    flex: 1,
  },
  imageContainer: {
    marginRight: 15,
  },
  businessCardImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginRight: 10,
  },
  arrowContainer: {
    padding: 5,
  },
  deleteButton: {
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#f0f0f0',
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  businessInfo: {
    marginLeft: 15,
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  businessType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  detailsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  registrationInfo: {
    marginBottom: 20,
  },
  registrationText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  statusMessageText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  registerButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 20,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  businessCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  businessCountText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  imagesSection: {
    marginBottom: 15,
  },
  imagesScroll: {
    marginTop: 10,
  },
  businessImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  moreImagesIndicator: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderWidth: 2,
    borderColor: '#667eea',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  noBusinessTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  modalContent: {
    flex: 1,
  },
  carouselContainer: {
    height: 250,
    backgroundColor: '#f8f9fa',
  },
  carouselImageContainer: {
    width: screenWidth - 40,
    height: 200,
    marginHorizontal: 20,
    marginTop: 25,
    borderRadius: 15,
    overflow: 'hidden',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  noImagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noImagesText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeIndicator: {
    backgroundColor: '#667eea',
  },
  inactiveIndicator: {
    backgroundColor: '#ddd',
  },
  modalDetailsContainer: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 30,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  modalDetailTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  modalDetailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  modalDetailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  topButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    gap: 10,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  editButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  displayButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  displayButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  displayButtonHide: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderColor: '#F44336',
  },
  displayButtonTextHide: {
    color: '#F44336',
  },
  displayButtonDisabled: {
    opacity: 0.7,
  },
});

export default MyBusinessScreen; 