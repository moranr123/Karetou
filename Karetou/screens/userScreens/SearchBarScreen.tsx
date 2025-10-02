import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

// Ultimate image cache with base64 storage for instant display
const base64ImageCache = new Map<string, string>();
const imageStatusCache = new Map<string, { status: 'loading' | 'loaded' | 'error', promise?: Promise<void> }>();

// Convert image to base64 for ultimate caching
const convertToBase64 = async (uri: string): Promise<string | null> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.log('Failed to convert image to base64:', error);
    return null;
  }
};

// Ultimate preloading function that stores base64 data
const preloadImage = (uri: string): Promise<void> => {
  if (base64ImageCache.has(uri)) {
    return Promise.resolve();
  }
  
  if (imageStatusCache.has(uri)) {
    const cached = imageStatusCache.get(uri)!;
    if (cached.status === 'loaded') {
      return Promise.resolve();
    } else if (cached.promise) {
      return cached.promise;
    }
  }
  
  const promise = new Promise<void>((resolve) => {
    imageStatusCache.set(uri, { status: 'loading', promise });
    
    // Try both prefetch and base64 conversion
    Promise.all([
      Image.prefetch(uri),
      convertToBase64(uri)
    ]).then(([_, base64]) => {
      if (base64) {
        base64ImageCache.set(uri, base64);
        console.log('💾 Cached image as base64:', uri.substring(uri.lastIndexOf('/') + 1));
      }
      imageStatusCache.set(uri, { status: 'loaded' });
      resolve();
    }).catch(() => {
      imageStatusCache.set(uri, { status: 'error' });
      resolve();
    });
  });
  
  return promise;
};

