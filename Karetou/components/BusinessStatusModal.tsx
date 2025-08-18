import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

interface BusinessStatusModalProps {
  visible: boolean;
  onClose: () => void;
  status: 'approved' | 'rejected' | 'pending';
  businessName: string;
}

const BusinessStatusModal: React.FC<BusinessStatusModalProps> = ({
  visible,
  onClose,
  status,
  businessName,
}) => {
  const [scaleAnim] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getStatusConfig = () => {
    switch (status) {
      case 'approved':
        return {
          title: '🎉 Congratulations!',
          message: `Your business "${businessName}" has been approved and is now live on Karetou!`,
          subtitle: 'You can now start promoting your business and receiving customers.',
          gradient: ['#4CAF50', '#45A049'] as const,
          iconName: 'checkmark-circle',
          buttonText: 'Start Promoting',
        };
      case 'rejected':
        return {
          title: '❌ Application Not Approved',
          message: `Unfortunately, your business "${businessName}" application was not approved at this time.`,
          subtitle: 'Please contact our support team for more information and next steps.',
          gradient: ['#F44336', '#D32F2F'] as const,
          iconName: 'close-circle',
          buttonText: 'Contact Support',
        };
      case 'pending':
        return {
          title: '⏳ Under Review',
          message: `Your business "${businessName}" is being reviewed by our team.`,
          subtitle: 'We will notify you once the review is complete. Thank you for your patience.',
          gradient: ['#FF9800', '#F57C00'] as const,
          iconName: 'time',
          buttonText: 'Got it',
        };
      default:
        return {
          title: '📢 Business Update',
          message: `Your business "${businessName}" status has been updated.`,
          subtitle: 'Check your business dashboard for more details.',
          gradient: ['#667eea', '#764ba2'] as const,
          iconName: 'information-circle',
          buttonText: 'View Dashboard',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.overlayTouch} 
          activeOpacity={1} 
          onPress={onClose}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [{ scale: scaleAnim }],
              }
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <LinearGradient
                colors={config.gradient}
                style={styles.modalContent}
              >
                {/* Header Icon */}
                <View style={styles.iconContainer}>
                  <View style={styles.iconBackground}>
                    <Ionicons 
                      name={config.iconName as any} 
                      size={60} 
                      color="white" 
                    />
                  </View>
                </View>

                {/* Title */}
                <Text style={styles.title}>{config.title}</Text>

                {/* Message */}
                <Text style={styles.message}>{config.message}</Text>

                {/* Subtitle */}
                <Text style={styles.subtitle}>{config.subtitle}</Text>

                {/* Buttons */}
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={onClose}
                  >
                    <Text style={styles.primaryButtonText}>{config.buttonText}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={onClose}
                  >
                    <Text style={styles.secondaryButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouch: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalContainer: {
    width: screenWidth * 0.9,
    maxWidth: 400,
  },
  modalContent: {
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 15,
  },
  message: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 24,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default BusinessStatusModal; 