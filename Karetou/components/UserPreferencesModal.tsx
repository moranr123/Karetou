import React, { useState, useEffect } from 'react';
import {
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from './index';

const { width: screenWidth } = Dimensions.get('window');

const businessCategories = [
  'Historical Landmarks',
  'Korean BBQ',
  'Modern/Minimalist Cafés',
  'Budget-Friendly Eats',
  'Fine Dining',
  'Heritage Cafés',
  'Nature Spots',
  'Amusement',
];

interface UserPreferencesModalProps {
  visible: boolean;
  onClose: (preferences: string[]) => void;
}

const UserPreferencesModal: React.FC<UserPreferencesModalProps> = ({ visible, onClose }) => {
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
  const { spacing, fontSizes, iconSizes, borderRadius, getResponsiveWidth, getResponsiveHeight } = useResponsive();
  
  // Device size detection
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const isSmallDevice = screenWidth < 375 || screenHeight < 667;
  const isMediumDevice = screenWidth >= 375 && screenWidth <= 414;
  const isTablet = screenWidth > 768;
  
  // Responsive calculations
  const spacingMultiplier = isSmallDevice ? 0.8 : isMediumDevice ? 1 : isTablet ? 1.5 : 1.1;
  const logoSizePercent = isSmallDevice ? 16 : isMediumDevice ? 20 : isTablet ? 30 : 22;
  const inputHeight = isSmallDevice ? 6 : isMediumDevice ? 6.5 : isTablet ? 8 : 7;

  useEffect(() => {
    if (visible) {
      console.log('🎯 UserPreferencesModal is now visible');
      console.log('📋 Categories to display:', businessCategories);
    }
  }, [visible]);

  const togglePreference = (category: string) => {
    console.log('✅ Toggle preference:', category);
    if (selectedPreferences.includes(category)) {
      setSelectedPreferences(selectedPreferences.filter(item => item !== category));
      console.log('➖ Removed:', category);
    } else {
      setSelectedPreferences([...selectedPreferences, category]);
      console.log('➕ Added:', category);
    }
  };

  const handleSave = () => {
    onClose(selectedPreferences);
  };

  const handleSkip = () => {
    onClose([]);
  };

  // --- Styles ---
  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg * spacingMultiplier,
    },
    modalContainer: {
      backgroundColor: '#fff',
      borderRadius: borderRadius.xl,
      width: '100%',
      maxWidth: 500,
      maxHeight: '85%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 10,
      flexDirection: 'column',
    },
    header: {
      alignItems: 'center',
      paddingTop: spacing.xl * spacingMultiplier,
      paddingBottom: spacing.lg * spacingMultiplier,
      paddingHorizontal: spacing.lg * spacingMultiplier,
      backgroundColor: '#F5F5F5',
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
    },
    iconContainer: {
      width: getResponsiveWidth(logoSizePercent),
      height: getResponsiveWidth(logoSizePercent),
      borderRadius: getResponsiveWidth(logoSizePercent / 2),
      backgroundColor: 'rgba(102, 126, 234, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md * spacingMultiplier,
    },
    title: {
      marginBottom: spacing.sm * spacingMultiplier,
      textAlign: 'center',
    },
    subtitle: {
      textAlign: 'center',
      paddingHorizontal: spacing.md * spacingMultiplier,
    },
    categoriesContainer: {
      flexGrow: 1,
      flexShrink: 1,
      paddingHorizontal: spacing.lg * spacingMultiplier,
      paddingTop: spacing.lg * spacingMultiplier,
      paddingBottom: spacing.md * spacingMultiplier,
      backgroundColor: '#fff',
    },
    categoriesList: {
      flexDirection: 'column',
      paddingBottom: spacing.md * spacingMultiplier,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md * spacingMultiplier,
      paddingHorizontal: spacing.md * spacingMultiplier,
      backgroundColor: '#f8f9fa',
      borderRadius: borderRadius.md,
      marginBottom: spacing.md * spacingMultiplier,
      borderWidth: 1,
      borderColor: '#e0e0e0',
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    checkboxContainer: {
      marginRight: spacing.md,
    },
    checkboxLabel: {
      flex: 1,
      fontSize: fontSizes.md,
      fontWeight: '500',
    },
    footer: {
      backgroundColor: '#fff',
      padding: spacing.lg * spacingMultiplier,
      borderTopWidth: 1,
      borderTopColor: '#e0e0e0',
    },
    selectionCount: {
      fontSize: fontSizes.sm,
      textAlign: 'center',
      marginBottom: spacing.md * spacingMultiplier,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    skipButton: {
      flex: 1,
      backgroundColor: '#f8f9fa',
      paddingVertical: spacing.md * spacingMultiplier,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#ddd',
    },
    skipButtonText: {
      fontSize: fontSizes.md,
      fontWeight: '600',
    },
    saveButton: {
      flex: 1,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md * spacingMultiplier,
      gap: spacing.sm,
    },
    saveButtonText: {
      fontSize: fontSizes.md,
      fontWeight: '700',
      color: '#fff',
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleSkip}
    >
      <ResponsiveView style={styles.modalOverlay}>
        <ResponsiveView style={styles.modalContainer}>
          <ResponsiveView style={styles.header}>
            <ResponsiveView style={styles.iconContainer}>
              <Ionicons name="heart" size={iconSizes.xxl} color="#667eea" />
            </ResponsiveView>
            <ResponsiveText size={isSmallDevice ? "xl" : isTablet ? "xxxl" : "xxl"} weight="bold" color="#000" style={styles.title}>
              What interests you?
            </ResponsiveText>
            <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} color="#666" style={styles.subtitle}>
              Select your preferences to get personalized recommendations
            </ResponsiveText>
          </ResponsiveView>

          <ScrollView style={styles.categoriesContainer} showsVerticalScrollIndicator={false}>
            <ResponsiveView style={styles.categoriesList}>
              {businessCategories.map((category) => {
                const isSelected = selectedPreferences.includes(category);
                return (
                  <TouchableOpacity
                    key={category}
                    style={styles.checkboxRow}
                    onPress={() => togglePreference(category)}
                    activeOpacity={0.7}
                  >
                    <ResponsiveView style={styles.checkboxContainer}>
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={iconSizes.lg}
                        color={isSelected ? '#667eea' : '#999'}
                      />
                    </ResponsiveView>
                    <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "md"} weight="500" color="#333" style={styles.checkboxLabel}>
                      {category}
                    </ResponsiveText>
                  </TouchableOpacity>
                );
              })}
            </ResponsiveView>
          </ScrollView>

          <ResponsiveView style={styles.footer}>
            <ResponsiveText size={isSmallDevice ? "xs" : isTablet ? "sm" : "sm"} color="#666" style={styles.selectionCount}>
              {selectedPreferences.length} {selectedPreferences.length === 1 ? 'preference' : 'preferences'} selected
            </ResponsiveText>
            
            <ResponsiveView style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
              >
                <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "md"} weight="600" color="#666" style={styles.skipButtonText}>
                  Skip for now
                </ResponsiveText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  selectedPreferences.length === 0 && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={selectedPreferences.length === 0}
              >
                <LinearGradient
                  colors={selectedPreferences.length > 0 ? ['#4CAF50', '#45a049'] : ['#ccc', '#999']}
                  style={styles.saveButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="checkmark-circle" size={iconSizes.md} color="#fff" />
                  <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "md"} weight="700" color="#fff" style={styles.saveButtonText}>
                    Save Preferences
                  </ResponsiveText>
                </LinearGradient>
              </TouchableOpacity>
            </ResponsiveView>
          </ResponsiveView>
        </ResponsiveView>
      </ResponsiveView>
    </Modal>
  );
};


export default UserPreferencesModal;
