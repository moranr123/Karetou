import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, RefreshControl, StyleSheet, Platform, StatusBar, Image, Alert, Modal, Dimensions, KeyboardAvoidingView, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, addDoc, getDoc } from 'firebase/firestore';
import LoadingImage from '../../components/LoadingImage';
import NotificationService from '../../services/NotificationService';
import { useResponsive } from '../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView, ResponsiveCard, ResponsiveButton } from '../../components';

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
  const { spacing, fontSizes, iconSizes, borderRadius: borderRadiusValues, getResponsiveWidth, getResponsiveHeight, dimensions, responsiveHeight, responsiveWidth, responsiveFontSize } = useResponsive();
  
  // Calculate responsive dimensions
  const avatarSize = Math.max(36, Math.min(dimensions.width * 0.1, 48));
  const postImageHeight = Math.max(180, Math.min(dimensions.height * 0.25, 300));
  const minTouchTarget = 44;
  const isSmallScreen = dimensions.width < 360;
  
  // Calculate header padding - reduce for both platforms
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const headerPaddingTop = Platform.OS === 'ios' 
    ? spacing.md + (dimensions.isSmallDevice ? spacing.xs : spacing.sm)
    : statusBarHeight + spacing.sm; // Reduced padding for Android
  
  // Calculate total header height: paddingTop + title height + margin + search bar height + paddingBottom
  const headerTitleHeight = fontSizes.xl * 1.2 + spacing.xs; // Title height with line height
  const headerMarginBottom = spacing.md;
  const searchBarHeight = 44; // minHeight from searchBarContainer
  const headerPaddingBottom = spacing.md;
  const headerTotalHeight = headerPaddingTop + headerTitleHeight + headerMarginBottom + searchBarHeight + headerPaddingBottom;

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;
  
  // Create responsive styles using useMemo
  const styles = useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    modalSafeArea: {
      flex: 1,
    },
    gradient: { 
      flex: 1 
    },
    headerFixed: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      paddingTop: headerPaddingTop,
      paddingBottom: spacing.md,
      borderBottomLeftRadius: borderRadiusValues.xl,
      borderBottomRightRadius: borderRadiusValues.xl,
      borderWidth: 1,
      borderColor: theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
      backgroundColor: theme === 'light' ? '#F5F5F5' : '#232526',
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
      paddingHorizontal: isSmallScreen ? spacing.md : spacing.lg,
      marginBottom: spacing.md,
    },
    headerTitle: {
      fontSize: fontSizes.xl,
      fontWeight: '700',
      color: '#000',
    },
    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderRadius: borderRadiusValues.lg,
      marginHorizontal: spacing.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      minHeight: 44,
    },
    searchIcon: {
      marginLeft: spacing.sm,
    },
    searchBar: {
      flex: 1,
      fontSize: fontSizes.md,
      color: '#222',
      padding: spacing.sm,
      backgroundColor: 'transparent',
      minHeight: 36,
    },
    filterButton: {
      padding: spacing.xs,
      marginLeft: spacing.sm,
      marginRight: spacing.xs,
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      paddingBottom: responsiveHeight(12),
      paddingTop: headerTotalHeight + spacing.md, // Add spacing for better visual separation
    },
    card: {
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.lg,
      padding: isSmallScreen ? spacing.md : spacing.lg,
      marginBottom: spacing.lg,
      marginHorizontal: isSmallScreen ? spacing.sm : spacing.lg,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 3,
    },
    cardHeader: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      marginBottom: spacing.md 
    },
    avatarContainer: {
      marginRight: spacing.md,
    },
    avatar: {
      borderRadius: 50,
    },
    avatarPlaceholder: {
      backgroundColor: '#f0f0f0',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    userName: { 
      fontSize: fontSizes.md, 
      fontWeight: 'bold', 
      color: '#333' 
    },
    time: { 
      fontSize: fontSizes.sm, 
      color: '#888', 
      marginTop: spacing.xs / 2 
    },
    postText: { 
      fontSize: fontSizes.md, 
      color: '#333', 
      lineHeight: fontSizes.md * 1.5,
      marginBottom: spacing.md
    },
    imageWrapper: {
      marginBottom: spacing.md,
      borderRadius: borderRadiusValues.md,
      overflow: 'hidden',
      backgroundColor: '#f8f9fa',
      width: '100%',
    },
    postImage: {
      width: '100%',
      borderRadius: borderRadiusValues.md,
    },
    invalidImageContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f8f9fa',
    },
    invalidImageText: {
      fontSize: fontSizes.sm,
      color: '#999',
      marginTop: spacing.sm,
    },
    actions: { 
      flexDirection: 'row', 
      alignItems: 'center',
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: '#f0f0f0',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isSmallScreen ? spacing.md : spacing.lg,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
    },
    actionCount: { 
      fontSize: fontSizes.sm, 
      color: '#888', 
      marginLeft: spacing.xs 
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: responsiveHeight(20),
    },
    loadingText: {
      color: '#000',
      fontSize: fontSizes.lg,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: responsiveHeight(15),
      paddingHorizontal: spacing.lg,
    },
    emptyText: {
      color: '#000',
      fontSize: fontSizes.lg,
      fontWeight: 'bold',
      marginTop: spacing.lg,
      textAlign: 'center',
    },
    emptySubtext: {
      color: '#666',
      fontSize: fontSizes.md,
      marginTop: spacing.sm,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: isSmallScreen ? spacing.md : spacing.lg,
      paddingVertical: isSmallScreen ? spacing.md : spacing.lg,
    },
    commentModal: {
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.xl,
      width: '100%',
      maxWidth: isSmallScreen ? dimensions.width * 0.95 : Math.min(dimensions.width * 0.9, 500),
      maxHeight: dimensions.height * 0.85,
      paddingBottom: spacing.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    modalTitle: {
      fontSize: fontSizes.xl,
      fontWeight: 'bold',
      color: '#333',
    },
    closeButton: {
      padding: spacing.xs,
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    commentsList: {
      maxHeight: responsiveHeight(40),
      paddingHorizontal: spacing.lg,
    },
    commentItem: {
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    ownCommentItem: {
      backgroundColor: '#f8f9ff',
      borderLeftWidth: 3,
      borderLeftColor: '#667eea',
      paddingLeft: spacing.lg,
      marginLeft: spacing.xs,
    },
    authorCommentItem: {
      backgroundColor: '#fff8f0',
      borderLeftWidth: 3,
      borderLeftColor: '#ff9800',
      paddingLeft: spacing.lg,
      marginLeft: spacing.xs,
    },
    commentUser: {
      fontSize: fontSizes.sm,
      fontWeight: 'bold',
      color: '#333',
      marginBottom: spacing.xs,
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
      fontSize: fontSizes.sm,
      color: '#555',
      lineHeight: fontSizes.sm * 1.4,
      marginBottom: spacing.xs,
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
      fontSize: fontSizes.xs,
      color: '#888',
    },
    noCommentsText: {
      textAlign: 'center',
      color: '#888',
      fontStyle: 'italic',
      paddingVertical: spacing.lg,
      fontSize: fontSizes.md,
    },
    commentInputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: '#f0f0f0',
    },
    commentInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: borderRadiusValues.xl,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      maxHeight: responsiveHeight(10),
      marginRight: spacing.md,
      fontSize: fontSizes.md,
      minHeight: 44,
    },
    sendButton: {
      padding: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    commentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
    },
    commentUserInfo: {
      flex: 1,
      minWidth: 0,
    },
    editedText: {
      fontSize: fontSizes.xs,
      color: '#999',
      fontStyle: 'italic',
    },
    commentMenuContainer: {
      position: 'relative',
    },
    menuButton: {
      padding: spacing.xs,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dropdown: {
      position: 'absolute',
      top: 30,
      right: 0,
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      minWidth: responsiveWidth(25),
      zIndex: 1000,
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    dropdownText: {
      fontSize: fontSizes.sm,
      color: '#333',
      marginLeft: spacing.sm,
    },
    editCommentContainer: {
      marginTop: spacing.sm,
    },
    editCommentInput: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: borderRadiusValues.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSizes.sm,
      maxHeight: responsiveHeight(10),
      minHeight: 44,
    },
    editCommentActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: spacing.sm,
    },
    editCancelButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginRight: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editCancelText: {
      fontSize: fontSizes.sm,
      color: '#888',
    },
    editSaveButton: {
      backgroundColor: '#667eea',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadiusValues.xs,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editSaveText: {
      fontSize: fontSizes.sm,
      color: '#fff',
      fontWeight: '500',
    },
    loadingSpinner: {
      transform: [{ rotate: '360deg' }],
    },
  }), [spacing, fontSizes, borderRadiusValues, dimensions, responsiveHeight, responsiveWidth, isSmallScreen, headerPaddingTop, headerTotalHeight, theme]);

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
      <ResponsiveView style={styles.card}>
        <ResponsiveView style={styles.cardHeader}>
          <ResponsiveView style={styles.avatarContainer}>
            {item.businessImage && item.businessImage.trim() !== '' && item.businessImage.startsWith('http') ? (
              <LoadingImage 
                source={{ uri: item.businessImage }} 
                style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }} 
                resizeMode="cover"
              />
            ) : (
              <ResponsiveView style={[styles.avatarPlaceholder, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
                <Ionicons name="storefront" size={iconSizes.md} color="#667eea" />
              </ResponsiveView>
            )}
          </ResponsiveView>
          <ResponsiveView style={styles.headerText}>
            <ResponsiveText size="md" weight="600" color="#000" style={styles.userName} numberOfLines={1}>
              {item.businessName}
            </ResponsiveText>
            <ResponsiveText size="sm" color="#666" style={styles.time}>
              {formatTime(item.createdAt)}
            </ResponsiveText>
          </ResponsiveView>
        </ResponsiveView>
        
        <ResponsiveText size="md" color="#000" style={styles.postText}>
          {item.content}
        </ResponsiveText>
        
        {item.imageUrl && item.imageUrl.trim() !== '' && (
          <ResponsiveView style={styles.imageWrapper}>
            {item.imageUrl.startsWith('http') ? (
              <LoadingImage 
                source={{ uri: item.imageUrl }} 
                style={{ width: '100%', height: postImageHeight, borderRadius: borderRadiusValues.md }} 
                resizeMode="contain"
                placeholder="image"
              />
            ) : (
              <ResponsiveView style={[styles.postImage, styles.invalidImageContainer, { height: postImageHeight }]}>
                <Ionicons name="image-outline" size={iconSizes.xl} color="#999" />
                <ResponsiveText size="sm" color="#999" style={styles.invalidImageText}>
                  Invalid image URL
                </ResponsiveText>
              </ResponsiveView>
            )}
          </ResponsiveView>
        )}
        
        <ResponsiveView style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionButton, { minWidth: minTouchTarget, minHeight: minTouchTarget }]} 
            onPress={() => handleLike(item.id)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={isLiked ? "heart" : "heart-outline"} 
              size={iconSizes.lg} 
              color={isLiked ? "#e91e63" : "#888"} 
            />
            <ResponsiveText size="sm" color={isLiked ? "#e91e63" : "#888"} style={styles.actionCount}>
              {item.likes.length}
            </ResponsiveText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { minWidth: minTouchTarget, minHeight: minTouchTarget }]} 
            onPress={() => {
              setSelectedPost(item);
              setCommentModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={iconSizes.lg} color="#888" />
            <ResponsiveText size="sm" color="#888" style={styles.actionCount}>
              {item.comments.length}
            </ResponsiveText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { minWidth: minTouchTarget, minHeight: minTouchTarget }]} 
            onPress={() => handleSave(item.id)}
            activeOpacity={0.7}
          >
            <Feather 
              name={isSaved ? "bookmark" : "bookmark"} 
              size={iconSizes.lg} 
              color={isSaved ? "#667eea" : "#888"} 
            />
          </TouchableOpacity>
        </ResponsiveView>
      </ResponsiveView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.gradient}>
        {/* Fixed Header */}
        <ResponsiveView style={styles.headerFixed}>
          <ResponsiveView style={styles.headerContent}>
            <ResponsiveText size="xl" weight="bold" color="#000" style={styles.headerTitle}>
              Feed
            </ResponsiveText>
          </ResponsiveView>
          {/* Search Bar */}
          <ResponsiveView style={styles.searchBarContainer}>
            <Ionicons name="search" size={iconSizes.md} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchBar}
              placeholder="Search posts..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#888"
              returnKeyType="search"
            />
            <TouchableOpacity 
              style={styles.filterButton}
              activeOpacity={0.7}
            >
              <Ionicons name="filter" size={iconSizes.lg} color="#888" />
            </TouchableOpacity>
          </ResponsiveView>
        </ResponsiveView>

        {/* Feed List */}
        {loading ? (
          <ResponsiveView style={styles.loadingContainer}>
            <ResponsiveText size="lg" weight="600" color="#000" style={styles.loadingText}>
              Loading posts...
            </ResponsiveText>
          </ResponsiveView>
        ) : (
        <FlatList
            data={filteredPosts}
          keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={renderPost}
            showsVerticalScrollIndicator={false}
          refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme === 'dark' ? '#FFF' : '#333'}
              />
            }
            ListEmptyComponent={
              <ResponsiveView style={styles.emptyContainer}>
                <Ionicons name="newspaper-outline" size={iconSizes.xxxl} color="#ccc" />
                <ResponsiveText size="lg" weight="600" color="#000" style={styles.emptyText}>
                  No posts yet
                </ResponsiveText>
                <ResponsiveText size="md" color="#666" style={styles.emptySubtext}>
                  Posts from businesses will appear here
                </ResponsiveText>
              </ResponsiveView>
            }
          />
        )}

      {/* Comment Modal */}
      <Modal
        visible={commentModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ResponsiveView style={styles.commentModal}>
              <ResponsiveView style={styles.modalHeader}>
                <ResponsiveText size="xl" weight="bold" color="#000" style={styles.modalTitle}>
                  Comments
                </ResponsiveText>
                <TouchableOpacity 
                  onPress={() => setCommentModalVisible(false)}
                  style={styles.closeButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={iconSizes.lg} color="#333" />
                </TouchableOpacity>
              </ResponsiveView>
            
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
                  <ResponsiveView style={[
                    styles.commentItem, 
                    isOwnComment && styles.ownCommentItem,
                    isAuthorComment && !isOwnComment && styles.authorCommentItem
                  ]}>
                    <ResponsiveView style={styles.commentHeader}>
                      <ResponsiveView style={styles.commentUserInfo}>
                        <ResponsiveText size="sm" weight="600" color={isOwnComment ? "#667eea" : isAuthorComment ? "#FFD700" : "#000"} style={[
                          styles.commentUser,
                          isOwnComment && styles.ownCommentUser,
                          isAuthorComment && !isOwnComment && styles.authorCommentUser
                        ]}>
                          {displayName}
                        </ResponsiveText>
                        <ResponsiveText size="xs" color="#666" style={styles.commentTime}>
                          {new Date(item.createdAt).toLocaleDateString()}
                          {item.editedAt && <ResponsiveText size="xs" color="#999" style={styles.editedText}> (edited)</ResponsiveText>}
                        </ResponsiveText>
                      </ResponsiveView>
                    {item.userId === user?.uid && (
                      <ResponsiveView style={styles.commentMenuContainer}>
                        <TouchableOpacity
                          onPress={() => setShowDropdown(showDropdown === item.id ? null : item.id)}
                          style={[styles.menuButton, { minWidth: minTouchTarget, minHeight: minTouchTarget }]}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="ellipsis-horizontal" size={iconSizes.sm} color="#888" />
                        </TouchableOpacity>
                        {showDropdown === item.id && (
                          <ResponsiveView style={styles.dropdown}>
                            <TouchableOpacity
                              style={[styles.dropdownItem, { minHeight: minTouchTarget }]}
                              onPress={() => startEditComment(item)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="create-outline" size={iconSizes.sm} color="#667eea" />
                              <ResponsiveText size="sm" color="#667eea" style={styles.dropdownText}>Edit</ResponsiveText>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.dropdownItem, { minHeight: minTouchTarget }]}
                              onPress={() => handleDeleteComment(item.id)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="trash-outline" size={iconSizes.sm} color="#e91e63" />
                              <ResponsiveText size="sm" color="#e91e63" style={styles.dropdownText}>Delete</ResponsiveText>
                            </TouchableOpacity>
                          </ResponsiveView>
                        )}
                      </ResponsiveView>
                    )}
                  </ResponsiveView>
                  
                  {editingCommentId === item.id ? (
                    <ResponsiveView style={styles.editCommentContainer}>
                      <TextInput
                        style={styles.editCommentInput}
                        value={editCommentText}
                        onChangeText={setEditCommentText}
                        multiline
                        autoFocus
                      />
                      <ResponsiveView style={styles.editCommentActions}>
                        <TouchableOpacity
                          style={[styles.editCancelButton, { minHeight: minTouchTarget }]}
                          onPress={() => {
                            setEditingCommentId(null);
                            setEditCommentText('');
                          }}
                          activeOpacity={0.7}
                        >
                          <ResponsiveText size="sm" color="#666" style={styles.editCancelText}>Cancel</ResponsiveText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.editSaveButton, { minHeight: minTouchTarget }]}
                          onPress={() => handleEditComment(item.id)}
                          activeOpacity={0.7}
                        >
                          <ResponsiveText size="sm" color="#fff" style={styles.editSaveText}>Save</ResponsiveText>
                        </TouchableOpacity>
                      </ResponsiveView>
                    </ResponsiveView>
                  ) : (
                    <ResponsiveText size="sm" color="#000" style={[
                      styles.commentText,
                      isOwnComment && styles.ownCommentText,
                      isAuthorComment && !isOwnComment && styles.authorCommentText
                    ]}>
                      {item.text}
                    </ResponsiveText>
                  )}
                  </ResponsiveView>
                );
              }}
              ListEmptyComponent={
                <ResponsiveText size="md" color="#666" style={styles.noCommentsText}>No comments yet</ResponsiveText>
              }
            />
            
            <ResponsiveView style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity 
                style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled, { minWidth: minTouchTarget, minHeight: minTouchTarget }]}
                onPress={handleComment}
                disabled={submittingComment || !commentText.trim()}
                activeOpacity={0.7}
              >
                {submittingComment ? (
                  <ResponsiveView style={styles.loadingSpinner}>
                    <Ionicons name="sync" size={iconSizes.md} color="#667eea" />
                  </ResponsiveView>
                ) : (
                  <Ionicons name="send" size={iconSizes.md} color={commentText.trim() ? "#667eea" : "#ccc"} />
                )}
              </TouchableOpacity>
            </ResponsiveView>
          </ResponsiveView>
        </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </LinearGradient>
    </SafeAreaView>
  );
};

export default FeedScreen;