import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

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

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleSkip}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.headerGradient}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="heart" size={50} color="#fff" />
            </View>
            <Text style={styles.title}>What interests you?</Text>
            <Text style={styles.subtitle}>
              Select your preferences to get personalized recommendations
            </Text>
          </LinearGradient>

          <ScrollView style={styles.categoriesContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.categoriesList}>
              {businessCategories.map((category) => {
                const isSelected = selectedPreferences.includes(category);
                return (
                  <TouchableOpacity
                    key={category}
                    style={styles.checkboxRow}
                    onPress={() => togglePreference(category)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.checkboxContainer}>
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={28}
                        color={isSelected ? '#667eea' : '#999'}
                      />
                    </View>
                    <Text style={styles.checkboxLabel}>{category}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.selectionCount}>
              {selectedPreferences.length} {selectedPreferences.length === 1 ? 'preference' : 'preferences'} selected
            </Text>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
              >
                <Text style={styles.skipButtonText}>Skip for now</Text>
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
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Save Preferences</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
    flexDirection: 'column',
  },
  headerGradient: {
    paddingTop: 25,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  categoriesContainer: {
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
  },
  categoriesList: {
    flexDirection: 'column',
    paddingBottom: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  checkboxContainer: {
    marginRight: 15,
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  footer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  selectionCount: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default UserPreferencesModal;
