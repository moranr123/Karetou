import React, { useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  FlatList,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useResponsive } from '../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView, ResponsiveCard, ResponsiveButton, ResponsiveImage } from '../../components';

type RootStackParamList = {
  Home: undefined;
  DiscoverSilay: undefined;
  Navigate: { business?: any };
};

// Top Things to Do Data
const topThingsToDo = [
  {
    id: '1',
    title: 'Explore the Heritage District',
    image: require('../../assets/heritage-house.jpg'),
    description: 'Walk through historic streets and discover beautifully preserved heritage houses.',
  },
  {
    id: '2',
    title: 'Visit the 3 Lifestyle Museums',
    image: require('../../assets/balay-negrense.jpg'),
    images: [
      { 
        image: require('../../assets/balay-negrense.jpg'), 
        name: 'Balay Negrense',
        description: 'Balay Negrense is a museum that showcases the lifestyle of a Negrense sugar baron during the early 1900s. This ancestral house offers a glimpse into the opulent lifestyle of the sugar industry\'s golden age.'
      },
      { 
        image: require('../../assets/pink-house.jpg'), 
        name: 'Bernardino Jalandoni Museum ("Pink House")',
        description: 'The famous Pink House, also known as the Bernardino Jalandoni Museum, is one of the most photographed heritage houses in Silay. Its distinctive pink color and beautiful architecture make it a must-visit landmark.'
      },
      { 
        image: require('../../assets/hofilena-heritage.jpg'), 
        name: 'Hofilena Heritage House and Museum',
        description: 'The Hofilena Heritage House and Museum features an extensive collection of antiques and artifacts that tell the story of Silay\'s rich cultural heritage and the families who shaped the city\'s history.'
      },
    ],
    description: '✔️ Balay Negrense\n✔️ Bernardino Jalandoni Museum ("Pink House")\n✔️ Hofilena Heritage House and Museum\n\nThese three museums showcase the rich cultural heritage and lifestyle of Silay City, each offering unique insights into the city\'s history and traditions.',
  },
  {
    id: '3',
    title: 'San Diego Cathedral',
    image: require('../../assets/cathedral.jpg'),
    description: 'Designed by Italian architect Lucio Bernasooni in 1925 in the Neo-Romanesque style.',
  },
  {
    id: '4',
    title: 'Drive to Patag & Lantawan',
    image: require('../../assets/lantawan.jpg'),
    description: 'Unwind in cafes, restaurants and mountain resorts within the Patag-Lantawan "Ecotourism Loop". Experience a cooler climate and the majestic view of the Northern Negros Forest Park.',
  },
  {
    id: '5',
    title: 'Magikland',
    image: require('../../assets/magikland.jpg'),
    description: 'Experience Magikland. The first Filipino inspired theme park in the Philippines.',
  },
];

// Food Data
const foodData = [
  {
    id: '1',
    title: 'Emma Lacson\'s Hometown Delicacies',
    image: require('../../assets/emma-lacson.jpg'),
    images: [
      require('../../assets/emma-lacson.jpg'),
      require('../../assets/emma-lacson-2.jpg'),
      require('../../assets/emma-lacson-3.jpg'),
      require('../../assets/emma-lacson-4.jpg'),
    ],
    description: 'Made in Silay since 1925, available at The Soledad Montelibano Lacson Ancestral House at Rizal Street.',
  },
  {
    id: '2',
    title: 'El Ideal Bakery',
    image: require('../../assets/el-ideal.jpg'),
    images: [
      { 
        image: require('../../assets/el-ideal.jpg'), 
        name: 'El Ideal Bakery',
        description: 'It\'s the oldest running bakery in Negros Island! This historic bakery has been serving delicious bread and pastries for generations.'
      },
      { 
        image: require('../../assets/el-ideal-2.jpg'), 
        name: 'El Ideal Bakery',
        description: 'Step inside El Ideal Bakery to experience the traditional baking methods and warm atmosphere that has made it a beloved institution in Silay City.'
      },
    ],
    description: 'It\'s the oldest running bakery in Negros Island!',
  },
  {
    id: '3',
    title: 'Barangay Balaring Seafood',
    image: require('../../assets/balay-puti.jpg'),
    description: 'Fresh catch of the day, prepared by restaurants along the seawall.',
  },
  {
    id: '4',
    title: 'Heritage Cafes & Restaurants',
    image: require('../../assets/cafe-1925.jpg'),
    images: [
      { 
        image: require('../../assets/stephens-balay-puti.jpg'), 
        name: 'Stephen\'s at Balay Puti',
        description: 'Stephen\'s at Balay Puti at the Adela L. Ledesma Ancestral House offers a unique dining experience in a beautifully preserved heritage property.'
      },
      { 
        image: require('../../assets/casa-1898.jpg'), 
        name: '1898 Casa and Restaurant',
        description: '1898 Casa and Restaurant at the Generoso R. Gamboa Ancestral House combines historical charm with exceptional cuisine in an authentic heritage setting.'
      },
      { 
        image: require('../../assets/cafe-1925.jpg'), 
        name: 'Cafe 1925',
        description: 'Cafe 1925 at the Leandro R. Locsin Ancestral House provides a perfect blend of heritage atmosphere and modern dining experience.'
      },
    ],
    description: 'Stephen\'s at Balay Puti, 1898 Casa, and Cafe 1925 in repurposed ancestral houses.',
  },
];