// Ultimate Cached Image Component that uses base64 for instant display
const CachedImage: React.FC<{
  source: { uri: string };
  style: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}> = ({ source, style, resizeMode = 'cover' }) => {
  // Initialize with smart image source - start with cached version if available
  const [imageSource, setImageSource] = useState(() => {
    const base64Data = base64ImageCache.get(source.uri);
    return base64Data ? { uri: base64Data } : source;
  });
  
  // Track if we need to show loading indicator for uncached images
  const [isLoading, setIsLoading] = useState(() => {
    const base64Data = base64ImageCache.get(source.uri);
    const cached = imageStatusCache.get(source.uri);
    return !base64Data && cached?.status !== 'loaded';
  });
  
  useEffect(() => {
    // Check if we have base64 cached version
    const base64Data = base64ImageCache.get(source.uri);
    if (base64Data) {
      console.log('🎯 Using cached base64 image for instant display');
      setImageSource({ uri: base64Data });
      setIsLoading(false);
      return;
    }
    
    // Check regular cache status
    const cached = imageStatusCache.get(source.uri);
    if (cached?.status === 'loaded') {
      setImageSource(source);
      setIsLoading(false);
      return;
    }
    
    // Only set loading to true if we need to actually load the image
    setIsLoading(true);
    
    // Preload if not cached
    preloadImage(source.uri).then(() => {
      const newBase64Data = base64ImageCache.get(source.uri);
      if (newBase64Data) {
        setImageSource({ uri: newBase64Data });
      } else {
        setImageSource(source);
      }
      setIsLoading(false);
    }).catch(() => {
      setImageSource(source);
      setIsLoading(false);
    });
  }, [source.uri]);
  
  return (
    <View style={style}>
      <Image
        source={imageSource}
        style={style}
        resizeMode={resizeMode}
        fadeDuration={0}
        onLoad={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
      />
      {isLoading && (
        <View style={[style, { position: 'absolute', backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="small" color="#667eea" />
        </View>
      )}
    </View>
  );
};

const FILTERS = ['All', 'Coffee Shop', 'Restaurant', 'Tourist Spot'];

const SearchBarScreen = () => {
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedBusinesses, setSavedBusinesses] = useState<string[]>([]);
  const navigation = useNavigation();
  const { theme, user } = useAuth();

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  // Handle saving/unsaving businesses
  const handleSaveBusiness = async (businessId: string) => {
    if (!user?.uid) return;
    
    try {
      const businessRef = doc(db, 'businesses', businessId);
      const isSaved = savedBusinesses.includes(businessId);
      
      if (isSaved) {
        // Unsave
        await updateDoc(businessRef, {
          savedBy: arrayRemove(user.uid)
        });
        setSavedBusinesses(prev => prev.filter(id => id !== businessId));
      } else {
        // Save
        await updateDoc(businessRef, {
          savedBy: arrayUnion(user.uid)
        });
        setSavedBusinesses(prev => [...prev, businessId]);
      }
    } catch (error) {
      console.error('Error toggling business save:', error);
    }
  };

  // Load saved businesses for current user
  const loadSavedBusinesses = async () => {
    if (!user?.uid) return;
    
    try {
      const q = query(
        collection(db, 'businesses'),
        where('savedBy', 'array-contains', user.uid)
      );
      const querySnapshot = await getDocs(q);
      const savedIds = querySnapshot.docs.map(doc => doc.id);
      setSavedBusinesses(savedIds);
    } catch (error) {
      console.error('Error loading saved businesses:', error);
    }
  };

  // Fetch verified/active businesses from Firebase
  useEffect(() => {
    console.log('🔄 Setting up real-time business listener for search');
    loadSavedBusinesses(); // Load saved businesses
    
    const businessQuery = query(
      collection(db, 'businesses'),
      where('status', '==', 'approved'),
      where('displayInUserApp', '==', true)
    );
    
    const unsubscribe = onSnapshot(
      businessQuery,
      (snapshot) => {
        const businessList: any[] = [];
        
        snapshot.forEach((doc) => {
          const business = doc.data();
          businessList.push({
            id: doc.id,
            ...business,
            // Format data for search display
            name: business.businessName,
            address: business.businessAddress || business.address,
            type: business.selectedType || business.businessType,
            image: business.businessImages && business.businessImages.length > 0 ? business.businessImages[0] : null,
            rating: business.averageRating || 0,
            reviews: business.totalReviews || 0,
          });
        });
        
        // Sort by name alphabetically
        businessList.sort((a, b) => a.name.localeCompare(b.name));
        
        setBusinesses(businessList);
        setLoading(false);
        
        console.log('✅ Active businesses loaded for search:', businessList.length, 'businesses');
        
        // Preload business images for better performance
        console.log('🚀 SearchBarScreen: Starting image preloading...');
        const preloadPromises: Promise<void>[] = [];
        
        businessList.forEach(business => {
          if (business.image) {
            preloadPromises.push(preloadImage(business.image));
          }
        });
        
        Promise.all(preloadPromises).then(() => {
          console.log('✅ SearchBarScreen: All business images preloaded successfully!');
        }).catch((error) => {
          console.log('⚠️ SearchBarScreen: Some images failed to preload:', error);
        });
      },
      (error) => {
        console.error('Error in business search listener:', error);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log('🧹 Cleaning up business search listener');
      unsubscribe();
    };
  }, []);

  const filteredData = businesses.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = selectedFilter === 'All' || item.type === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <LinearGradient
        colors={theme === 'light' ? lightGradient : darkGradient}
        style={styles.container}
      >
        <View style={[styles.headerFixed, { backgroundColor: 'transparent' }]}>
          <View style={styles.searchRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, {backgroundColor: 'transparent'}]}>
              <Ionicons name="arrow-back" size={24} color={theme === 'light' ? '#222' : '#fff'} />
            </TouchableOpacity>
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={20} color="#888" style={{ marginLeft: 8 }} />
              <TextInput
                style={styles.searchBar}
                placeholder="Search establishment"
                value={search}
                onChangeText={setSearch}
                placeholderTextColor="#888"
              />
              <TouchableOpacity>
                <Ionicons name="options-outline" size={22} color="#888" style={{ marginLeft: 8, marginRight: 4 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme === 'light' ? '#667eea' : '#fff'} />
          <Text style={[styles.loadingText, { color: theme === 'light' ? '#333' : '#fff' }]}>
            Loading businesses...
          </Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={theme === 'light' ? lightGradient : darkGradient}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.headerFixed, { backgroundColor: 'transparent' }]}>
        {/* Search Bar */}
        <View style={styles.searchRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, {backgroundColor: 'transparent'}]}>
            <Ionicons name="arrow-back" size={24} color={theme === 'light' ? '#222' : '#fff'} />
          </TouchableOpacity>
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={20} color="#888" style={{ marginLeft: 8 }} />
            <TextInput
              style={styles.searchBar}
              placeholder="Search establishment"
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#888"
            />
            <TouchableOpacity>
              <Ionicons name="options-outline" size={22} color="#888" style={{ marginLeft: 8, marginRight: 4 }} />
            </TouchableOpacity>
          </View>
        </View>
        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {FILTERS.map(filter => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                selectedFilter === filter && styles.filterChipActive,
              ]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilter === filter && styles.filterChipTextActive,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Results List */}
      <FlatList
        data={filteredData}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingTop: 180, paddingHorizontal: 12 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.cardImagePlaceholder}>
                {item.image ? (
                  <CachedImage source={{ uri: item.image }} style={styles.cardImage} resizeMode="cover" />
                ) : (
                  <Ionicons name="storefront" size={36} color="#bbb" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardAddress}>{item.address}</Text>
                <Text style={styles.cardType}>{item.type}</Text>
                {item.rating > 0 && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={16} color="#FFD600" />
                    <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                    <Text style={styles.reviewText}>({item.reviews} Reviews)</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={() => handleSaveBusiness(item.id)}
              >
                <Ionicons 
                  name={savedBusinesses.includes(item.id) ? "bookmark" : "bookmark-outline"} 
                  size={24} 
                  color={savedBusinesses.includes(item.id) ? "#667eea" : "#888"} 
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={64} color="#bbb" />
            <Text style={[styles.emptyText, { color: theme === 'light' ? '#666' : '#ccc' }]}>
              {search ? 'No establishments found for your search.' : 'No active establishments available.'}
            </Text>
          </View>
        }
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerFixed: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 36 : 36,
    paddingBottom: 8,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderColor: '#ccc',
    borderTopWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1976d2',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchBar: {
    flex: 1,
    fontSize: 15,
    color: '#222',
    padding: 8,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginHorizontal: 12,
    marginBottom: 2,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1976d2',
  },
  filterChipText: {
    color: '#222',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#222',
    marginBottom: 2,
  },
  cardAddress: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  cardType: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#FFD600',
    fontWeight: 'bold',
    marginLeft: 4,
    marginRight: 4,
  },
  reviewText: {
    fontSize: 12,
    color: '#aaa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 40,
  },
  saveButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export { SearchBarScreen };