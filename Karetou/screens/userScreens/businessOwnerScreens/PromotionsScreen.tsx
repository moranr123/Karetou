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
import { useResponsive } from '../../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../../components';

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
  const { spacing, fontSizes, iconSizes, borderRadius, getResponsiveWidth, getResponsiveHeight, dimensions } = useResponsive();

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;
  
  const isSmallScreen = dimensions.width < 360;
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
            <ResponsiveText size="xs" weight="bold" color="#fff" style={styles.statusText}>
              {expired ? 'Expired' : 'Active'}
            </ResponsiveText>
          </View>

          <View style={[styles.promoContent, expired && { opacity: 0.7 }]}>
            <ResponsiveText size="md" weight="bold" color="#fff" style={styles.promoTitle} numberOfLines={2}>
              {item.title}
            </ResponsiveText>
            <ResponsiveText size="sm" color="#fff" style={styles.promoDescription} numberOfLines={2}>
              {item.description}
            </ResponsiveText>
            <ResponsiveText size="sm" weight="600" color="#FFD700" style={styles.businessName} numberOfLines={1}>
              {item.businessName}
            </ResponsiveText>
            <ResponsiveText size="xs" color="#fff" style={styles.promoDate}>
              {expired ? 'Expired on: ' : 'Valid until: '}
              {new Date(item.endDate).toLocaleDateString()}
            </ResponsiveText>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.editButton, expired && { opacity: 0.5 }]}
              onPress={() => handleEditPromotion(item)}
              disabled={expired}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={iconSizes.md} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteButton, expired && styles.deleteButtonExpired]}
              onPress={() => handleDeletePromotion(item.id, item.title)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={iconSizes.md} color="#fff" />
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
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={iconSizes.lg} color={theme === 'dark' ? '#FFF' : '#000'} />
          </TouchableOpacity>
          <ResponsiveText size="lg" weight="bold" color={theme === 'dark' ? '#FFF' : '#000'} style={styles.title}>
            Promotions & Deals
          </ResponsiveText>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={iconSizes.lg} color={theme === 'dark' ? '#FFF' : '#000'} />
            <ResponsiveText size="sm" weight="600" color={theme === 'dark' ? '#FFF' : '#000'} style={styles.createButtonText}>
              Create
            </ResponsiveText>
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {promotions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="pricetag-outline" size={iconSizes.xxxxl} color={theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.3)'} />
              <ResponsiveText size="xl" weight="bold" color={theme === 'dark' ? '#FFF' : '#000'} style={styles.emptyText}>
                No promotions yet
              </ResponsiveText>
              <ResponsiveText size="md" color={theme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : '#666'} style={styles.emptySubText}>
                Create your first promotion to attract customers!
              </ResponsiveText>
            </View>
          ) : (
            <FlatList
              data={promotions}
              renderItem={renderPromotionCard}
              keyExtractor={(item) => item.id}
              numColumns={dimensions.width < 400 ? 1 : 2}
              columnWrapperStyle={dimensions.width >= 400 ? styles.row : undefined}
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
                <ResponsiveText size="lg" weight="bold" color="#333" style={styles.modalTitle}>
                  Create New Promotion
                </ResponsiveText>
                <TouchableOpacity 
                  onPress={() => setModalVisible(false)}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={iconSizes.lg} color="#333" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.formContainer}>
                {/* Business Selection */}
                <View style={styles.inputGroup}>
                  <ResponsiveText size="md" weight="600" color="#333" style={styles.inputLabel}>
                    Select Business *
                  </ResponsiveText>
                  <TouchableOpacity
                    style={[styles.textInput, styles.dropdownButton]}
                    onPress={() => setShowBusinessDropdown(!showBusinessDropdown)}
                    activeOpacity={0.7}
                  >
                    <ResponsiveText 
                      size="md" 
                      weight={selectedBusiness ? "500" : "normal"}
                      color={selectedBusiness ? "#333" : "#999"}
                      style={selectedBusiness ? styles.dropdownText : styles.dropdownPlaceholder}
                      numberOfLines={1}
                    >
                      {selectedBusiness ? selectedBusiness.businessName : 'Select a business'}
                    </ResponsiveText>
                    <Ionicons 
                      name={showBusinessDropdown ? "chevron-up" : "chevron-down"} 
                      size={iconSizes.lg} 
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
                          activeOpacity={0.7}
                        >
                          <ResponsiveText size="md" weight="600" color="#333" style={styles.dropdownItemText}>
                            {business.businessName}
                          </ResponsiveText>
                          <ResponsiveText size="sm" color="#666" style={styles.dropdownItemType}>
                            {business.selectedType || business.businessType}
                          </ResponsiveText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Business Name Display */}
                {selectedBusiness && (
                  <View style={styles.inputGroup}>
                    <ResponsiveText size="md" weight="600" color="#333" style={styles.inputLabel}>
                      Business Name
                    </ResponsiveText>
                    <View style={[styles.textInput, styles.disabledInput]}>
                      <ResponsiveText size="md" weight="600" color="#333" style={styles.businessInfoText}>
                        {selectedBusiness.businessName}
                      </ResponsiveText>
                      <ResponsiveText size="sm" color="#666" style={styles.businessTypeText}>
                        {selectedBusiness.selectedType || selectedBusiness.businessType}
                      </ResponsiveText>
                    </View>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <ResponsiveText size="md" weight="600" color="#333" style={styles.inputLabel}>
                    Promotion Title *
                  </ResponsiveText>
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
                  <ResponsiveText size="md" weight="600" color="#333" style={styles.inputLabel}>
                    Valid Until *
                  </ResponsiveText>
                  <TouchableOpacity
                    style={[styles.textInput, styles.dateInput]}
                    onPress={() => setShowDateDropdown(prev => !prev)}
                    activeOpacity={0.7}
                  >
                    <ResponsiveText 
                      size="md" 
                      weight={formData.endDate ? "500" : "normal"}
                      color={formData.endDate ? "#333" : "#999"}
                      style={formData.endDate ? styles.dateText : styles.datePlaceholder}
                    >
                      {formData.endDate ? new Date(formData.endDate).toLocaleDateString() : 'Select date'}
                    </ResponsiveText>
                    <Ionicons name={showDateDropdown ? 'chevron-up' : 'chevron-down'} size={iconSizes.md} color="#666" />
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
                              activeOpacity={0.7}
                            >
                              <ResponsiveText size="md" color="#333" style={styles.dropdownItemText}>
                                {display}
                              </ResponsiveText>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Discount stays after Valid Until */}
                <View style={styles.inputGroup}>
                  <ResponsiveText size="md" weight="600" color="#333" style={styles.inputLabel}>
                    Discount/Offer *
                  </ResponsiveText>
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
                  <ResponsiveText size="md" weight="600" color="#333" style={styles.inputLabel}>
                    Description *
                  </ResponsiveText>
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
                  activeOpacity={0.7}
                >
                  <ResponsiveText size="md" weight="600" color="#666" style={styles.cancelButtonText}>
                    Cancel
                  </ResponsiveText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.createPromoButton}
                  onPress={handleCreatePromotion}
                  disabled={creating}
                  activeOpacity={0.8}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ResponsiveText size="md" weight="600" color="#fff" style={styles.createPromoButtonText}>
                      Create Promotion
                    </ResponsiveText>
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
    paddingHorizontal: '5%',
    paddingVertical: '2%',
    minHeight: 60,
  },
  backButton: {
    width: 40,
    minWidth: 40,
    height: 40,
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingVertical: '1.5%',
    paddingHorizontal: '4%',
    minHeight: 36,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  createButtonText: {
    marginLeft: 5,
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
    paddingBottom: 50,
  },
  emptyText: {
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubText: {
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 40,
  },
  listContent: {
    padding: '5%',
  },
  row: {
    justifyContent: 'space-between',
    gap: '3%',
  },
  promoCardContainer: {
    flex: 1,
    maxWidth: '48.5%',
    marginBottom: '3%',
  },
  promoCard: {
    width: '100%',
    aspectRatio: 0.75,
    minHeight: 200,
    maxHeight: 300,
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
    minHeight: 24,
    borderRadius: 15,
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
  },
  expiredContent: {
    opacity: 0.7,
  },
  promoContent: {
    padding: '3%',
  },
  promoTitle: {
    marginBottom: 5,
  },
  promoDescription: {
    lineHeight: 18,
    marginBottom: 4,
  },
  promoDate: {
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
    padding: 8,
    minWidth: 36,
    minHeight: 36,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    minWidth: 36,
    minHeight: 36,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginLeft: 5,
    justifyContent: 'center',
    alignItems: 'center',
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
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5%',
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    flex: 1,
  },
  closeButton: {
    padding: 5,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    padding: '5%',
    maxHeight: '50%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: '5%',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    minHeight: 50,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    // Styles handled by ResponsiveText
  },
  createPromoButton: {
    flex: 1,
    padding: 15,
    minHeight: 50,
    backgroundColor: '#667eea',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPromoButtonText: {
    color: '#fff',
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 15,
    minHeight: 48,
  },
  dropdownText: {
    flex: 1,
    marginRight: 8,
  },
  dropdownPlaceholder: {
    flex: 1,
    marginRight: 8,
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
    minHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownItemText: {
    // Styles handled by ResponsiveText
  },
  dropdownItemType: {
    marginTop: 4,
  },
  businessName: {
    marginTop: 5,
  },
  businessInfoText: {
    // Styles handled by ResponsiveText
  },
  businessTypeText: {
    marginTop: 4,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  dateText: {
    flex: 1,
    marginRight: 8,
  },
  datePlaceholder: {
    flex: 1,
    marginRight: 8,
  },
});

export default PromotionsScreen; 