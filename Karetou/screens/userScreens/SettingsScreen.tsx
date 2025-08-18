import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { deleteUser } from "firebase/auth";

const { width, height } = Dimensions.get('window');
const FONT_SCALE = Math.min(width, height) / 400;

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

interface SettingRowProps {
  icon: any;
  name: string;
  description?: string;
  children?: React.ReactNode;
}

const SettingsScreen = () => {
  const { theme, toggleTheme } = useAuth();

  const lightGradient = ['#667eea', '#764ba2'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "OK", 
          onPress: () => {
            auth.signOut().catch(error => Alert.alert('Logout Error', error.message));
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action is irreversible. Are you sure you want to delete your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.prompt(
              "Confirm Deletion",
              'To confirm, please type "DELETE" in the box below.',
              (text) => {
                if (text === "DELETE") {
                  const user = auth.currentUser;
                  if (user) {
                    deleteUser(user).catch((error) => {
                      Alert.alert("Error", "This operation requires recent authentication. Please log out and log back in to proceed.");
                    });
                  }
                } else {
                  Alert.alert("Error", "The text you entered was incorrect. Account deletion cancelled.");
                }
              }
            );
          },
        },
      ]
    );
  };

  const Section = ({ title, children }: SectionProps) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme === 'dark' ? '#FFF' : 'rgba(255, 255, 255, 0.9)' }]}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );

  const SettingRow = ({ icon, name, description, children }: SettingRowProps) => (
    <View style={styles.row}>
      <View style={styles.rowIconContainer}>
        <Feather name={icon} size={20 * FONT_SCALE} color="#5A67D8" />
      </View>
      <View style={styles.rowTextContainer}>
        <Text style={styles.rowName}>{name}</Text>
        {description && <Text style={styles.rowDescription}>{description}</Text>}
      </View>
      {children}
    </View>
  );

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={width * 0.1} color="#fff" />
            </View>
            <View style={styles.profileTextContainer}>
              <Text style={[styles.profileName, { color: theme === 'dark' ? '#FFF' : '#fff' }]}>keith</Text>
              <Text style={[styles.profileHandle, { color: theme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.8)' }]}>@keith</Text>
            </View>
            <TouchableOpacity style={styles.editProfileButton}>
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Preferences Section */}
          <Section title="Preferences">
            <SettingRow key="dark" icon="moon" name="Dark Mode" description="Switch to dark theme">
              <Switch
                value={theme === 'dark'}
                onValueChange={toggleTheme}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={theme === 'dark' ? '#5A67D8' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
              />
            </SettingRow>
          </Section>

          {/* Support Section */}
          <Section title="Support">
            <TouchableOpacity>
              <SettingRow icon="help-circle" name="Help & Support" description="Get help and contact support">
                <Feather name="chevron-right" size={20 * FONT_SCALE} color="#C0C0C0" />
              </SettingRow>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity>
              <SettingRow icon="info" name="About" description="App version and information">
                <Feather name="chevron-right" size={20 * FONT_SCALE} color="#C0C0C0" />
              </SettingRow>
            </TouchableOpacity>
          </Section>

          {/* Account Section */}
          <Section title="Account">
            <TouchableOpacity onPress={handleLogout}>
              <SettingRow icon="log-out" name="Logout" description="Sign out of your account" />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity onPress={handleDeleteAccount}>
              <View style={styles.row}>
                <View style={[styles.rowIconContainer, { backgroundColor: '#FED7D7' }]}>
                  <Feather name="trash-2" size={20 * FONT_SCALE} color="#C53030" />
                </View>
                <View style={styles.rowTextContainer}>
                  <Text style={[styles.rowName, { color: '#C53030' }]}>Delete Account</Text>
                  <Text style={styles.rowDescription}>Permanently delete your account</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: height * 0.1,
    paddingHorizontal: width * 0.05,
  },
  // Profile
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: height * 0.03,
  },
  avatarContainer: {
    width: width * 0.18,
    height: width * 0.18,
    borderRadius: width * 0.09,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileTextContainer: {
    flex: 1,
    marginLeft: width * 0.04,
  },
  profileName: {
    fontSize: 20 * FONT_SCALE,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileHandle: {
    fontSize: 14 * FONT_SCALE,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  editProfileButton: {
    backgroundColor: '#fff',
    paddingHorizontal: width * 0.05,
    paddingVertical: height * 0.015,
    borderRadius: 20,
  },
  editProfileButtonText: {
    color: '#5A67D8',
    fontWeight: 'bold',
    fontSize: 14 * FONT_SCALE,
  },
  // Sections
  section: {
    marginTop: height * 0.02,
  },
  sectionTitle: {
    fontSize: 16 * FONT_SCALE,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: height * 0.01,
  },
  sectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    paddingHorizontal: width * 0.04,
  },
  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: height * 0.02,
  },
  rowIconContainer: {
    width: 35 * FONT_SCALE,
    height: 35 * FONT_SCALE,
    borderRadius: 20,
    backgroundColor: '#E9EFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: width * 0.04,
  },
  rowTextContainer: {
    flex: 1,
  },
  rowName: {
    fontSize: 16 * FONT_SCALE,
    fontWeight: '500',
    color: '#333',
  },
  rowDescription: {
    fontSize: 12 * FONT_SCALE,
    color: '#666',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#EAEAEA',
    marginLeft: width * 0.1,
  },
});

export default SettingsScreen; 