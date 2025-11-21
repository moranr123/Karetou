import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import PointsService from '../../services/PointsService';
import { useResponsive } from '../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../components';

const QRScannerScreen = () => {
  const navigation = useNavigation();
  const { theme, user } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius: borderRadiusValues, getResponsiveWidth, getResponsiveHeight, dimensions, responsiveHeight, responsiveWidth } = useResponsive();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const pointsService = PointsService.getInstance();
  const isProcessingRef = useRef(false);
  
  // Device size detection with fallbacks
  const isSmallScreen = (dimensions?.width || 360) < 360;
  const isSmallDevice = dimensions?.isSmallDevice || false;
  const minTouchTarget = 44;
  
  // Calculate header padding with fallbacks
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const headerPaddingTop = Platform.OS === 'ios' 
    ? (spacing?.md || 12) + (isSmallDevice ? (spacing?.xs || 4) : (spacing?.sm || 8))
    : statusBarHeight + (spacing?.sm || 8);
  
  // Calculate scan area size (responsive square) with fallbacks
  const screenWidth = dimensions?.width || 360;
  const screenHeight = dimensions?.height || 640;
  const scanAreaSize = Math.min(screenWidth * 0.7, screenHeight * 0.4);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  // Reset scanned state when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      isProcessingRef.current = false;
    }, [])
  );

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    // Prevent multiple simultaneous scans
    if (scanned || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    setScanned(true);
    
    try {
      // Try to parse the QR code data as JSON
      const qrData = JSON.parse(data);
      
      // Check if it's a business QR code
      if (qrData.type === 'business') {
        try {
          // Fetch full business data from Firestore
          const businessDoc = await getDoc(doc(db, 'businesses', qrData.id));
          
          if (businessDoc.exists()) {
            const businessData = businessDoc.data();
            
            console.log('📱 QR Code Scanned - Business found:', businessData.businessName || qrData.name);
            
            // Format business data for review form
            const businessForReview = {
              id: qrData.id,
              name: qrData.name || businessData.businessName,
              businessName: businessData.businessName || qrData.name,
              businessType: qrData.businessType || businessData.selectedType,
              selectedType: businessData.selectedType || qrData.businessType,
              address: qrData.address || businessData.businessAddress,
              businessAddress: businessData.businessAddress || qrData.address,
              contact: qrData.contact || businessData.contactNumber,
              contactNumber: businessData.contactNumber || qrData.contact,
            };
            
            // Check if user has already reviewed this business
            let hasReviewed = false;
            if (user?.uid) {
              const reviewsRef = collection(db, 'businesses', qrData.id, 'reviews');
              const reviewQuery = query(reviewsRef, where('userId', '==', user.uid));
              const reviewSnapshot = await getDocs(reviewQuery);
              hasReviewed = !reviewSnapshot.empty;
            }
            
            // Award points for scanning (if user is logged in)
            let pointsResult = null;
            if (user?.uid) {
              pointsResult = await pointsService.awardPointsForScan(user.uid, qrData.id);
            }
            
            // If user has already reviewed, show message and don't open review form
            if (hasReviewed) {
              Alert.alert(
                'Already Reviewed',
                'You have already reviewed this business. Thank you for your feedback!',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      setScanned(false);
                      isProcessingRef.current = false;
                    },
                  },
                ]
              );
              
              // Show points message if applicable
              if (pointsResult) {
                setTimeout(() => {
                  if (pointsResult.success) {
                    Alert.alert('Points Earned!', pointsResult.message);
                  } else {
                    Alert.alert('Scan Info', pointsResult.message);
                  }
                }, 500);
              }
              return;
            }
            
            console.log('📱 Navigating to ReviewsScreen with business:', businessForReview);
            
            // Navigate first
            (navigation as any).navigate('ReviewsScreen', {
              businessFromQR: businessForReview,
            });
            
            // Show points message after navigation (only once)
            if (pointsResult) {
              setTimeout(() => {
                if (pointsResult.success) {
                  Alert.alert('Points Earned!', pointsResult.message);
                } else {
                  Alert.alert('Scan Info', pointsResult.message);
                }
              }, 500);
            }
          } else {
            Alert.alert(
              'Business Not Found',
              'The scanned business could not be found in our system.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    setScanned(false);
                    isProcessingRef.current = false;
                  },
                },
              ]
            );
          }
        } catch (error) {
          console.error('Error fetching business data:', error);
          Alert.alert(
            'Error',
            'Failed to load business information. Please try again.',
            [
              {
                text: 'OK',
                onPress: () => {
                  setScanned(false);
                  isProcessingRef.current = false;
                },
              },
            ]
          );
        }
      } else {
        Alert.alert('QR Code Scanned', `Data: ${data}`, [
          {
            text: 'OK',
            onPress: () => {
              setScanned(false);
              isProcessingRef.current = false;
            },
          },
        ]);
      }
    } catch (error) {
      // If it's not JSON, treat it as plain text
      Alert.alert('QR Code Scanned', `Data: ${data}`, [
        {
          text: 'OK',
          onPress: () => {
            setScanned(false);
            isProcessingRef.current = false;
          },
        },
      ]);
    } finally {
      // Reset processing flag after a delay to allow navigation
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 2000);
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  // Create responsive styles using useMemo
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      paddingTop: headerPaddingTop,
      paddingBottom: spacing?.sm || 8,
      backgroundColor: 'transparent',
    },
    backButton: {
      width: minTouchTarget,
      height: minTouchTarget,
      borderRadius: minTouchTarget / 2,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: fontSizes?.lg || 18,
      fontWeight: 'bold',
      color: '#000',
    },
    flipButton: {
      width: minTouchTarget,
      height: minTouchTarget,
      borderRadius: minTouchTarget / 2,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholder: {
      width: minTouchTarget,
    },
    cameraContainer: {
      flex: 1,
      margin: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      borderRadius: borderRadiusValues?.xl || 20,
      overflow: 'hidden',
    },
    camera: {
      flex: 1,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    scanArea: {
      width: scanAreaSize,
      height: scanAreaSize,
      position: 'relative',
    },
    corner: {
      position: 'absolute',
      width: Math.max(24, Math.min(screenWidth * 0.08, 36)),
      height: Math.max(24, Math.min(screenWidth * 0.08, 36)),
      borderColor: '#667eea',
      borderWidth: Math.max(3, Math.min(screenWidth * 0.01, 5)),
    },
    topLeft: {
      top: 0,
      left: 0,
      borderRightWidth: 0,
      borderBottomWidth: 0,
    },
    topRight: {
      top: 0,
      right: 0,
      borderLeftWidth: 0,
      borderBottomWidth: 0,
    },
    bottomLeft: {
      bottom: 0,
      left: 0,
      borderRightWidth: 0,
      borderTopWidth: 0,
    },
    bottomRight: {
      bottom: 0,
      right: 0,
      borderLeftWidth: 0,
      borderTopWidth: 0,
    },
    instructionText: {
      color: '#fff',
      fontSize: fontSizes?.md || 16,
      marginTop: spacing?.lg || 16,
      textAlign: 'center',
      paddingHorizontal: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
    },
    scanAgainButton: {
      backgroundColor: '#667eea',
      marginHorizontal: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      marginBottom: spacing?.md || 12,
      paddingVertical: spacing?.md || 12,
      borderRadius: borderRadiusValues?.md || 12,
      alignItems: 'center',
      minHeight: minTouchTarget,
      justifyContent: 'center',
    },
    scanAgainButtonText: {
      color: '#fff',
      fontSize: fontSizes?.md || 16,
      fontWeight: '600',
    },
    permissionContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: isSmallScreen ? (spacing?.md || 12) : (spacing?.xl || 24),
    },
    permissionTitle: {
      fontSize: fontSizes?.xxl || 24,
      fontWeight: 'bold',
      color: '#000',
      marginTop: spacing?.lg || 16,
      marginBottom: spacing?.sm || 8,
      textAlign: 'center',
    },
    permissionText: {
      fontSize: fontSizes?.md || 16,
      color: '#666',
      textAlign: 'center',
      marginBottom: spacing?.xl || 24,
      lineHeight: (fontSizes?.md || 16) * 1.5,
    },
    permissionButton: {
      backgroundColor: '#667eea',
      paddingVertical: spacing?.md || 12,
      paddingHorizontal: spacing?.xl || 24,
      borderRadius: borderRadiusValues?.md || 12,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    permissionButtonText: {
      color: '#fff',
      fontSize: fontSizes?.md || 16,
      fontWeight: '600',
    },
  }), [spacing, fontSizes, iconSizes, borderRadiusValues, dimensions, isSmallScreen, isSmallDevice, minTouchTarget, headerPaddingTop, scanAreaSize, screenWidth]);

  if (!permission) {
    return (
      <LinearGradient colors={['#F5F5F5', '#F5F5F5']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ResponsiveView style={styles.permissionContainer}>
            <ResponsiveText size="md" color="#666" style={styles.permissionText}>Requesting camera permission...</ResponsiveText>
          </ResponsiveView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!permission.granted) {
    return (
      <LinearGradient colors={['#F5F5F5', '#F5F5F5']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ResponsiveView style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={iconSizes?.md || 24} color={theme === 'dark' ? '#FFF' : '#000'} />
            </TouchableOpacity>
            <ResponsiveText size="lg" weight="bold" color="#000" style={styles.headerTitle}>QR Scanner</ResponsiveText>
            <View style={styles.placeholder} />
          </ResponsiveView>
          <ResponsiveView style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={iconSizes?.xxxxl || 80} color="#667eea" />
            <ResponsiveText size="xxl" weight="bold" color="#000" style={styles.permissionTitle}>Camera Permission Required</ResponsiveText>
            <ResponsiveText size="md" color="#666" style={styles.permissionText}>
              We need access to your camera to scan QR codes.
            </ResponsiveText>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
            >
              <ResponsiveText size="md" weight="600" color="#fff" style={styles.permissionButtonText}>Grant Permission</ResponsiveText>
            </TouchableOpacity>
          </ResponsiveView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#F5F5F5', '#F5F5F5']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ResponsiveView style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={iconSizes?.md || 24} color={theme === 'dark' ? '#FFF' : '#000'} />
          </TouchableOpacity>
          <ResponsiveText size="lg" weight="bold" color="#000" style={styles.headerTitle}>QR Scanner</ResponsiveText>
          <TouchableOpacity
            onPress={toggleCameraFacing}
            style={styles.flipButton}
          >
            <Ionicons name="camera-reverse-outline" size={iconSizes?.md || 24} color={theme === 'dark' ? '#FFF' : '#000'} />
          </TouchableOpacity>
        </ResponsiveView>

        <ResponsiveView style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing={facing}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          >
            <View style={styles.overlay}>
              <View style={styles.scanArea}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              <ResponsiveText size="md" color="#fff" style={styles.instructionText}>
                Position the QR code within the frame
              </ResponsiveText>
            </View>
          </CameraView>
        </ResponsiveView>

        {scanned && (
          <TouchableOpacity
            style={styles.scanAgainButton}
            onPress={() => setScanned(false)}
          >
            <ResponsiveText size="md" weight="600" color="#fff" style={styles.scanAgainButtonText}>Tap to Scan Again</ResponsiveText>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

export default QRScannerScreen;