// Where to Stay Data
const stayData = [
  {
    id: '1',
    title: 'Delfin Ledesma Ancestral House',
    image: require('../../assets/delfin-ledesma.jpg'),
    description: 'B&B and Garden Cafe in a beautiful heritage property.',
  },
  {
    id: '2',
    title: 'Casa Gamboa',
    image: require('../../assets/casa-gamboa.jpg'),
    description: 'Storied home that once hosted Gen. Douglas McArthur. Now a B&B and event venue.',
  },
  {
    id: '3',
    title: 'German Unson Heritage House',
    image: require('../../assets/german-unson.jpg'),
    description: 'Spanish Mission Style home with Art Deco interiors. First ancestral house B&B.',
  },
  {
    id: '4',
    title: 'RedDoorz Silay',
    image: require('../../assets/reddoorz.jpg'),
    description: 'Budget-friendly accommodation in a repurposed century-old building.',
  },
];

const DiscoverSilayScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { theme } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius: borderRadiusValues, getResponsiveWidth, getResponsiveHeight, dimensions, responsiveHeight, responsiveWidth } = useResponsive();
  const [welcomeModalVisible, setWelcomeModalVisible] = React.useState(true);
  const [detailModalVisible, setDetailModalVisible] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  
  // Device size detection
  const isSmallScreen = dimensions.width < 360;
  const isSmallDevice = dimensions.isSmallDevice;
  const minTouchTarget = 44;
  
  // Video player setup
  const player = useVideoPlayer(require('../../assets/SilayCity.mp4'), (player) => {
    player.loop = true;
    player.muted = false;
    player.play();
  });

  // Calculate header padding
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const headerPaddingTop = Platform.OS === 'ios' 
    ? spacing.md + (isSmallDevice ? spacing.xs : spacing.sm)
    : statusBarHeight + spacing.sm;

  // Create responsive styles using useMemo
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isSmallScreen ? spacing.sm : spacing.md,
      paddingTop: headerPaddingTop,
      paddingBottom: spacing.sm,
      minHeight: Math.max(50, minTouchTarget + spacing.sm),
    },
    backButton: {
      padding: spacing.sm,
      marginRight: spacing.sm,
      minWidth: minTouchTarget,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: isSmallScreen ? spacing.sm : spacing.md,
    },
    heroSection: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    heroImage: {
      width: getResponsiveWidth(90),
      height: responsiveHeight(25),
      borderRadius: borderRadiusValues.lg,
      marginBottom: spacing.lg,
    },
    heroOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.3)',
      borderRadius: borderRadiusValues.lg,
    },
    heroContent: {
      position: 'absolute',
      bottom: spacing.lg,
      left: spacing.lg,
      right: spacing.lg,
    },
    heroTitle: {
      fontWeight: 'bold',
      color: '#fff',
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    heroSubtitle: {
      color: '#fff',
      textAlign: 'center',
      opacity: 0.9,
    },
    heroVideoSection: {
      marginBottom: spacing.xl,
      paddingHorizontal: isSmallScreen ? spacing.sm : spacing.md,
    },
    videoContainer: {
      width: '100%',
      height: responsiveHeight(30),
      borderRadius: borderRadiusValues.xl,
      overflow: 'hidden',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    heroVideo: {
      width: '100%',
      height: '100%',
    },
    videoOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    videoContent: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: spacing.lg,
      alignItems: 'center',
    },
    heroVideoTitle: {
      textShadowColor: 'rgba(0, 0, 0, 0.75)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    heroVideoSubtitle: {
      textShadowColor: 'rgba(0, 0, 0, 0.75)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
      marginBottom: spacing.md,
      textAlign: 'center',
      opacity: 0.95,
    },
    highlightBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(102, 126, 234, 0.9)',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadiusValues.full,
      borderWidth: 2,
      borderColor: '#FFD700',
      minHeight: minTouchTarget,
      justifyContent: 'center',
    },
    highlightText: {
      marginLeft: spacing.xs,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    playPauseButton: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: borderRadiusValues.full,
      width: minTouchTarget,
      height: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#fff',
    },
    section: {
      marginBottom: spacing.xl,
      paddingHorizontal: isSmallScreen ? spacing.sm : spacing.md,
    },
    sectionHeader: {
      marginBottom: spacing.lg,
    },
    sectionTitleGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isSmallScreen ? spacing.md : spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadiusValues.xl,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    sectionIcon: {
      marginRight: spacing.sm,
    },
    sectionTitleText: {
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    sectionTitle: {
      fontWeight: 'bold',
      marginBottom: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    activityCard: {
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.lg,
      marginBottom: spacing.md,
      overflow: 'hidden',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    activityImage: {
      width: '100%',
      height: responsiveHeight(20),
    },
    activityContent: {
      padding: spacing.lg,
    },
    activityTitle: {
      fontWeight: 'bold',
      marginBottom: spacing.sm,
    },
    activityDescription: {
      color: '#666',
      lineHeight: fontSizes.md * 1.4,
    },
    museumCard: {
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.lg,
      marginBottom: spacing.md,
      padding: spacing.lg,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    museumTitle: {
      fontWeight: 'bold',
      marginBottom: spacing.sm,
      color: '#667eea',
    },
    museumDescription: {
      color: '#666',
      lineHeight: fontSizes.md * 1.4,
    },
    cathedralCard: {
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.lg,
      marginBottom: spacing.md,
      overflow: 'hidden',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    cathedralImage: {
      width: '100%',
      height: responsiveHeight(25),
    },
    cathedralContent: {
      padding: spacing.lg,
    },
    cathedralTitle: {
      fontWeight: 'bold',
      marginBottom: spacing.sm,
      color: '#667eea',
    },
    cathedralDescription: {
      color: '#666',
      lineHeight: fontSizes.md * 1.4,
    },
    patagCard: {
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.lg,
      marginBottom: spacing.md,
      overflow: 'hidden',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    patagImage: {
      width: '100%',
      height: responsiveHeight(20),
    },
    patagContent: {
      padding: spacing.lg,
    },
    patagTitle: {
      fontWeight: 'bold',
      marginBottom: spacing.sm,
      color: '#667eea',
    },
    patagDescription: {
      color: '#666',
      lineHeight: fontSizes.md * 1.4,
    },
    magiklandCard: {
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.lg,
      marginBottom: spacing.xl,
      overflow: 'hidden',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    magiklandImage: {
      width: '100%',
      height: responsiveHeight(20),
    },
    magiklandContent: {
      padding: spacing.lg,
    },
    magiklandTitle: {
      fontWeight: 'bold',
      marginBottom: spacing.sm,
      color: '#667eea',
    },
    magiklandDescription: {
      color: '#666',
      lineHeight: fontSizes.md * 1.4,
    },
    // Horizontal card styles for Top Things to Do
    horizontalCard: {
      width: getResponsiveWidth(isSmallScreen ? 75 : 70),
      marginRight: spacing.md,
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.xl,
      overflow: 'hidden',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(102, 126, 234, 0.1)',
    },
    horizontalCardImage: {
      width: '100%',
      height: responsiveHeight(dimensions.height < 700 ? 20 : 24),
    },
    horizontalCardContent: {
      padding: spacing.md,
      backgroundColor: '#fff',
    },
    horizontalCardTitle: {
      fontWeight: 'bold',
      marginBottom: spacing.xs,
      fontSize: fontSizes.md,
      lineHeight: fontSizes.md * 1.3,
      color: '#333',
    },
    horizontalCardDescription: {
      color: '#666',
      fontSize: fontSizes.sm,
      lineHeight: fontSizes.sm * 1.4,
    },
    // Food section styles
    sectionDescription: {
      marginBottom: spacing.lg,
      lineHeight: fontSizes.md * 1.4,
    },
    foodCard: {
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.lg,
      marginBottom: spacing.md,
      overflow: 'hidden',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    foodImage: {
      width: '100%',
      height: responsiveHeight(20),
    },
    foodContent: {
      padding: spacing.lg,
    },
    foodTitle: {
      fontWeight: 'bold',
      marginBottom: spacing.sm,
    },
    foodDescription: {
      color: '#666',
      lineHeight: fontSizes.sm * 1.4,
      marginBottom: spacing.xs,
    },
    // Stay section styles
    stayCard: {
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.lg,
      marginBottom: spacing.md,
      overflow: 'hidden',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    stayImage: {
      width: '100%',
      height: responsiveHeight(20),
    },
    stayContent: {
      padding: spacing.lg,
    },
    stayDescription: {
      color: '#666',
      lineHeight: fontSizes.sm * 1.4,
    },
    // Welcome Modal styles
    welcomeModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.md,
    },
    welcomeModalCard: {
      width: isSmallScreen ? '98%' : '95%',
      maxWidth: isSmallScreen ? dimensions.width - 20 : 400,
      maxHeight: dimensions.height * 0.85,
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.xl,
      overflow: 'hidden',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
    },
    welcomeModalHeader: {
      backgroundColor: '#667eea',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    welcomeModalTitle: {
      color: '#fff',
      fontWeight: 'bold',
      textAlign: 'center',
      fontSize: fontSizes.lg,
    },
    welcomeModalContent: {
      padding: spacing.md,
      maxHeight: dimensions.height * 0.6,
    },
    welcomeModalText: {
      color: '#333',
      lineHeight: fontSizes.sm * 1.4,
      marginBottom: spacing.sm,
      fontSize: fontSizes.sm,
    },
    welcomeModalButton: {
      backgroundColor: '#667eea',
      borderRadius: borderRadiusValues.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.sm,
      minHeight: minTouchTarget,
    },
    welcomeModalButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: fontSizes.md,
    },
    // Detail Modal styles (matching HomeScreen design)
    detailModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailModalCard: {
      width: getResponsiveWidth(85),
      maxHeight: responsiveHeight(80),
      backgroundColor: '#fff',
      borderRadius: borderRadiusValues.xl,
      overflow: 'hidden',
    },
    detailModalContent: {
      padding: spacing.lg,
    },
    detailModalTitle: {
      fontWeight: 'bold',
      color: '#333',
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    detailModalImageContainer: {
      position: 'relative',
      width: getResponsiveWidth(75),
      height: responsiveHeight(25),
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
    },
    detailModalImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
      borderRadius: borderRadiusValues.md,
      borderWidth: 1,
      borderColor: '#000',
    },
    detailModalDescription: {
      color: '#333',
      marginTop: spacing.xs,
      lineHeight: fontSizes.md * 1.4,
    },
     detailModalCloseButton: {
       backgroundColor: '#667eea',
       borderRadius: borderRadiusValues.md,
       paddingVertical: spacing.sm,
       paddingHorizontal: spacing.lg,
       alignItems: 'center',
       marginTop: spacing.sm,
       width: '100%',
       minHeight: minTouchTarget,
     },
    detailModalCloseButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: fontSizes.md,
    },
    detailModalImageCarousel: {
      width: '100%',
      height: responsiveHeight(29),
      alignItems: 'center',
    },
     detailModalImageItem: {
       width: getResponsiveWidth(75),
       height: responsiveHeight(25),
       marginHorizontal: spacing.lg,
       marginTop: spacing.lg,
       position: 'relative',
     },
     detailModalImageNameOverlay: {
       position: 'absolute',
       bottom: 0,
       left: 0,
       right: 0,
       backgroundColor: 'rgba(0,0,0,0.7)',
       paddingVertical: spacing.sm,
       paddingHorizontal: spacing.md,
       borderBottomLeftRadius: borderRadiusValues.md,
       borderBottomRightRadius: borderRadiusValues.md,
     },
     detailModalImageName: {
       color: '#fff',
       fontWeight: 'bold',
       textAlign: 'center',
       fontSize: fontSizes.sm,
     },
     detailModalSwipeIndicator: {
       position: 'absolute',
       top: spacing.sm,
       right: spacing.sm,
       backgroundColor: 'rgba(0,0,0,0.6)',
       borderRadius: borderRadiusValues.sm,
       paddingHorizontal: spacing.sm,
       paddingVertical: spacing.xs,
       flexDirection: 'row',
       alignItems: 'center',
     },
     detailModalSwipeText: {
       color: '#fff',
       fontSize: fontSizes.xs,
       marginLeft: spacing.xs,
     },
  }), [spacing, fontSizes, iconSizes, borderRadiusValues, dimensions, isSmallScreen, isSmallDevice, minTouchTarget, headerPaddingTop, getResponsiveWidth, getResponsiveHeight, responsiveHeight]);

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={{flex: 1}}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <ResponsiveView style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={iconSizes.lg} color={theme === 'dark' ? '#FFF' : '#333'} />
          </TouchableOpacity>
          <ResponsiveText size="lg" weight="bold" color={theme === 'dark' ? '#FFF' : '#333'} style={styles.headerTitle}>
            Discover Silay City
          </ResponsiveText>
        </ResponsiveView>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingBottom: dimensions.height < 700 ? responsiveHeight(12) : responsiveHeight(15),
            paddingTop: spacing.sm
          }}
        >
          {/* Hero Video Section */}
          <ResponsiveView style={styles.heroVideoSection}>
            <View style={styles.videoContainer}>
              <VideoView
                player={player}
                style={styles.heroVideo}
                contentFit="cover"
                nativeControls={false}
                allowsFullscreen={false}
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.videoOverlay}
              />
              <View style={styles.videoContent}>
                <ResponsiveText size="xxl" weight="bold" color="#fff" style={styles.heroVideoTitle}>
                  Discover Silay City
                </ResponsiveText>
                <ResponsiveText size="lg" color="#fff" style={styles.heroVideoSubtitle}>
                  Heritage • Culture • Beauty
                </ResponsiveText>
                <View style={styles.highlightBadge}>
                  <Ionicons name="star" size={iconSizes.md} color="#FFD700" />
                  <ResponsiveText size="md" weight="bold" color="#fff" style={styles.highlightText}>
                    The Paris of Negros
                  </ResponsiveText>
                </View>
              </View>
              <TouchableOpacity
                style={styles.playPauseButton}
                onPress={() => {
                  if (player.playing) {
                    player.pause();
                  } else {
                    player.play();
                  }
                }}
              >
                <Ionicons 
                  name={player.playing ? "pause" : "play"} 
                  size={iconSizes.md} 
                  color="#fff" 
                />
              </TouchableOpacity>
            </View>
          </ResponsiveView>

          {/* Top Things to Do Section */}
          <ResponsiveView style={styles.section}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionTitleGradient}
              >
                <Ionicons name="star" size={iconSizes.md} color="#FFD700" style={styles.sectionIcon} />
                <ResponsiveText size="xl" weight="bold" color="#fff" style={styles.sectionTitleText}>
                  TOP THINGS TO DO
                </ResponsiveText>
              </LinearGradient>
            </View>
            
            <FlatList
              data={topThingsToDo}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ 
                paddingHorizontal: spacing.md,
                paddingRight: spacing.lg // Extra padding on the right for last item
              }}
               renderItem={({ item, index }) => (
                 <TouchableOpacity 
                   style={styles.horizontalCard}
                   onPress={() => {
                     setSelectedItem(item);
                     setCurrentImageIndex(0);
                     setDetailModalVisible(true);
                   }}
                 >
                   {item.images ? (
                     // Swipeable images for 3 Lifestyle Museums
                     <View style={styles.horizontalCardImage}>
                       <FlatList
                         data={item.images}
                         horizontal
                         pagingEnabled
                         showsHorizontalScrollIndicator={false}
                         keyExtractor={(imageItem, imageIndex) => `${item.id}-${imageIndex}`}
                           renderItem={({ item: imageItem }) => (
                             <ImageBackground
                               source={imageItem.image}
                               style={styles.horizontalCardImage}
                               imageStyle={{ borderRadius: borderRadiusValues.lg }}
                             >
                               <View style={styles.heroOverlay} />
                               <View style={styles.heroContent}>
                                 <ResponsiveText size="sm" weight="bold" color="#fff" style={styles.heroTitle}>
                                   {index + 1}. {item.title}
                                 </ResponsiveText>
                               </View>
                             </ImageBackground>
                           )}
                       />
                     </View>
                   ) : (
                     // Single image for other items
                     <ImageBackground
                       source={item.image}
                       style={styles.horizontalCardImage}
                       imageStyle={{ borderRadius: borderRadiusValues.lg }}
                     >
                       <View style={styles.heroOverlay} />
                       <View style={styles.heroContent}>
                         <ResponsiveText size="sm" weight="bold" color="#fff" style={styles.heroTitle}>
                           {index + 1}. {item.title}
                         </ResponsiveText>
                       </View>
                     </ImageBackground>
                   )}
                 </TouchableOpacity>
               )}
            />
          </ResponsiveView>

          {/* FOOD Section */}
          <ResponsiveView style={styles.section}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={['#f093fb', '#f5576c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionTitleGradient}
              >
                <Ionicons name="restaurant" size={iconSizes.md} color="#fff" style={styles.sectionIcon} />
                <ResponsiveText size="xl" weight="bold" color="#fff" style={styles.sectionTitleText}>
                  FOOD
                </ResponsiveText>
              </LinearGradient>
            </View>
            
            <FlatList
              data={foodData}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ 
                paddingHorizontal: spacing.md,
                paddingRight: spacing.lg // Extra padding on the right for last item
              }}
              renderItem={({ item }) => (
                 <TouchableOpacity 
                   style={styles.horizontalCard}
                   onPress={() => {
                     setSelectedItem(item);
                     setCurrentImageIndex(0);
                     setDetailModalVisible(true);
                   }}
                 >
                   {item.images ? (
                    // Swipeable images for Emma Lacson's delicacies
                    <View style={styles.horizontalCardImage}>
                      <FlatList
                        data={item.images}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(image, index) => `${item.id}-${index}`}
                         renderItem={({ item: imageItem }) => (
                           <ImageBackground
                             source={imageItem.image || imageItem}
                             style={styles.horizontalCardImage}
                             imageStyle={{ borderRadius: borderRadiusValues.lg }}
                           >
                             <View style={styles.heroOverlay} />
                             <View style={styles.heroContent}>
                               <ResponsiveText size="sm" weight="bold" color="#fff" style={styles.heroTitle}>
                                 {item.title}
                               </ResponsiveText>
                             </View>
                           </ImageBackground>
                         )}
                      />
                    </View>
                  ) : (
                    // Single image for other items
                    <ImageBackground
                      source={item.image}
                      style={styles.horizontalCardImage}
                      imageStyle={{ borderRadius: borderRadiusValues.lg }}
                    >
                      <View style={styles.heroOverlay} />
                      <View style={styles.heroContent}>
                        <ResponsiveText size="sm" weight="bold" color="#fff" style={styles.heroTitle}>
                          {item.title}
                        </ResponsiveText>
                      </View>
                    </ImageBackground>
                  )}
                </TouchableOpacity>
              )}
            />
          </ResponsiveView>

          {/* WHERE TO STAY Section */}
          <ResponsiveView style={styles.section}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={['#4facfe', '#00f2fe']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionTitleGradient}
              >
                <Ionicons name="bed" size={iconSizes.md} color="#fff" style={styles.sectionIcon} />
                <ResponsiveText size="xl" weight="bold" color="#fff" style={styles.sectionTitleText}>
                  WHERE TO STAY
                </ResponsiveText>
              </LinearGradient>
            </View>
            
            <FlatList
              data={stayData}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ 
                paddingHorizontal: spacing.md,
                paddingRight: spacing.lg // Extra padding on the right for last item
              }}
              renderItem={({ item }) => (
                 <TouchableOpacity 
                   style={styles.horizontalCard}
                   onPress={() => {
                     setSelectedItem(item);
                     setCurrentImageIndex(0);
                     setDetailModalVisible(true);
                   }}
                 >
                   <ImageBackground
                     source={item.image}
                     style={styles.horizontalCardImage}
                     imageStyle={{ borderRadius: borderRadiusValues.lg }}
                   >
                    <View style={styles.heroOverlay} />
                    <View style={styles.heroContent}>
                      <ResponsiveText size="sm" weight="bold" color="#fff" style={styles.heroTitle}>
                        {item.title}
                      </ResponsiveText>
                    </View>
                  </ImageBackground>
                </TouchableOpacity>
              )}
            />
          </ResponsiveView>
        </ScrollView>
      </SafeAreaView>

      {/* Welcome Modal */}
      <Modal
        visible={welcomeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setWelcomeModalVisible(false)}
      >
        <View style={styles.welcomeModalOverlay}>
          <View style={styles.welcomeModalCard}>
            <View style={styles.welcomeModalHeader}>
              <ResponsiveText size="lg" weight="bold" color="#fff" style={styles.welcomeModalTitle}>
                WELCOME TO SILAY CITY
              </ResponsiveText>
            </View>
            <View style={styles.welcomeModalContent}>
              <ResponsiveText size="md" color="#333" style={styles.welcomeModalText}>
                Silay City is a tourist destination in the province of Negros Occidental. Its heritage district is known for its ancestral houses recognized by the National Historical Commission of the Philippines as historical landmarks.
              </ResponsiveText>
              <ResponsiveText size="md" color="#333" style={styles.welcomeModalText}>
                At the turn of the 20th century, Silay prospered and rose to economic and cultural prominence when Negros island's sugar industry entered its golden age. Many of these sugar plantation owners or hacenderos established their residences in Silay, influencing the town's history, culture, arts and identity.
              </ResponsiveText>
              <ResponsiveText size="md" color="#333" style={styles.welcomeModalText}>
                Today, traces of Silay's rich past continue to linger in the architectural styles of its heritage buildings, in its cuisine and the consciousness of its people. Silay City welcomes everyone seeking to experience old world charm and hospitality.
              </ResponsiveText>
              <TouchableOpacity
                style={styles.welcomeModalButton}
                onPress={() => setWelcomeModalVisible(false)}
              >
                <ResponsiveText size="md" weight="bold" color="#fff" style={styles.welcomeModalButtonText}>
                  Explore Silay City
                </ResponsiveText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailModalCard}>
             {/* Image Carousel */}
             <View style={styles.detailModalImageCarousel}>
               <FlatList
                 data={selectedItem?.images || [selectedItem?.image]}
                 horizontal
                 pagingEnabled
                 showsHorizontalScrollIndicator={false}
                 keyExtractor={(imageItem, index) => `${selectedItem?.id}-${index}`}
                 onMomentumScrollEnd={(event) => {
                   const index = Math.round(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
                   setCurrentImageIndex(index);
                 }}
                 renderItem={({ item: imageItem }) => (
                   <View style={styles.detailModalImageContainer}>
                     <Image
                       source={imageItem.image || imageItem}
                       style={styles.detailModalImage}
                       resizeMode="cover"
                     />
                     {/* Swipe indicator - only show if there are multiple images */}
                     {selectedItem?.images && selectedItem.images.length > 1 && (
                       <View style={styles.detailModalSwipeIndicator}>
                         <Ionicons name="swap-horizontal" size={iconSizes.sm} color="#fff" />
                         <ResponsiveText size="xs" color="#fff" style={styles.detailModalSwipeText}>
                           Swipe
                         </ResponsiveText>
                       </View>
                     )}
                   </View>
                 )}
               />
             </View>
            
             <View style={styles.detailModalContent}>
               <ResponsiveText size="lg" weight="bold" color="#333" style={styles.detailModalTitle}>
                 {selectedItem?.images && selectedItem.images[currentImageIndex]?.name 
                   ? selectedItem.images[currentImageIndex].name
                   : selectedItem?.title
                 }
               </ResponsiveText>
               
               <ResponsiveText size="md" color="#333" style={styles.detailModalDescription}>
                 {selectedItem?.images && selectedItem.images[currentImageIndex]?.description 
                   ? selectedItem.images[currentImageIndex].description
                   : selectedItem?.description
                 }
               </ResponsiveText>
              
              <TouchableOpacity 
                style={styles.detailModalCloseButton} 
                onPress={() => setDetailModalVisible(false)}
              >
                <ResponsiveText size="md" weight="bold" color="#fff" style={styles.detailModalCloseButtonText}>
                  Close
                </ResponsiveText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

export default DiscoverSilayScreen;
