import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ImageBackground,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, query, onSnapshot, doc, updateDoc, arrayRemove, getDoc, where } from 'firebase/firestore';
import LoadingImage from '../../components/LoadingImage';

const { width, height } = Dimensions.get('window');

const FONT_SCALE = Math.min(width, height) / 400;

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

  const renderPlace = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card}>
      <ImageBackground source={{ uri: item.image }} style={styles.cardImage} imageStyle={{ borderRadius: 16 }}>
        <View style={styles.cardOverlay}>
          <View style={styles.cardHeader}>
            <View style={styles.rating}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>{item.rating}</Text>
            </View>
            <TouchableOpacity style={styles.bookmark} onPress={() => handleUnsaveBusiness(item.id)}>
              <Ionicons name="bookmark" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardLocation}>{item.location}</Text>
            {item.businessType && (
              <Text style={styles.cardBusinessType}>{item.businessType}</Text>
            )}
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.avatarContainer}>
          {item.businessImage && item.businessImage.trim() !== '' && item.businessImage.startsWith('http') ? (
            <LoadingImage source={{ uri: item.businessImage }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="storefront" size={20} color="#667eea" />
            </View>
          )}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.businessName}>{item.businessName}</Text>
          <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
        </View>
        <TouchableOpacity onPress={() => handleUnsavePost(item.id)}>
          <Ionicons name="bookmark" size={24} color="#667eea" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.postContent}>{item.content}</Text>
      
             {item.imageUrl && item.imageUrl.trim() !== '' && (
         <View style={styles.imageWrapper}>
           {item.imageUrl.startsWith('http') ? (
             <LoadingImage 
               source={{ uri: item.imageUrl }} 
               style={styles.postImage} 
               resizeMode="cover"
               placeholder="image"
             />
           ) : (
             <View style={[styles.postImage, styles.invalidImageContainer]}>
               <Ionicons name="image-outline" size={40} color="#999" />
               <Text style={styles.invalidImageText}>Invalid image URL</Text>
             </View>
           )}
         </View>
       )}
      
      <View style={styles.postActions}>
        <View style={styles.actionInfo}>
          <Ionicons name="heart" size={16} color="#e91e63" />
          <Text style={styles.actionCount}>{item.likes.length}</Text>
        </View>
        <View style={styles.actionInfo}>
          <Ionicons name="chatbubble" size={16} color="#667eea" />
          <Text style={styles.actionCount}>{item.comments.length}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => {
            setSelectedPost(item);
            setCommentModalVisible(true);
          }}
        >
          <Text style={styles.viewCommentsText}>View Comments</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={{flex: 1}}>
    <SafeAreaView style={styles.container}>
      <View style={[styles.headerFixed, { backgroundColor: 'transparent' }]}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'Posts' ? 'Search saved posts' : 'Search saved places'}
            placeholderTextColor="#888"
          />
          <TouchableOpacity>
            <Ionicons name="options-outline" size={22} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Places' && styles.activeTab]}
            onPress={() => setActiveTab('Places')}
          >
            <Text style={[styles.tabText, activeTab === 'Places' && styles.activeTabText]}>
              Places
            </Text>
          </TouchableOpacity>
          <View style={{ width: width * 0.02 }} />
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Posts' && styles.activeTab]}
            onPress={() => setActiveTab('Posts')}
          >
            <Text style={[styles.tabText, activeTab === 'Posts' && styles.activeTabText]}>
              Posts
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {activeTab === 'Posts' ? (
        loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading saved posts...</Text>
          </View>
        ) : (
          <FlatList
            data={savedPosts}
            renderItem={renderPost}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="bookmark-outline" size={60} color="#ccc" />
                <Text style={styles.emptyText}>No saved posts</Text>
                <Text style={styles.emptySubtext}>Posts you save will appear here</Text>
              </View>
            }
          />
        )
      ) : (
        loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading saved places...</Text>
          </View>
        ) : (
          <FlatList
            data={savedBusinesses}
            renderItem={renderPlace}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={60} color="#ccc" />
                <Text style={styles.emptyText}>No saved places</Text>
                <Text style={styles.emptySubtext}>Places you save will appear here</Text>
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
        <View style={styles.modalOverlay}>
          <View style={styles.commentModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={selectedPost?.comments || []}
              keyExtractor={item => item.id}
              style={styles.commentsList}
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
                    <Text style={[
                      styles.commentUser,
                      isOwnComment && styles.ownCommentUser,
                      isAuthorComment && !isOwnComment && styles.authorCommentUser
                    ]}>
                      {displayName}
                    </Text>
                    <Text style={[
                      styles.commentText,
                      isOwnComment && styles.ownCommentText,
                      isAuthorComment && !isOwnComment && styles.authorCommentText
                    ]}>
                      {item.text}
                    </Text>
                    <Text style={styles.commentTime}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.noCommentsText}>No comments yet</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: height * 0.05,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderTopWidth: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    paddingHorizontal: width * 0.04,
    marginHorizontal: width * 0.04,
    marginTop: height * 0.02,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: {
    flex: 1,
    height: height * 0.06,
    fontSize: 16 * FONT_SCALE,
    marginLeft: width * 0.03,
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: height * 0.02,
    borderRadius: 12,
    marginHorizontal: width * 0.04,
    padding: width * 0.01,
  },
  tab: {
    flex: 1,
    paddingVertical: height * 0.01,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  activeTab: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  tabText: {
    fontSize: 16 * FONT_SCALE,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#667eea',
  },
  listContainer: {
    paddingHorizontal: width * 0.04,
    paddingBottom: height * 0.02,
    paddingTop: height * 0.19,
  },
  card: {
    marginBottom: height * 0.02,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardImage: {
    width: '100%',
    height: height * 0.2,
  },
  cardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'space-between',
    padding: width * 0.04,
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
    paddingHorizontal: width * 0.02,
    paddingVertical: height * 0.005,
    borderRadius: 12,
  },
  ratingText: {
    color: '#fff',
    fontSize: 14 * FONT_SCALE,
    fontWeight: '600',
    marginLeft: width * 0.01,
  },
  bookmark: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: width * 0.02,
    borderRadius: 20,
  },
  cardFooter: {
    alignItems: 'flex-start',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18 * FONT_SCALE,
    fontWeight: 'bold',
    marginBottom: height * 0.005,
  },
  cardLocation: {
    color: '#fff',
    fontSize: 12 * FONT_SCALE,
    opacity: 0.9,
  },
  cardBusinessType: {
    color: '#FFD700',
    fontSize: 11 * FONT_SCALE,
    fontWeight: '600',
    marginTop: height * 0.003,
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  postHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  businessName: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  postTime: { 
    fontSize: 12, 
    color: '#888', 
    marginTop: 2 
  },
  postContent: { 
    fontSize: 15, 
    color: '#333', 
    lineHeight: 22,
    marginBottom: 12
  },
  imageWrapper: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f8f9fa',
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  invalidImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  invalidImageText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  postActions: { 
    flexDirection: 'row', 
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionCount: { 
    fontSize: 14, 
    color: '#888', 
    marginLeft: 4 
  },
  viewCommentsText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: height * 0.2,
  },
  loadingText: {
    color: '#000',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: height * 0.15,
  },
  emptyText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  commentModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 40,
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
  commentsList: {
    maxHeight: 300,
    paddingHorizontal: 16,
  },
  commentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  ownCommentItem: {
    backgroundColor: '#f8f9ff',
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
    paddingLeft: 16,
  },
  authorCommentItem: {
    backgroundColor: '#fff8f0',
    borderLeftWidth: 3,
    borderLeftColor: '#ff9800',
    paddingLeft: 16,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
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
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 4,
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
    fontSize: 12,
    color: '#888',
  },
  noCommentsText: {
    textAlign: 'center',
    color: '#888',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
});

export default SavedScreen; 