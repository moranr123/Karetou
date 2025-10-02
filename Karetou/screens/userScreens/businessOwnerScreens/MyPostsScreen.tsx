import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, TextInput, Modal, Alert, Platform, StatusBar, KeyboardAvoidingView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, getDoc, deleteDoc } from 'firebase/firestore';
import LoadingImage from '../../../components/LoadingImage';
import NotificationService from '../../../services/NotificationService';

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

const MyPostsScreen = () => {
  const navigation = useNavigation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [showPostDropdown, setShowPostDropdown] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editPostContent, setEditPostContent] = useState('');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [updatingPost, setUpdatingPost] = useState(false);
  
  const { user, theme } = useAuth();

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  // Real-time posts listener for current user's posts
  useEffect(() => {
    if (!user?.uid) return;

    const postsQuery = query(
      collection(db, 'posts'),
      where('ownerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsData: Post[] = [];
      snapshot.forEach(doc => {
        postsData.push({ id: doc.id, ...doc.data() } as Post);
      });
      setPosts(postsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);



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
      } else {
        // If business owner is replying to their own post, notify all previous commenters
        const notificationService = NotificationService.getInstance();
        const uniqueCommenters = new Set<string>();
        
        // Get all unique commenters (except the business owner)
        selectedPost.comments.forEach(comment => {
          if (comment.userId !== user.uid) {
            uniqueCommenters.add(comment.userId);
          }
        });
        
        // Send notifications to all previous commenters
        const replyPromises = Array.from(uniqueCommenters).map(commenterId => 
          notificationService.notifyBusinessReply(
            selectedPost.id,
            commenterId,
            selectedPost.businessName,
            commentText.trim()
          )
        );
        
        await Promise.all(replyPromises);
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

  const handleEditPost = (post: Post) => {
    if (!post || !post.id) {
      Alert.alert('Error', 'Invalid post data');
      return;
    }
    
    setEditingPostId(post.id);
    setEditPostContent(post.content);
    setEditModalVisible(true);
    setShowPostDropdown(null);
    
    // Clear any previous error states
    setUpdatingPost(false);
  };

  const handleDeletePost = (postId: string) => {
    if (!postId) {
      Alert.alert('Error', 'Invalid post ID');
      return;
    }
    
    // Close dropdown first
    setShowPostDropdown(null);
    
    // Find the post to get its details for the confirmation
    const postToDelete = posts.find(post => post.id === postId);
    const postPreview = postToDelete?.content?.substring(0, 50) + ((postToDelete?.content?.length || 0) > 50 ? '...' : '');
    Alert.alert(
      'Delete Post',
      `Are you sure you want to delete this post?\n\n"${postPreview}"\n\nThis action cannot be undone.`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'posts', postId));
              Alert.alert('Success', 'Post deleted successfully');
              
              // Close any open modals if the deleted post was selected
              if (selectedPost?.id === postId) {
                setCommentModalVisible(false);
                setSelectedPost(null);
              }
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert(
                'Delete Failed', 
                'Failed to delete post. Please check your connection and try again.'
              );
            }
          }
        }
      ]
    );
  };

  const handleUpdatePost = async () => {
    // Validation
    if (!editingPostId) {
      Alert.alert('Error', 'No post selected for editing');
      return;
    }
    
    if (!editPostContent.trim()) {
      Alert.alert('Error', 'Post content cannot be empty');
      return;
    }
    
    if (editPostContent.trim().length > 2000) {
      Alert.alert('Error', 'Post content is too long (maximum 2000 characters)');
      return;
    }

    
    setUpdatingPost(true);
    
    try {
      const updateData = {
        content: editPostContent.trim(),
        updatedAt: new Date().toISOString(),
        // Add edited flag to show it was modified
        isEdited: true
      };
      
      await updateDoc(doc(db, 'posts', editingPostId), updateData);
      

      
      // Clean up state
      setEditModalVisible(false);
      setEditingPostId(null);
      setEditPostContent('');
      
      Alert.alert('Success', 'Post updated successfully');
      
    } catch (error) {
      console.error('Error updating post:', error);
      Alert.alert(
        'Update Failed', 
        'Failed to update post. Please check your connection and try again.'
      );
    } finally {
      setUpdatingPost(false);
    }
  };

  // Enhanced cancel function with proper cleanup
  const handleCancelPostMenu = () => {
    setShowPostDropdown(null);
    
    // Clean up any other states if needed
    if (showDropdown) {
      setShowDropdown(null);
    }
  };

  // Enhanced cancel function for edit modal
  const handleCancelEditPost = () => {
    
    // Show confirmation if user has made changes
    if (editPostContent.trim() !== '' && editingPostId) {
      const originalPost = posts.find(post => post.id === editingPostId);
      if (originalPost && editPostContent.trim() !== originalPost.content.trim()) {
        Alert.alert(
          'Discard Changes',
          'You have unsaved changes. Are you sure you want to discard them?',
          [
            { text: 'Keep Editing', style: 'cancel' },
            { 
              text: 'Discard', 
              style: 'destructive',
              onPress: () => {
                setEditModalVisible(false);
                setEditingPostId(null);
                setEditPostContent('');
                setUpdatingPost(false);
              }
            }
          ]
        );
        return;
      }
    }
    
    // Clean up state
    setEditModalVisible(false);
    setEditingPostId(null);
    setEditPostContent('');
    setUpdatingPost(false);
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

  const renderPost = ({ item }: { item: Post }) => {
    const isLiked = item.likes.includes(user?.uid || '');
    
    // Debug image URL
    if (item.imageUrl) {
      console.log('Post image URL:', item.imageUrl);
      console.log('Image URL type:', typeof item.imageUrl);
      console.log('Image URL valid:', item.imageUrl.startsWith('http'));
    }
    
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
            <Text style={styles.businessName}>{item.businessName}</Text>
            <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="heart" size={16} color="#e91e63" />
              <Text style={styles.statText}>{item.likes.length}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="chatbubble" size={16} color="#667eea" />
              <Text style={styles.statText}>{item.comments.length}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="bookmark" size={16} color="#ff9800" />
              <Text style={styles.statText}>{item.savedBy.length}</Text>
            </View>
          </View>
          <View style={styles.postMenuContainer}>
            <TouchableOpacity
              onPress={() => {
                setShowPostDropdown(showPostDropdown === item.id ? null : item.id);
              }}
              style={styles.postMenuButton}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#888" />
            </TouchableOpacity>
            {showPostDropdown === item.id && (
                <View style={styles.postDropdown}>
                  <TouchableOpacity
                  style={styles.postDropdownItem}
                  onPress={() => handleEditPost(item)}
                  activeOpacity={0.7}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                >
                  <Ionicons name="create-outline" size={16} color="#667eea" />
                  <Text style={styles.postDropdownText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.postDropdownItem}
                  onPress={() => handleDeletePost(item.id)}
                  activeOpacity={0.7}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                >
                  <Ionicons name="trash-outline" size={16} color="#e91e63" />
                  <Text style={[styles.postDropdownText, { color: '#e91e63' }]}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.postDropdownItem}
                  onPress={handleCancelPostMenu}
                  activeOpacity={0.7}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                >
                  <Ionicons name="close-outline" size={16} color="#888" />
                  <Text style={styles.postDropdownText}>Cancel</Text>
                </TouchableOpacity>
                </View>
            )}
          </View>
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
        
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item.id)}>
            <Ionicons 
              name={isLiked ? "heart" : "heart-outline"} 
              size={22} 
              color={isLiked ? "#e91e63" : "#888"} 
            />
            <Text style={[styles.actionText, isLiked && { color: "#e91e63" }]}>
              Like
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
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFF' : '#000'} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme === 'dark' ? '#FFF' : '#000' }]}>My Posts</Text>
          <Text style={[styles.headerSubtitle, { color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : '#666' }]}>{posts.length} posts</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme === 'dark' ? 'rgba(255,255,255,0.8)' : '#333' }]}>Loading your posts...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 20 }}
          renderItem={renderPost}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper-outline" size={60} color={theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)'} />
              <Text style={[styles.emptyText, { color: theme === 'dark' ? 'rgba(255,255,255,0.8)' : '#333' }]}>No posts yet</Text>
              <Text style={[styles.emptySubtext, { color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : '#666' }]}>Create your first post to get started!</Text>
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
                return (
                  <View style={[styles.commentItem, isOwnComment && styles.ownCommentItem]}>
                    <View style={styles.commentHeader}>
                      <View style={styles.commentUserInfo}>
                        <Text style={[styles.commentUser, isOwnComment && styles.ownCommentUser]}>
                          {isOwnComment ? 'You' : item.userName}
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
                    <Text style={[styles.commentText, isOwnComment && styles.ownCommentText]}>
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

      {/* Edit Post Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.editPostModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Post</Text>
              <TouchableOpacity onPress={handleCancelEditPost}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.editPostContent}>
              <TextInput
                style={[
                  styles.editPostInput,
                  editPostContent.length > 2000 && styles.editPostInputError
                ]}
                value={editPostContent}
                onChangeText={setEditPostContent}
                placeholder="What's on your mind?"
                multiline
                autoFocus
                maxLength={2500} // Soft limit with visual feedback
              />
              <View style={styles.characterCountContainer}>
                <Text style={[
                  styles.characterCount,
                  editPostContent.length > 2000 && styles.characterCountError
                ]}>
                  {editPostContent.length}/2000 characters
                </Text>
              </View>
            </View>
            
            <View style={styles.editPostActions}>
              <TouchableOpacity
                style={styles.editPostCancelButton}
                onPress={handleCancelEditPost}
              >
                <Text style={styles.editPostCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editPostSaveButton}
                onPress={handleUpdatePost}
                disabled={updatingPost || !editPostContent.trim()}
              >
                {updatingPost ? (
                  <View style={styles.loadingSpinner}>
                    <Ionicons name="sync" size={20} color="#fff" />
                  </View>
                ) : (
                  <Text style={styles.editPostSaveText}>Update Post</Text>
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 44 : 44,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  headerSpacer: {
    width: 40, // Same width as back button to center the content
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
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
    marginBottom: 12,
    justifyContent: 'space-between',
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
  time: { 
    fontSize: 12, 
    color: '#888', 
    marginTop: 2 
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  statText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
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
  actions: { 
    flexDirection: 'row', 
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  actionText: { 
    fontSize: 14, 
    color: '#666', 
    marginLeft: 6,
    fontWeight: '500',
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
    paddingHorizontal: 40,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
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

  // Post menu styles
  postMenuContainer: {
    position: 'relative',
    zIndex: 100000,
  },
  postMenuButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
  },
  postDropdown: {
    position: 'absolute',
    top: 45,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 140,
    zIndex: 999999,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  postDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 48,
    backgroundColor: '#fff',
    zIndex: 1000000,
  },
  postDropdownText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    fontWeight: '500',
  },
  // Edit post modal styles
  editPostModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxHeight: '70%',
    paddingBottom: 20,
  },
  editPostContent: {
    padding: 20,
  },
  editPostInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: '#f9f9f9',
  },
  editPostInputError: {
    borderColor: '#e91e63',
    backgroundColor: '#fff5f5',
  },
  characterCountContainer: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
  },
  characterCountError: {
    color: '#e91e63',
    fontWeight: '600',
  },
  editPostActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  editPostCancelButton: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    marginRight: 10,
    alignItems: 'center',
  },
  editPostCancelText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  editPostSaveButton: {
    flex: 1,
    padding: 15,
    backgroundColor: '#667eea',
    borderRadius: 10,
    marginLeft: 10,
    alignItems: 'center',
  },
  editPostSaveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default MyPostsScreen; 