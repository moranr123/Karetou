import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import PointsService from '../../services/PointsService';

const { width, height } = Dimensions.get('window');

const QRScannerScreen = () => {
  const navigation = useNavigation();
  const { theme, user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const pointsService = PointsService.getInstance();
  const isProcessingRef = useRef(false);

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

  if (!permission) {
    return (
      <LinearGradient colors={['#F5F5F5', '#F5F5F5']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>Requesting camera permission...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!permission.granted) {
    return (
      <LinearGradient colors={['#F5F5F5', '#F5F5F5']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFF' : '#000'} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>QR Scanner</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={80} color="#667eea" />
            <Text style={styles.permissionTitle}>Camera Permission Required</Text>
            <Text style={styles.permissionText}>
              We need access to your camera to scan QR codes.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#F5F5F5', '#F5F5F5']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFF' : '#000'} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>QR Scanner</Text>
          <TouchableOpacity
            onPress={toggleCameraFacing}
            style={styles.flipButton}
          >
            <Ionicons name="camera-reverse-outline" size={24} color={theme === 'dark' ? '#FFF' : '#000'} />
          </TouchableOpacity>
        </View>

        <View style={styles.cameraContainer}>
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
              <Text style={styles.instructionText}>
                Position the QR code within the frame
              </Text>
            </View>
          </CameraView>
        </View>

        {scanned && (
          <TouchableOpacity
            style={styles.scanAgainButton}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.scanAgainButtonText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  flipButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: 40,
  },
  cameraContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 20,
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
    width: width * 0.7,
    height: width * 0.7,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#667eea',
    borderWidth: 4,
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
    fontSize: 16,
    marginTop: 30,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  scanAgainButton: {
    backgroundColor: '#667eea',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  scanAgainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#667eea',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default QRScannerScreen;

