import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ImageBackground,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, onSnapshot, orderBy } from 'firebase/firestore';
import { User } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  userType: 'user' | 'business' | null;
  theme?: 'light' | 'dark';
  // ... other properties not needed for this component
}

interface Business {
  id: string;
  businessName: string;
  selectedType: string;
  businessType: string;
  status: string;
}

interface Promotion {
  id: string;
  title: string;
  description: string;
  discount: string;
  endDate: string;
  businessType: string;
  businessName: string;
  businessId: string;
  image: string;
  createdAt: string;
  userId: string;
  status: string;
  displayInUserApp: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface BusinessImages {
  default: string;
  [key: string]: string;
}

interface PromoImages {
  discount: {
    high: string;
    medium: string;
    low: string;
  };
  'Coffee Shop': BusinessImages;
  'Restaurant': BusinessImages;
  'Bakery': BusinessImages;
  default: string;
}

const defaultImages: { [key: string]: string } = {
  'Coffee Shop': 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=2340&auto=format&fit=crop',
  'Restaurant': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=2342&auto=format&fit=crop',
  'Bakery': 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?q=80&w=2340&auto=format&fit=crop',
  'Retail Store': 'https://images.unsplash.com/photo-1560472355-536de3962603?q=80&w=2340&auto=format&fit=crop',
  'Service Center': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2340&auto=format&fit=crop',
  'Tourist Spot': 'https://images.unsplash.com/photo-1593083868846-50d09a545bee?q=80&w=2574&auto=format&fit=crop',
  'Entertainment': 'https://images.unsplash.com/photo-1551024506-0bccd828d307?q=80&w=2264&auto=format&fit=crop',
  'default': 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=2340&auto=format&fit=crop',
};

const discountImages: { [key: string]: string } = {
  'high': 'https://images.unsplash.com/photo-1626266061368-46a8632bac03?q=80&w=2340&auto=format&fit=crop',
  'medium': 'https://images.unsplash.com/photo-1628527304948-06157ee3c8a6?q=80&w=2340&auto=format&fit=crop',
  'low': 'https://images.unsplash.com/photo-1624687943971-e86af76d57de?q=80&w=2340&auto=format&fit=crop',
};

const categoryImages: { [key: string]: string } = {
  'food': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2340&auto=format&fit=crop',
  'drink': 'https://images.unsplash.com/photo-1511920170033-f8396924c348?q=80&w=2340&auto=format&fit=crop',
  'dessert': 'https://images.unsplash.com/photo-1587314168485-3236d6710814?q=80&w=2340&auto=format&fit=crop',
  'buffet': 'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?q=80&w=2340&auto=format&fit=crop',
  'special': 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=2340&auto=format&fit=crop',
};

const getPromoImage = (businessType: string, title: string, description: string): string => {
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();

  // Check for discount percentage
  const discountMatch = title.match(/(\d+)%/);
  if (discountMatch) {
    const percentage = parseInt(discountMatch[1]);
    if (percentage >= 50) return discountImages.high;
    if (percentage >= 30) return discountImages.medium;
    return discountImages.low;
  }

  // Check for category-specific keywords
  const keywords = {
    food: ['food', 'meal', 'dish', 'cuisine'],
    drink: ['drink', 'coffee', 'tea', 'beverage', 'latte'],
    dessert: ['dessert', 'cake', 'pastry', 'sweet'],
    buffet: ['buffet', 'all you can eat', 'unlimited'],
    special: ['special', 'chef', 'signature', 'premium'],
  };

  // Check if any keywords match
  for (const [category, words] of Object.entries(keywords)) {
    if (words.some(word => lowerTitle.includes(word) || lowerDesc.includes(word))) {
      return categoryImages[category];
    }
  }

  // Return default image for the business type
  return defaultImages[businessType] || defaultImages.default;
};

const PromotionsScreen = () => {
  const navigation = useNavigation();
  const { user, theme } = useAuth() as AuthContextType;

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [userBusinesses, setUserBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discount: '',
    endDate: '',
    businessType: '',
    businessId: '',
    businessName: '',
  });
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const futureDates = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 365 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i + 1);
      return d.toISOString().split('T')[0];
    });
  }, []);

  useEffect(() => {
    if (user?.uid) {
      loadUserBusinesses();
      const unsubscribe = loadPromotions();
      return unsubscribe;
    }
  }, [user]);

  const loadUserBusinesses = async () => {
    if (!user?.uid) return;
    
    try {
      const q = query(
        collection(db, 'businesses'),
        where('userId', '==', user.uid),
        where('status', '==', 'approved')
      );
      const querySnapshot = await getDocs(q);
      
      const businesses = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Business[];

      setUserBusinesses(businesses);
      
      // If there's only one business, auto-select it
      if (businesses.length === 1) {
        const business = businesses[0];
        setSelectedBusiness(business);
        setFormData(prev => ({
          ...prev,
          businessId: business.id,
          businessName: business.businessName,
          businessType: business.selectedType || business.businessType || '',
        }));
      }
    } catch (error) {
      console.error('Error loading user businesses:', error);
    }
  };

  const loadPromotions = () => {
    if (!user?.uid) return () => {};

    try {
      // Try complex query first, fallback to simple query if index doesn't exist
      let q = query(
        collection(db, 'promotions'),
        where('userId', '==', user.uid),
        where('displayInUserApp', '==', true),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const promoList: any[] = [];
        snapshot.forEach((doc) => {
          promoList.push({
            id: doc.id,
            ...doc.data(),
          });
        });
        
        console.log(`📋 PromotionsScreen: Loaded ${promoList.length} promotions for user ${user.uid}`);
        promoList.forEach(promo => {
          console.log('📄 PromotionsScreen: Promotion:', {
            id: promo.id,
            title: promo.title,
            displayInUserApp: promo.displayInUserApp,
            userId: promo.userId
          });
        });
        
        // Sort by creation date (newest first)
        promoList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setPromotions(promoList);
        setLoading(false);
      }, (error) => {
        console.error('❌ PromotionsScreen: Error loading promotions:', error);
        setLoading(false);
        
        // If it's an index error, try a simpler query
        if ((error as any)?.code === 'failed-precondition') {
          console.log('⚠️ PromotionsScreen: Trying simpler query without multiple where clauses...');
          
          // Fallback to simpler query
          const simpleQ = query(
            collection(db, 'promotions'),
            where('userId', '==', user.uid)
          );
          
          const simpleUnsubscribe = onSnapshot(simpleQ, (snapshot) => {
            const promoList: any[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              // Filter manually for displayInUserApp
              if (data.displayInUserApp === true) {
                promoList.push({
                  id: doc.id,
                  ...data,
                });
              }
            });
            
            console.log(`📋 PromotionsScreen: Simple query loaded ${promoList.length} promotions`);
            promoList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            setPromotions(promoList);
            setLoading(false);
          });
          
          return simpleUnsubscribe;
        } else {
          Alert.alert(
            'Error',
            'Failed to load promotions. Please check your internet connection and try again.'
          );
        }
      });

      return unsubscribe;
    } catch (error) {
      console.error('❌ PromotionsScreen: Error setting up promotions listener:', error);
      setLoading(false);
      return () => {};
    }
  };

  const handleCreatePromotion = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in to create promotions.');
      return;
    }

    if (!formData.title || !formData.description || !formData.discount || !formData.endDate || !formData.businessId) {
      Alert.alert('Error', 'Please fill in all required fields and select a business.');
      return;
    }

    try {
      setCreating(true);
    
      const promoImage = getPromoImage(
        formData.businessType,
        formData.title,
        formData.description
      );

      const promotionData = {
        title: formData.title,
        description: formData.description,
        discount: formData.discount,
        endDate: formData.endDate,
        businessType: formData.businessType,
        businessName: formData.businessName,
        businessId: formData.businessId,
        userId: user.uid,
        status: 'Active',
        image: promoImage,
        createdAt: new Date().toISOString(),
        displayInUserApp: true, // This is crucial for HomeScreen to find it
      };

      console.log('📝 PromotionsScreen: Creating promotion with data:', promotionData);

      await addDoc(collection(db, 'promotions'), promotionData);
      
      Alert.alert('Success', 'Promotion created successfully!');
      setModalVisible(false);
      resetForm();
    } catch (error) {
      console.error('Error creating promotion:', error);
      Alert.alert('Error', 'Failed to create promotion. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleEditPromotion = (promotion: Promotion) => {
    // For now, we'll just show an alert that editing is not implemented
    Alert.alert('Edit Promotion', 'Editing promotions will be available in a future update.');
  };

  const handleDeletePromotion = async (promotionId: string, title: string) => {
    Alert.alert(
      'Delete Promotion',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'promotions', promotionId));
              Alert.alert('Success', 'Promotion deleted successfully.');
            } catch (error) {
              console.error('Error deleting promotion:', error);
              Alert.alert('Error', 'Failed to delete promotion.');
            }
          },
        },
      ]
    );
  };

  const isPromotionExpired = (endDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const promotionEnd = new Date(endDate);
    promotionEnd.setHours(0, 0, 0, 0);
    return today > promotionEnd;
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      discount: '',
      endDate: '',
      businessType: selectedBusiness?.selectedType || selectedBusiness?.businessType || '',
      businessId: selectedBusiness?.id || '',
      businessName: selectedBusiness?.businessName || '',
    });
    setSelectedBusiness(userBusinesses.length === 1 ? userBusinesses[0] : null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  const renderPromotionCard = ({ item }: { item: Promotion }) => {
    const expired = isPromotionExpired(item.endDate);
    
    return (
      <TouchableOpacity 
        style={styles.promoCardContainer}
        onPress={() => handleEditPromotion(item)}
        disabled={expired}
      >
        <ImageBackground
          source={{ uri: item.image }}
          style={styles.promoCard}
          imageStyle={{ borderRadius: 10 }}
        >
          {expired && <View style={styles.expiredOverlay} />}
          
          <View style={[
            styles.statusBadge,
            { backgroundColor: expired ? '#FF4444' : '#4CAF50' }
          ]}>
            <Text style={styles.statusText}>
              {expired ? 'Expired' : 'Active'}
            </Text>
          </View>

          <View style={[styles.promoContent, expired && { opacity: 0.7 }]}>
            <Text style={styles.promoTitle}>{item.title}</Text>
            <Text style={styles.promoDescription} numberOfLines={2}>
              {item.description}
            </Text>
            <Text style={styles.businessName}>{item.businessName}</Text>
            <Text style={styles.promoDate}>
              {expired ? 'Expired on: ' : 'Valid until: '}
              {new Date(item.endDate).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.editButton, expired && { opacity: 0.5 }]}
              onPress={() => handleEditPromotion(item)}
              disabled={expired}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteButton, expired && styles.deleteButtonExpired]}
              onPress={() => handleDeletePromotion(item.id, item.title)}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFF' : '#000'} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme === 'dark' ? '#FFF' : '#000' }]}>Promotions & Deals</Text>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={24} color={theme === 'dark' ? '#FFF' : '#000'} />
            <Text style={[styles.createButtonText, { color: theme === 'dark' ? '#FFF' : '#000' }]}>Create</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {promotions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="pricetag-outline" size={80} color={theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.3)'} />
              <Text style={[styles.emptyText, { color: theme === 'dark' ? '#FFF' : '#000' }]}>No promotions yet</Text>
              <Text style={[styles.emptySubText, { color: theme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : '#666' }]}>Create your first promotion to attract customers!</Text>
            </View>
          ) : (
            <FlatList
              data={promotions}
              renderItem={renderPromotionCard}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.listContent}
              scrollEnabled={false}
            />
          )}
        </ScrollView>

        {/* Create Promotion Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create New Promotion</Text>
                <TouchableOpacity 
                  onPress={() => setModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.formContainer}>
                {/* Business Selection */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Select Business *</Text>
                  <TouchableOpacity
                    style={[styles.textInput, styles.dropdownButton]}
                    onPress={() => setShowBusinessDropdown(!showBusinessDropdown)}
                  >
                    <Text style={selectedBusiness ? styles.dropdownText : styles.dropdownPlaceholder}>
                      {selectedBusiness ? selectedBusiness.businessName : 'Select a business'}
                    </Text>
                    <Ionicons 
                      name={showBusinessDropdown ? "chevron-up" : "chevron-down"} 
                      size={24} 
                      color="#666" 
                    />
                  </TouchableOpacity>
                  
                  {/* Business Dropdown */}
                  {showBusinessDropdown && (
                    <View style={styles.dropdownList}>
                      {userBusinesses.map((business) => (
                        <TouchableOpacity
                          key={business.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setSelectedBusiness(business);
                            setFormData(prev => ({
                              ...prev,
                              businessId: business.id,
                              businessName: business.businessName,
                              businessType: business.selectedType || business.businessType || '',
                            }));
                            setShowBusinessDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{business.businessName}</Text>
                          <Text style={styles.dropdownItemType}>
                            {business.selectedType || business.businessType}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Business Name Display */}
                {selectedBusiness && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Business Name</Text>
                    <View style={[styles.textInput, styles.disabledInput]}>
                      <Text style={styles.businessInfoText}>{selectedBusiness.businessName}</Text>
                      <Text style={styles.businessTypeText}>
                        {selectedBusiness.selectedType || selectedBusiness.businessType}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Promotion Title *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.title}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                    placeholder="e.g., 20% OFF Coffee"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Valid Until moved before Description */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Valid Until *</Text>
                  <TouchableOpacity
                    style={[styles.textInput, styles.dateInput]}
                    onPress={() => setShowDateDropdown(prev => !prev)}
                  >
                    <Text style={formData.endDate ? styles.dateText : styles.datePlaceholder}>
                      {formData.endDate ? new Date(formData.endDate).toLocaleDateString() : 'Select date'}
                    </Text>
                    <Ionicons name={showDateDropdown ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
                  </TouchableOpacity>
                  {/* Date Dropdown List */}
                  {showDateDropdown && (
                    <View style={styles.dropdownList}>
                      <ScrollView style={{ maxHeight: 200 }}>
                        {futureDates.map(dateStr => {
                          const display = new Date(dateStr).toLocaleDateString();
                          return (
                            <TouchableOpacity
                              key={dateStr}
                              style={styles.dropdownItem}
                              onPress={() => {
                                setFormData(prev => ({ ...prev, endDate: dateStr }));
                                setShowDateDropdown(false);
                              }}
                            >
                              <Text style={styles.dropdownItemText}>{display}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Discount stays after Valid Until */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Discount/Offer *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.discount}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, discount: text }))}
                    placeholder="e.g., 20%, BOGO, FREE"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Description moved down */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description *</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={formData.description}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                    placeholder="Describe your promotion details..."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.createPromoButton}
                  onPress={handleCreatePromotion}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.createPromoButtonText}>Create Promotion</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenWidth * 0.05,
    paddingVertical: screenHeight * 0.015,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: screenWidth * 0.055,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingVertical: screenHeight * 0.01,
    paddingHorizontal: screenWidth * 0.04,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  createButtonText: {
    fontWeight: '600',
    marginLeft: 5,
    fontSize: screenWidth * 0.035,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
  },
  emptySubText: {
    fontSize: 16,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 40,
  },
  listContent: {
    padding: screenWidth * 0.05,
  },
  row: {
    justifyContent: 'space-between',
  },
  promoCardContainer: {
    width: (screenWidth - screenWidth * 0.15) / 2,
    marginBottom: screenHeight * 0.02,
  },
  promoCard: {
    width: '100%',
    height: screenHeight * 0.25,
    justifyContent: 'flex-end',
  },
  expiredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    zIndex: 1,
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    zIndex: 2,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  expiredContent: {
    opacity: 0.7,
  },
  promoContent: {
    padding: 10,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  promoDescription: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 18,
  },
  promoDate: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
    fontStyle: 'italic',
  },
  actionButtons: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    zIndex: 3,
  },
  editButton: {
    padding: 5,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  deleteButton: {
    padding: 5,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginLeft: 5,
  },
  deleteButtonExpired: {
    backgroundColor: '#FF4444',
    borderColor: '#FF8888',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: screenWidth * 0.9,
    maxHeight: screenHeight * 0.8,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  formContainer: {
    padding: 20,
    maxHeight: screenHeight * 0.5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  createPromoButton: {
    flex: 1,
    padding: 15,
    backgroundColor: '#667eea',
    borderRadius: 10,
    marginLeft: 10,
    alignItems: 'center',
  },
  createPromoButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 15,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  dropdownList: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  dropdownItemType: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  businessName: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
    marginTop: 5,
  },
  businessInfoText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  businessTypeText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  datePlaceholder: {
    fontSize: 16,
    color: '#999',
  },
});

export default PromotionsScreen; 