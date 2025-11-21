import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ImageBackground,
  Alert,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, query, onSnapshot, doc, updateDoc, arrayRemove, getDoc, where } from 'firebase/firestore';
import LoadingImage from '../../components/LoadingImage';
import { useResponsive } from '../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../components';

interface SavedItem {
  id: string;
  type: string;
  name: string;
  location: string;
  rating: number;
  image: string;
}

interface Post {
  id: string;
  businessId: string;
  businessName: string;
  businessImage?: string;
  content: string;
  imageUrl?: string;
  createdAt: any;
  likes: string[];
  comments: any[];
  savedBy: string[];
  ownerId: string;
}

const savedItems: SavedItem[] = [
  {
    id: '1',
    type: 'place',
    name: 'Sti coffee',
    location: 'Locsin Street, Bacolod, Western Visayas, Philippines',
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1593083868846-50d09a545bee?q=80&w=2574&auto=format&fit=crop',
  },
];

const SavedScreen = () => {
  const [activeTab, setActiveTab] = useState('Places');
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedBusinesses, setSavedBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState('');
  const { theme, user } = useAuth();
  
  // Get responsive values
  const responsive = useResponsive();
  const { spacing, fontSizes, iconSizes, borderRadius: borderRadiusValues, getResponsiveWidth, getResponsiveHeight, dimensions, responsiveHeight, responsiveWidth, responsiveFontSize } = responsive;
  
  // Safety check - ensure spacing exists
  if (!spacing || !fontSizes || !iconSizes) {
    console.error('useResponsive hook did not return required values');
  }
  
  const isSmallScreen = dimensions?.width < 360;
  const isSmallDevice = dimensions?.isSmallDevice;
  const minTouchTarget = 44;
  
  // Calculate header padding with fallback
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const headerPaddingTop = Platform.OS === 'ios' 
    ? (spacing?.md || 12) + (spacing?.md || 12) + (isSmallDevice ? (spacing?.xs || 4) : (spacing?.sm || 8))
    : statusBarHeight + (spacing?.sm || 8);
  
  // Calculate total header height: paddingTop + searchBar + searchBar marginTop + tabs + tab margins + paddingBottom
  const searchBarHeight = minTouchTarget;
  const searchBarMarginTop = spacing?.sm || 8;
  const tabHeight = minTouchTarget;
  const tabMarginVertical = (spacing?.sm || 8) * 2; // marginVertical applies to both top and bottom
  const headerPaddingBottom = spacing?.md || 12;
  const headerTotalHeight = headerPaddingTop + searchBarMarginTop + searchBarHeight + tabMarginVertical + tabHeight + headerPaddingBottom;

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  // Real-time listener for saved posts and businesses
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    if (activeTab === 'Posts') {
      const postsQuery = query(collection(db, 'posts'));
      unsubscribe = onSnapshot(postsQuery, (snapshot) => {
        const allPosts: Post[] = [];
        snapshot.forEach(doc => {
          const postData = { id: doc.id, ...doc.data() } as Post;
          // Only include posts that are saved by current user
          if (postData.savedBy && postData.savedBy.includes(user.uid)) {
            allPosts.push(postData);
          }
        });
        setSavedPosts(allPosts);
        setLoading(false);
      });
    } else if (activeTab === 'Places') {
      const businessQuery = query(
        collection(db, 'businesses'),
        where('savedBy', 'array-contains', user.uid)
      );
      unsubscribe = onSnapshot(businessQuery, (snapshot) => {
        const businesses: any[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          businesses.push({
            id: doc.id,
            type: 'place',
            name: data.businessName,
            location: data.businessAddress,
            rating: data.rating || data.averageRating || 4.5,
            image: data.businessImages && data.businessImages.length > 0 
              ? data.businessImages[0] 
              : 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2487&auto=format&fit=crop',
            businessType: data.businessType,
            contactNumber: data.contactNumber,
            businessHours: data.businessHours,
          });
        });
        setSavedBusinesses(businesses);
        setLoading(false);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, activeTab]);

  const handleUnsavePost = async (postId: string) => {
    if (!user?.uid) return;
    
    Alert.alert(
      'Unsave Post',
      'Are you sure you want to remove this post from your saved items?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsave',
          style: 'destructive',
          onPress: async () => {
            try {
              const postRef = doc(db, 'posts', postId);
              await updateDoc(postRef, {
                savedBy: arrayRemove(user.uid)
              });
            } catch (error) {
              console.error('Error unsaving post:', error);
              Alert.alert('Error', 'Failed to unsave post');
            }
          }
        }
      ]
    );
  };

  const handleUnsaveBusiness = async (businessId: string) => {
    if (!user?.uid) return;
    
    Alert.alert(
      'Unsave Place',
      'Are you sure you want to remove this place from your saved items?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsave',
          style: 'destructive',
          onPress: async () => {
            try {
              const businessRef = doc(db, 'businesses', businessId);
              await updateDoc(businessRef, {
                savedBy: arrayRemove(user.uid)
              });
            } catch (error) {
              console.error('Error unsaving business:', error);
              Alert.alert('Error', 'Failed to unsave place');
            }
          }
        }
      ]
    );
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d`;
    return date.toLocaleDateString();
  };

  // Create responsive styles using useMemo - MUST be before return statement
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
    },
    headerFixed: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingTop: headerPaddingTop,
      paddingBottom: spacing?.md || 12,
      borderBottomLeftRadius: borderRadiusValues?.xl || 20,
      borderBottomRightRadius: borderRadiusValues?.xl || 20,
      zIndex: 10,
      borderWidth: 1,
      borderColor: theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
      borderTopWidth: 0,
      backgroundColor: theme === 'light' ? '#F5F5F5' : '#232526',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderRadius: borderRadiusValues?.md || 8,
      paddingHorizontal: spacing?.md || 12,
      marginHorizontal: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      marginTop: spacing?.sm || 8,
      minHeight: minTouchTarget,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
    },
    searchInput: {
      flex: 1,
      minHeight: minTouchTarget,
      fontSize: fontSizes?.md || 14,
      marginLeft: spacing?.sm || 8,
      color: '#333',
    },
    tabContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginVertical: spacing?.sm || 8,
      borderRadius: borderRadiusValues?.md || 8,
      marginHorizontal: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      padding: spacing?.xs || 4,
      gap: spacing?.xs || 4,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing?.sm || 8,
      borderRadius: borderRadiusValues?.sm || 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
      minHeight: minTouchTarget,
    },
    activeTab: {
      backgroundColor: 'rgba(255,255,255,0.9)',
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 5,
    },
    tabText: {
      fontSize: fontSizes?.md || 14,
      fontWeight: '600',
      color: '#666',
    },
    activeTabText: {
      color: '#667eea',
    },
    listContainer: {
      paddingHorizontal: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      paddingBottom: spacing?.lg || 16,
      paddingTop: headerTotalHeight + (spacing?.sm || 8), // Add small spacing after header
    },
    card: {
      marginBottom: spacing?.md || 12,
      borderRadius: borderRadiusValues?.lg || 12,
      overflow: 'hidden',
      elevation: 3,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    cardImage: {
      width: '100%',
      height: responsiveHeight?.(20) || 200,
    },
    cardOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      justifyContent: 'space-between',
      padding: spacing?.md || 12,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rating: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingHorizontal: spacing?.sm || 8,
      paddingVertical: spacing?.xs || 4,
      borderRadius: borderRadiusValues?.md || 8,
      minHeight: minTouchTarget,
      justifyContent: 'center',
    },
    ratingText: {
      color: '#fff',
      fontSize: fontSizes?.sm || 12,
      fontWeight: '600',
      marginLeft: spacing?.xs || 4,
    },
    bookmark: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      padding: spacing?.sm || 8,
      borderRadius: borderRadiusValues?.xl || 16,
      width: minTouchTarget,
      height: minTouchTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardFooter: {
      alignItems: 'flex-start',
    },
    cardTitle: {
      color: '#fff',
      fontSize: fontSizes?.lg || 16,
      fontWeight: 'bold',
      marginBottom: spacing?.xs || 4,
    },
    cardLocation: {
      color: '#fff',
      fontSize: fontSizes?.xs || 10,
      opacity: 0.9,
    },
    cardBusinessType: {
      color: '#FFD700',
      fontSize: fontSizes?.xs || 10,
      fontWeight: '600',
      marginTop: spacing?.xs || 4,
    },
    postCard: {
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues?.lg || 12,
      padding: spacing?.md || 12,
      marginBottom: spacing?.md || 12,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 3,
    },
    postHeader: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      marginBottom: spacing?.sm || 8 
    },
    avatarContainer: {
      marginRight: spacing?.sm || 8,
    },
    avatar: {
      width: Math.max(36, Math.min((dimensions?.width || 375) * 0.1, 48)),
      height: Math.max(36, Math.min((dimensions?.width || 375) * 0.1, 48)),
      borderRadius: Math.max(18, Math.min((dimensions?.width || 375) * 0.05, 24)),
    },
    avatarPlaceholder: {
      width: Math.max(36, Math.min((dimensions?.width || 375) * 0.1, 48)),
      height: Math.max(36, Math.min((dimensions?.width || 375) * 0.1, 48)),
      borderRadius: Math.max(18, Math.min((dimensions?.width || 375) * 0.05, 24)),
      backgroundColor: '#f0f0f0',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerText: {
      flex: 1,
    },
    businessName: { 
      fontSize: fontSizes?.md || 14, 
      fontWeight: 'bold', 
      color: '#333' 
    },
    postTime: { 
      fontSize: fontSizes?.xs || 10, 
      color: '#888', 
      marginTop: (spacing?.xs || 4) / 2 
    },
    postContent: { 
      fontSize: fontSizes?.sm || 12, 
      color: '#333', 
      lineHeight: (fontSizes?.sm || 12) * 1.5,
      marginBottom: spacing?.sm || 8
    },
    imageWrapper: {
      marginBottom: spacing?.sm || 8,
      borderRadius: borderRadiusValues?.md || 8,
      overflow: 'hidden',
      backgroundColor: '#f8f9fa',
    },
    postImage: {
      width: '100%',
      height: Math.max(180, Math.min((dimensions?.height || 667) * 0.25, 300)),
      borderRadius: borderRadiusValues?.md || 8,
    },
    invalidImageContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f8f9fa',
      height: Math.max(180, Math.min((dimensions?.height || 667) * 0.25, 300)),
    },
    invalidImageText: {
      fontSize: fontSizes?.sm || 12,
      color: '#999',
      marginTop: spacing?.sm || 8,
    },
    postActions: { 
      flexDirection: 'row', 
      alignItems: 'center',
      paddingTop: spacing?.sm || 8,
      borderTopWidth: 1,
      borderTopColor: '#f0f0f0',
    },
    actionInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: spacing?.md || 12,
      minHeight: minTouchTarget,
      justifyContent: 'center',
    },
    actionCount: { 
      fontSize: fontSizes?.sm || 12, 
      color: '#888', 
      marginLeft: spacing?.xs || 4 
    },
    viewCommentsText: {
      fontSize: fontSizes?.sm || 12,
      color: '#667eea',
      fontWeight: '500',
      minHeight: minTouchTarget,
      textAlignVertical: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: responsiveHeight?.(20) || 200,
    },
    loadingText: {
      color: '#000',
      fontSize: fontSizes?.md || 14,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: responsiveHeight?.(15) || 150,
    },
    emptyText: {
      color: '#000',
      fontSize: fontSizes?.lg || 16,
      fontWeight: 'bold',
      marginTop: spacing?.md || 12,
      textAlign: 'center',
    },
    emptySubtext: {
      color: '#666',
      fontSize: fontSizes?.sm || 12,
      marginTop: spacing?.sm || 8,
      textAlign: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    commentModal: {
      backgroundColor: '#fff',
      borderTopLeftRadius: borderRadiusValues?.xl || 20,
      borderTopRightRadius: borderRadiusValues?.xl || 20,
      maxHeight: '80%',
      paddingBottom: spacing?.xl || 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing?.md || 12,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    modalTitle: {
      fontSize: fontSizes?.lg || 16,
      fontWeight: 'bold',
      color: '#333',
    },
    commentsList: {
      maxHeight: responsiveHeight?.(40) || 400,
      paddingHorizontal: spacing?.md || 12,
    },
    commentItem: {
      paddingVertical: spacing?.sm || 8,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    ownCommentItem: {
      backgroundColor: '#f8f9ff',
      borderLeftWidth: 3,
      borderLeftColor: '#667eea',
      paddingLeft: spacing?.md || 12,
    },
    authorCommentItem: {
      backgroundColor: '#fff8f0',
      borderLeftWidth: 3,
      borderLeftColor: '#ff9800',
      paddingLeft: spacing?.md || 12,
    },
    commentUser: {
      fontSize: fontSizes?.sm || 12,
      fontWeight: 'bold',
      color: '#333',
      marginBottom: spacing?.xs || 4,
    },
    ownCommentUser: {
      color: '#667eea',
      fontWeight: '700',
    },
    authorCommentUser: {
      color: '#ff9800',
      fontWeight: '700',
    },
    commentText: {
      fontSize: fontSizes?.sm || 12,
      color: '#555',
      lineHeight: (fontSizes?.sm || 12) * 1.5,
      marginBottom: spacing?.xs || 4,
    },
    ownCommentText: {
      color: '#444',
      fontWeight: '500',
    },
    authorCommentText: {
      color: '#444',
      fontWeight: '500',
    },
    commentTime: {
      fontSize: fontSizes?.xs || 10,
      color: '#888',
    },
    noCommentsText: {
      textAlign: 'center',
      color: '#888',
      fontStyle: 'italic',
      paddingVertical: spacing?.lg || 16,
      fontSize: fontSizes?.sm || 12,
    },
  }), [spacing, fontSizes, iconSizes, borderRadiusValues, dimensions, isSmallScreen, isSmallDevice, minTouchTarget, headerPaddingTop, headerTotalHeight, responsiveHeight, theme]);

  const renderPlace = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card}>
      <ImageBackground source={{ uri: item.image }} style={styles.cardImage} imageStyle={{ borderRadius: borderRadiusValues.lg }} resizeMode="cover">
        <View style={styles.cardOverlay}>
          <View style={styles.cardHeader}>
            <View style={styles.rating}>
              <Ionicons name="star" size={iconSizes.sm} color="#FFD700" />
              <ResponsiveText size="sm" weight="600" color="#fff" style={styles.ratingText}>{item.rating}</ResponsiveText>
            </View>
            <TouchableOpacity style={styles.bookmark} onPress={() => handleUnsaveBusiness(item.id)}>
              <Ionicons name="bookmark" size={iconSizes.md} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.cardFooter}>
            <ResponsiveText size="lg" weight="bold" color="#fff" style={styles.cardTitle}>{item.name}</ResponsiveText>
            <ResponsiveText size="xs" color="#fff" style={[styles.cardLocation, { opacity: 0.9 }]}>{item.location}</ResponsiveText>
            {item.businessType && (
              <ResponsiveText size="xs" weight="600" color="#FFD700" style={styles.cardBusinessType}>{item.businessType}</ResponsiveText>
            )}
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );

  const renderPost = ({ item }: { item: Post }) => (
    <ResponsiveView style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.avatarContainer}>
          {item.businessImage && item.businessImage.trim() !== '' && item.businessImage.startsWith('http') ? (
            <LoadingImage source={{ uri: item.businessImage }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="storefront" size={iconSizes.sm} color="#667eea" />
            </View>
          )}
        </View>
        <View style={styles.headerText}>
          <ResponsiveText size="md" weight="bold" color="#333" style={styles.businessName}>{item.businessName}</ResponsiveText>
          <ResponsiveText size="xs" color="#888" style={styles.postTime}>{formatTime(item.createdAt)}</ResponsiveText>
        </View>
        <TouchableOpacity onPress={() => handleUnsavePost(item.id)} style={{ minWidth: minTouchTarget, minHeight: minTouchTarget, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="bookmark" size={iconSizes.md} color="#667eea" />
        </TouchableOpacity>
      </View>
      
      <ResponsiveText size="sm" color="#333" style={styles.postContent}>{item.content}</ResponsiveText>
      
      {item.imageUrl && item.imageUrl.trim() !== '' && (
        <ResponsiveView style={styles.imageWrapper}>
          {item.imageUrl.startsWith('http') ? (
            <LoadingImage 
              source={{ uri: item.imageUrl }} 
              style={styles.postImage} 
              resizeMode="contain"
              placeholder="image"
            />
          ) : (
            <View style={[styles.postImage, styles.invalidImageContainer]}>
              <Ionicons name="image-outline" size={iconSizes.xl} color="#999" />
              <ResponsiveText size="sm" color="#999" style={styles.invalidImageText}>Invalid image URL</ResponsiveText>
            </View>
          )}
        </ResponsiveView>
      )}
      
      <View style={styles.postActions}>
        <View style={styles.actionInfo}>
          <Ionicons name="heart" size={iconSizes.sm} color="#e91e63" />
          <ResponsiveText size="sm" color="#888" style={styles.actionCount}>{item.likes.length}</ResponsiveText>
        </View>
        <View style={styles.actionInfo}>
          <Ionicons name="chatbubble" size={iconSizes.sm} color="#667eea" />
          <ResponsiveText size="sm" color="#888" style={styles.actionCount}>{item.comments.length}</ResponsiveText>
        </View>
        <TouchableOpacity 
          onPress={() => {
            setSelectedPost(item);
            setCommentModalVisible(true);
          }}
        >
          <ResponsiveText size="sm" weight="500" color="#667eea" style={styles.viewCommentsText}>View Comments</ResponsiveText>
        </TouchableOpacity>
      </View>
    </ResponsiveView>
  );

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={{flex: 1}}>
    <SafeAreaView style={styles.container}>
      <View style={styles.headerFixed}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={iconSizes.md} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'Posts' ? 'Search saved posts' : 'Search saved places'}
            placeholderTextColor="#888"
          />
          <TouchableOpacity style={{ minWidth: minTouchTarget, minHeight: minTouchTarget, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="options-outline" size={iconSizes.md} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Places' && styles.activeTab]}
            onPress={() => setActiveTab('Places')}
          >
            <ResponsiveText size="md" weight="600" style={[styles.tabText, activeTab === 'Places' && styles.activeTabText]}>
              Places
            </ResponsiveText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Posts' && styles.activeTab]}
            onPress={() => setActiveTab('Posts')}
          >
            <ResponsiveText size="md" weight="600" style={[styles.tabText, activeTab === 'Posts' && styles.activeTabText]}>
              Posts
            </ResponsiveText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {activeTab === 'Posts' ? (
        loading ? (
          <View style={styles.loadingContainer}>
            <ResponsiveText size="md" color="#000" style={styles.loadingText}>Loading saved posts...</ResponsiveText>
          </View>
        ) : (
          <FlatList
            data={savedPosts}
            renderItem={renderPost}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="bookmark-outline" size={iconSizes.xxxxl} color="#ccc" />
                <ResponsiveText size="lg" weight="bold" color="#000" style={styles.emptyText}>No saved posts</ResponsiveText>
                <ResponsiveText size="sm" color="#666" style={styles.emptySubtext}>Posts you save will appear here</ResponsiveText>
              </View>
            }
          />
        )
      ) : (
        loading ? (
          <View style={styles.loadingContainer}>
            <ResponsiveText size="md" color="#000" style={styles.loadingText}>Loading saved places...</ResponsiveText>
          </View>
        ) : (
          <FlatList
            data={savedBusinesses}
            renderItem={renderPlace}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={iconSizes.xxxxl} color="#ccc" />
                <ResponsiveText size="lg" weight="bold" color="#000" style={styles.emptyText}>No saved places</ResponsiveText>
                <ResponsiveText size="sm" color="#666" style={styles.emptySubtext}>Places you save will appear here</ResponsiveText>
              </View>
            }
          />
        )
      )}

      {/* Comment Modal */}
      <Modal
        visible={commentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.commentModal}>
            <View style={styles.modalHeader}>
              <ResponsiveText size="lg" weight="bold" color="#333" style={styles.modalTitle}>Comments</ResponsiveText>
              <TouchableOpacity onPress={() => setCommentModalVisible(false)} style={{ minWidth: minTouchTarget, minHeight: minTouchTarget, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="close" size={iconSizes.md} color="#333" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={selectedPost?.comments || []}
              keyExtractor={item => item.id}
              style={styles.commentsList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isOwnComment = item.userId === user?.uid;
                const isAuthorComment = item.userId === selectedPost?.ownerId;
                
                // Determine display name
                let displayName = item.userName;
                if (isOwnComment) {
                  displayName = 'You';
                } else if (isAuthorComment) {
                  displayName = 'Author';
                }
                
                return (
                  <View style={[
                    styles.commentItem,
                    isOwnComment && styles.ownCommentItem,
                    isAuthorComment && !isOwnComment && styles.authorCommentItem
                  ]}>
                    <ResponsiveText 
                      size="sm" 
                      weight={isOwnComment || isAuthorComment ? '700' : 'bold'} 
                      color={isOwnComment ? '#667eea' : (isAuthorComment ? '#ff9800' : '#333')}
                      style={[
                        styles.commentUser,
                        isOwnComment && styles.ownCommentUser,
                        isAuthorComment && !isOwnComment && styles.authorCommentUser
                      ]}
                    >
                      {displayName}
                    </ResponsiveText>
                    <ResponsiveText 
                      size="sm" 
                      weight={isOwnComment || isAuthorComment ? '500' : 'normal'} 
                      color="#555"
                      style={[
                        styles.commentText,
                        isOwnComment && styles.ownCommentText,
                        isAuthorComment && !isOwnComment && styles.authorCommentText
                      ]}
                    >
                      {item.text}
                    </ResponsiveText>
                    <ResponsiveText size="xs" color="#888" style={styles.commentTime}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </ResponsiveText>
                  </View>
                );
              }}
              ListEmptyComponent={
                <ResponsiveText size="sm" color="#888" style={styles.noCommentsText}>No comments yet</ResponsiveText>
              }
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
    </LinearGradient>
  );
};

export default SavedScreen; 