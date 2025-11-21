import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { deleteUser } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
import { useResponsive } from '../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../components';

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

interface SettingRowProps {
  icon: any;
  name: string;
  description?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}

const SettingsScreen = () => {
  const { user, theme, toggleTheme, logout } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius: borderRadiusValues, dimensions, responsiveHeight, responsiveWidth } = useResponsive();
  const [userFullName, setUserFullName] = useState<string>('');
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Calculate responsive values
  const isSmallScreen = (dimensions?.width || 360) < 360;
  const isSmallDevice = dimensions?.isSmallDevice || false;
  const minTouchTarget = 44;
  
  // Calculate header padding
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const headerPaddingTop = Platform.OS === 'ios' 
    ? (spacing?.md || 12) + (isSmallDevice ? (spacing?.xs || 4) : (spacing?.sm || 8))
    : statusBarHeight + (spacing?.sm || 8);

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  // Fetch user's full name from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.uid) { setLoadingUserData(false); return; }
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData: any = userDoc.data();
          setUserFullName((userData && (userData.fullName || userData.name)) || '');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoadingUserData(false);
      }
    };
    fetchUserData();
  }, [user?.uid]);

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
          onPress: async () => {
            try {
              setLoggingOut(true);
              await logout();
            } catch (error: any) {
              setLoggingOut(false);
              Alert.alert('Logout Error', error?.message || 'Failed to logout');
            }
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

  // Create responsive styles using useMemo
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    scrollContainer: {
      paddingBottom: spacing?.xl || 24,
      paddingHorizontal: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      paddingTop: headerPaddingTop,
    },
    // Profile
    profileSection: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing?.lg || 16,
    },
    avatarContainer: {
      width: responsiveWidth(18) || 72,
      height: responsiveWidth(18) || 72,
      minWidth: 60,
      minHeight: 60,
      maxWidth: 100,
      maxHeight: 100,
      borderRadius: (responsiveWidth(18) || 72) / 2,
      backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing?.sm || 8,
    },
    profileTextContainer: {
      alignItems: 'center',
      paddingHorizontal: spacing?.md || 12,
    },
    profileName: {
      fontSize: fontSizes?.xl || 20,
      fontWeight: 'bold',
      color: theme === 'light' ? '#000' : '#fff',
      textAlign: 'center',
      marginBottom: spacing?.xs || 4,
    },
    profileHandle: {
      fontSize: fontSizes?.sm || 14,
      color: theme === 'light' ? '#666' : 'rgba(255, 255, 255, 0.7)',
      textAlign: 'center',
    },
    editProfileButton: {
      backgroundColor: theme === 'light' ? '#fff' : '#2a2a2a',
      paddingHorizontal: spacing?.md || 12,
      paddingVertical: spacing?.sm || 8,
      borderRadius: borderRadiusValues?.lg || 20,
      marginTop: spacing?.sm || 8,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editProfileButtonText: {
      color: '#5A67D8',
      fontWeight: 'bold',
      fontSize: fontSizes?.sm || 14,
    },
    // Sections
    section: {
      marginTop: spacing?.lg || 16,
    },
    sectionTitle: {
      fontSize: fontSizes?.md || 16,
      fontWeight: '600',
      color: theme === 'light' ? '#000' : '#fff',
      marginBottom: spacing?.sm || 8,
      paddingHorizontal: spacing?.xs || 4,
    },
    sectionCard: {
      backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(42, 42, 42, 0.95)',
      borderRadius: borderRadiusValues?.md || 15,
      paddingHorizontal: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    // Rows
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing?.md || 12,
      minHeight: minTouchTarget,
    },
    rowIconContainer: {
      width: responsiveWidth(9) || 36,
      height: responsiveWidth(9) || 36,
      minWidth: 32,
      minHeight: 32,
      maxWidth: 44,
      maxHeight: 44,
      borderRadius: (responsiveWidth(9) || 36) / 2,
      backgroundColor: theme === 'light' ? '#E9EFFF' : 'rgba(102, 126, 234, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing?.sm || 8,
      flexShrink: 0,
    },
    rowTextContainer: {
      flex: 1,
      minWidth: 0,
    },
    rowName: {
      fontSize: fontSizes?.md || 16,
      fontWeight: '500',
      color: theme === 'light' ? '#333' : '#fff',
      marginBottom: spacing?.xs || 2,
    },
    rowDescription: {
      fontSize: fontSizes?.xs || 12,
      color: theme === 'light' ? '#666' : '#aaa',
      marginTop: spacing?.xs || 2,
      lineHeight: (fontSizes?.xs || 12) * 1.4,
    },
    divider: {
      height: 1,
      backgroundColor: theme === 'light' ? '#EAEAEA' : '#444',
      marginLeft: responsiveWidth(10) || 40,
    },
    logoutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flex: 1,
    },
    logoutIndicator: {
      marginRight: spacing?.xs || 4,
    },
  }), [spacing, fontSizes, iconSizes, borderRadiusValues, dimensions, isSmallScreen, isSmallDevice, minTouchTarget, headerPaddingTop, responsiveHeight, responsiveWidth, theme]);

  const Section = ({ title, children }: SectionProps) => (
    <ResponsiveView style={styles.section}>
      <ResponsiveText size="md" weight="600" color={theme === 'light' ? '#000' : '#fff'} style={styles.sectionTitle}>
        {title}
      </ResponsiveText>
      <ResponsiveView style={styles.sectionCard}>{children}</ResponsiveView>
    </ResponsiveView>
  );

  const SettingRow = ({ icon, name, description, onPress, children }: SettingRowProps) => {
    const rowContent = (
      <ResponsiveView style={styles.row}>
        <ResponsiveView style={styles.rowIconContainer}>
          <Feather name={icon} size={iconSizes?.sm || 20} color="#5A67D8" />
        </ResponsiveView>
        <ResponsiveView style={styles.rowTextContainer}>
          <ResponsiveText size="md" weight="500" color={theme === 'light' ? '#333' : '#fff'} style={styles.rowName}>
            {name}
          </ResponsiveText>
          {description && (
            <ResponsiveText size="xs" color={theme === 'light' ? '#666' : '#aaa'} style={styles.rowDescription}>
              {description}
            </ResponsiveText>
          )}
        </ResponsiveView>
        {children}
      </ResponsiveView>
    );

    if (onPress) {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          {rowContent}
        </TouchableOpacity>
      );
    }

    return rowContent;
  };

  const Divider = () => <View style={styles.divider} />;

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Section */}
          <ResponsiveView style={styles.profileSection}>
            <ResponsiveView style={styles.profileTextContainer}>
              {loadingUserData ? (
                <ActivityIndicator size="small" color={theme === 'light' ? '#667eea' : '#fff'} />
              ) : (
                <>
                  <ResponsiveText size="xl" weight="bold" color={theme === 'light' ? '#000' : '#fff'} style={styles.profileName}>
                    {userFullName || user?.displayName || 'User'}
                  </ResponsiveText>
                  <ResponsiveText size="sm" color={theme === 'light' ? '#666' : 'rgba(255, 255, 255, 0.7)'} style={styles.profileHandle}>
                    {user?.email || ''}
                  </ResponsiveText>
                </>
              )}
            </ResponsiveView>
          </ResponsiveView>

          {/* Preferences Section */}
          <Section title="Preferences">
            <SettingRow icon="moon" name="Dark Mode" description="Switch to dark theme">
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
            <SettingRow 
              icon="help-circle" 
              name="Help & Support" 
              description="Get help and contact support"
              onPress={() => console.log('Help & Support pressed')}
            >
              <Feather name="chevron-right" size={iconSizes?.sm || 20} color={theme === 'light' ? '#C0C0C0' : '#666'} />
            </SettingRow>
            <Divider />
            <SettingRow 
              icon="info" 
              name="About" 
              description="App version and information"
              onPress={() => console.log('About pressed')}
            >
              <Feather name="chevron-right" size={iconSizes?.sm || 20} color={theme === 'light' ? '#C0C0C0' : '#666'} />
            </SettingRow>
          </Section>

          {/* Account Section */}
          <Section title="Account">
            <TouchableOpacity onPress={handleLogout} disabled={loggingOut} activeOpacity={0.7}>
              <ResponsiveView style={styles.logoutRow}>
                <SettingRow icon="log-out" name="Logout" description={loggingOut ? "Signing out..." : "Sign out of your account"} />
                {loggingOut && (
                  <ActivityIndicator size="small" color="#667eea" style={styles.logoutIndicator} />
                )}
              </ResponsiveView>
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity onPress={handleDeleteAccount} activeOpacity={0.7}>
              <ResponsiveView style={styles.row}>
                <ResponsiveView style={[styles.rowIconContainer, { backgroundColor: theme === 'light' ? '#FED7D7' : '#4a1f1f' }]}>
                  <Feather name="trash-2" size={iconSizes?.sm || 20} color="#C53030" />
                </ResponsiveView>
                <ResponsiveView style={styles.rowTextContainer}>
                  <ResponsiveText size="md" weight="500" color="#C53030" style={styles.rowName}>
                    Delete Account
                  </ResponsiveText>
                  <ResponsiveText size="xs" color={theme === 'light' ? '#666' : '#aaa'} style={styles.rowDescription}>
                    Permanently delete your account
                  </ResponsiveText>
                </ResponsiveView>
              </ResponsiveView>
            </TouchableOpacity>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default SettingsScreen;
