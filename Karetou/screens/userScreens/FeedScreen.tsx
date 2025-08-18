import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, RefreshControl, StyleSheet, Platform, StatusBar, Image, Alert, Modal, Dimensions, KeyboardAvoidingView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, addDoc, getDoc } from 'firebase/firestore';
import LoadingImage from '../../components/LoadingImage';
import NotificationService from '../../services/NotificationService';

const { width: screenWidth } = Dimensions.get('window');

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
  ownerProfileImage?: string;
}

const FeedScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  
  const { theme, user } = useAuth();

  const lightGradient = ['#667eea', '#764ba2'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  // Real-time posts listener
  useEffect(() => {
    const postsQuery = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(postsQuery, async (snapshot) => {
      const postsData: Post[] = [];
      
      // Get all unique owner IDs to fetch their profile images
      const ownerIds = new Set<string>();
      snapshot.forEach(doc => {
        const postData = doc.data();
        if (postData.ownerId) {
          ownerIds.add(postData.ownerId);
        }
      });

      // Fetch profile images for all unique owners
      const ownerProfiles: { [key: string]: string } = {};
      await Promise.all(
        Array.from(ownerIds).map(async (ownerId) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', ownerId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              ownerProfiles[ownerId] = userData.profileImage || '';
            }
          } catch (error) {
            console.error('Error fetching user profile for:', ownerId, error);
          }
        })
      );

      // Add profile images to posts
      snapshot.forEach(docSnapshot => {
        const postData = docSnapshot.data();
        postsData.push({ 
          id: docSnapshot.id, 
          ...postData,
          ownerProfileImage: ownerProfiles[postData.ownerId] || ''
        } as Post);
      });
      
      setPosts(postsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleLike = async (postId: string) => {
    if (!user?.uid) return;
    
    try {
      const postRef = doc(db, 'posts', postId);
      const post = posts.find(p => p.id === postId);
      
      if ((post?.likes || []).includes(user.uid)) {
        // Unlike
        await updateDoc(postRef, {
          likes: arrayRemove(user.uid)
        });
      } else {
        // Like
        await updateDoc(postRef, {
          likes: arrayUnion(user.uid)
        });

        // Send notification to post owner (if not liking own post)
        if (post && post.ownerId !== user.uid) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userData = userDoc.exists() ? userDoc.data() : {};
          const likerName = userData.fullName || user.displayName || user.email || 'Someone';
          
          const notificationService = NotificationService.getInstance();
          await notificationService.notifyPostLike(
            postId,
            post.ownerId,
            likerName,
            post.businessName
          );
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleSave = async (postId: string) => {
    if (!user?.uid) return;
    
    try {
      const postRef = doc(db, 'posts', postId);
      const post = posts.find(p => p.id === postId);
      
      if ((post?.savedBy || []).includes(user.uid)) {
        // Unsave
        await updateDoc(postRef, {
          savedBy: arrayRemove(user.uid)
        });
      } else {
        // Save
        await updateDoc(postRef, {
          savedBy: arrayUnion(user.uid)
        });
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  const handleComment = async () => {
    if (!user?.uid || !selectedPost || !commentText.trim()) return;
    
    setSubmittingComment(true);
    try {
      // Get user's full name
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const userName = userData.fullName || user.displayName || user.email || 'Anonymous';
      
      const postRef = doc(db, 'posts', selectedPost.id);
      const newComment = {
        id: Date.now().toString(),
        userId: user.uid,
        userName: userName,
        text: commentText.trim(),
        createdAt: new Date().toISOString()
      };
      
      await updateDoc(postRef, {
        comments: arrayUnion(newComment)
      });
      
      // Update local state immediately for UI responsiveness
      const updatedComments = [...selectedPost.comments, newComment];
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === selectedPost.id 
            ? { ...post, comments: updatedComments }
            : post
        )
      );
      
      // Update selectedPost to reflect changes in modal
      setSelectedPost(prev => prev ? { ...prev, comments: updatedComments } : null);
      
      // Send notification to post owner (if not commenting on own post)
      if (selectedPost.ownerId !== user.uid) {
        const notificationService = NotificationService.getInstance();
        await notificationService.notifyPostComment(
          selectedPost.id,
          selectedPost.ownerId,
          userName,
          selectedPost.businessName,
          commentText.trim()
        );
      }
      
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!user?.uid || !selectedPost || !editCommentText.trim()) return;
    
    try {
      const postRef = doc(db, 'posts', selectedPost.id);
      const updatedComments = selectedPost.comments.map(comment => 
        comment.id === commentId 
          ? { ...comment, text: editCommentText.trim(), editedAt: new Date().toISOString() }
          : comment
      );
      
      await updateDoc(postRef, {
        comments: updatedComments
      });
      
      // Update local state immediately for UI responsiveness
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === selectedPost.id 
            ? { ...post, comments: updatedComments }
            : post
        )
      );
      
      // Update selectedPost to reflect changes in modal
      setSelectedPost(prev => prev ? { ...prev, comments: updatedComments } : null);
      
      setEditingCommentId(null);
      setEditCommentText('');
      setShowDropdown(null);
    } catch (error) {
      console.error('Error editing comment:', error);
      Alert.alert('Error', 'Failed to edit comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user?.uid || !selectedPost) return;
    
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const postRef = doc(db, 'posts', selectedPost.id);
              const updatedComments = selectedPost.comments.filter(comment => comment.id !== commentId);
              
              await updateDoc(postRef, {
                comments: updatedComments
              });
              
              // Update local state immediately for UI responsiveness
              setPosts(prevPosts => 
                prevPosts.map(post => 
                  post.id === selectedPost.id 
                    ? { ...post, comments: updatedComments }
                    : post
                )
              );
              
              // Update selectedPost to reflect changes in modal
              setSelectedPost(prev => prev ? { ...prev, comments: updatedComments } : null);
              
              setShowDropdown(null);
            } catch (error) {
              console.error('Error deleting comment:', error);
              Alert.alert('Error', 'Failed to delete comment');
            }
          }
        }
      ]
    );
  };

  const startEditComment = (comment: any) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.text);
    setShowDropdown(null);
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

  const filteredPosts = posts.filter(post =>
    (post.businessName || '').toLowerCase().includes(search.toLowerCase()) ||
    (post.content || '').toLowerCase().includes(search.toLowerCase())
  );

  const renderPost = ({ item }: { item: Post }) => {
    const isLiked = (item.likes || []).includes(user?.uid || '');
    const isSaved = (item.savedBy || []).includes(user?.uid || '');
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
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
            <Text style={styles.userName}>{item.businessName}</Text>
            <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>
        
        <Text style={styles.postText}>{item.content}</Text>
        
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
        
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item.id)}>
            <Ionicons 
              name={isLiked ? "heart" : "heart-outline"} 
              size={22} 
              color={isLiked ? "#e91e63" : "#888"} 
            />
            <Text style={[styles.actionCount, isLiked && { color: "#e91e63" }]}>
              {item.likes.length}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => {
              setSelectedPost(item);
              setCommentModalVisible(true);
            }}
          >
            <Ionicons name="chatbubble-outline" size={22} color="#888" />
            <Text style={styles.actionCount}>{item.comments.length}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={() => handleSave(item.id)}>
            <Feather 
              name={isSaved ? "bookmark" : "bookmark"} 
              size={22} 
              color={isSaved ? "#667eea" : "#888"} 
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.gradient}>
      {/* Fixed Header */}
      <View style={[styles.headerFixed, { backgroundColor: 'transparent' }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Feed</Text>
        </View>
        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={20} color="#888" style={{ marginLeft: 8 }} />
          <TextInput
            style={styles.searchBar}
            placeholder="Search posts..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#888"
          />
          <TouchableOpacity>
            <Ionicons name="filter" size={22} color="#888" style={{ marginLeft: 8, marginRight: 4 }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      ) : (
      <FlatList
          data={filteredPosts}
        keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 150 }}
          renderItem={renderPost}
        refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme === 'dark' ? '#FFF' : '#333'}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper-outline" size={60} color="rgba(255,255,255,0.5)" />
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>Posts from businesses will appear here</Text>
            </View>
          }
        />
      )}

      {/* Comment Modal */}
      <Modal
        visible={commentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
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
                    <View style={styles.commentHeader}>
                      <View style={styles.commentUserInfo}>
                        <Text style={[
                          styles.commentUser,
                          isOwnComment && styles.ownCommentUser,
                          isAuthorComment && !isOwnComment && styles.authorCommentUser
                        ]}>
                          {displayName}
                        </Text>
                        <Text style={styles.commentTime}>
                          {new Date(item.createdAt).toLocaleDateString()}
                          {item.editedAt && <Text style={styles.editedText}> (edited)</Text>}
                        </Text>
                      </View>
                    {item.userId === user?.uid && (
                      <View style={styles.commentMenuContainer}>
                        <TouchableOpacity
                          onPress={() => setShowDropdown(showDropdown === item.id ? null : item.id)}
                          style={styles.menuButton}
                        >
                          <Ionicons name="ellipsis-horizontal" size={16} color="#888" />
                        </TouchableOpacity>
                        {showDropdown === item.id && (
                          <View style={styles.dropdown}>
                            <TouchableOpacity
                              style={styles.dropdownItem}
                              onPress={() => startEditComment(item)}
                            >
                              <Ionicons name="create-outline" size={16} color="#667eea" />
                              <Text style={styles.dropdownText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.dropdownItem}
                              onPress={() => handleDeleteComment(item.id)}
                            >
                              <Ionicons name="trash-outline" size={16} color="#e91e63" />
                              <Text style={[styles.dropdownText, { color: '#e91e63' }]}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  
                  {editingCommentId === item.id ? (
                    <View style={styles.editCommentContainer}>
                      <TextInput
                        style={styles.editCommentInput}
                        value={editCommentText}
                        onChangeText={setEditCommentText}
                        multiline
                        autoFocus
                      />
                      <View style={styles.editCommentActions}>
                        <TouchableOpacity
                          style={styles.editCancelButton}
                          onPress={() => {
                            setEditingCommentId(null);
                            setEditCommentText('');
                          }}
                        >
                          <Text style={styles.editCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.editSaveButton}
                          onPress={() => handleEditComment(item.id)}
                        >
                          <Text style={styles.editSaveText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <Text style={[
                      styles.commentText,
                      isOwnComment && styles.ownCommentText,
                      isAuthorComment && !isOwnComment && styles.authorCommentText
                    ]}>
                      {item.text}
                    </Text>
                  )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.noCommentsText}>No comments yet</Text>
              }
            />
            
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity 
                style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
                onPress={handleComment}
                disabled={submittingComment || !commentText.trim()}
              >
                {submittingComment ? (
                  <View style={styles.loadingSpinner}>
                    <Ionicons name="sync" size={20} color="#667eea" />
                  </View>
                ) : (
                  <Ionicons name="send" size={20} color={commentText.trim() ? "#667eea" : "#ccc"} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  headerFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 44 : 44,
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderTopWidth: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    marginHorizontal: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  searchBar: {
    flex: 1,
    fontSize: 15,
    color: '#222',
    padding: 8,
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: { 
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
  userName: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  time: { 
    fontSize: 12, 
    color: '#888', 
    marginTop: 2 
  },
  postText: { 
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
  actions: { 
    flexDirection: 'row', 
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionCount: { 
    fontSize: 14, 
    color: '#888', 
    marginLeft: 6 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  commentModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    paddingBottom: 20,
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
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 80,
    marginRight: 12,
  },
  sendButton: {
    padding: 10,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  commentUserInfo: {
    flex: 1,
  },
  editedText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  commentMenuContainer: {
    position: 'relative',
  },
  menuButton: {
    padding: 4,
  },
  dropdown: {
    position: 'absolute',
    top: 25,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 100,
    zIndex: 1000,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dropdownText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  editCommentContainer: {
    marginTop: 8,
  },
  editCommentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
  },
  editCommentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editCancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  editCancelText: {
    fontSize: 14,
    color: '#888',
  },
  editSaveButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editSaveText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  loadingSpinner: {
    transform: [{ rotate: '360deg' }],
  },
});

export default FeedScreen;