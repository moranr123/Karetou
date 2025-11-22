import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import { auth, db } from '../../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useResponsive } from '../../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../../components';

const { width, height } = Dimensions.get('window');

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

interface SettingRowProps {
  icon: any;
  name: string;
  description?: string;
  children?: React.ReactNode;
  onPress?: () => void;
}

const BusinessSettingsScreen = () => {
  const { user, theme, toggleTheme, logout } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius, dimensions } = useResponsive();
  const [userFullName, setUserFullName] = useState<string>('');
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  // Fetch user's full name from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.uid) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserFullName(userData.fullName || '');
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

  const Section = ({ title, children }: SectionProps) => (
    <ResponsiveView style={styles.section}>
      <ResponsiveText size="md" weight="600" color={theme === 'dark' ? '#FFF' : '#000'} style={styles.sectionTitle}>
        {title}
      </ResponsiveText>
      <View style={styles.sectionCard}>{children}</View>
    </ResponsiveView>
  );

  const SettingRow = ({ icon, name, description, children, onPress }: SettingRowProps) => {
    const content = (
      <View style={styles.row}>
        <View style={styles.rowIconContainer}>
          <Feather name={icon} size={iconSizes.md} color="#5A67D8" />
        </View>
        <View style={styles.rowTextContainer}>
          <ResponsiveText size="md" weight="500" color="#333" style={styles.rowName}>
            {name}
          </ResponsiveText>
          {description && (
            <ResponsiveText size="xs" color="#666" style={styles.rowDescription}>
              {description}
            </ResponsiveText>
          )}
        </View>
        {children || (onPress && <Feather name="chevron-right" size={iconSizes.md} color="#C0C0C0" />)}
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity onPress={onPress}>
          {content}
        </TouchableOpacity>
      );
    }

    return content;
  };

  const Divider = () => <View style={styles.divider} />;

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
          {/* Profile Section */}
          <ResponsiveView style={styles.profileSection}>
            <View style={styles.profileTextContainer}>
              <ResponsiveText 
                size="lg" 
                weight="bold" 
                color={theme === 'dark' ? '#FFF' : '#000'} 
                style={styles.profileName}
                numberOfLines={1}
              >
                {loadingUserData ? 'Loading...' : (userFullName || user?.displayName || '')}
              </ResponsiveText>
              <ResponsiveText 
                size="sm" 
                color={theme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : '#666'} 
                style={styles.profileHandle}
                numberOfLines={1}
              >
                {user?.email}
              </ResponsiveText>
            </View>
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
            />
            <Divider />
            <SettingRow 
              icon="info" 
              name="About" 
              description="App version and information"
              onPress={() => console.log('About pressed')}
            />
          </Section>

          {/* Account Section */}
          <Section title="Account">
            <TouchableOpacity onPress={handleLogout} disabled={loggingOut}>
              <View style={styles.logoutRow}>
                <SettingRow 
                  icon="log-out" 
                  name="Logout" 
                  description={loggingOut ? "Signing out..." : "Sign out of your account"}
                />
                {loggingOut && (
                  <ActivityIndicator size="small" color="#667eea" style={styles.logoutIndicator} />
                )}
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
    paddingBottom: '10%',
    paddingHorizontal: '5%',
  },
  // Profile
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: '3%',
  },
  avatarContainer: {
    width: '18%',
    minWidth: 60,
    maxWidth: 80,
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileTextContainer: {
    flex: 1,
    marginLeft: '4%',
    minWidth: 0,
  },
  profileName: {
    // Styles handled by ResponsiveText
  },
  profileHandle: {
    marginTop: 4,
  },
  editProfileButton: {
    backgroundColor: '#fff',
    paddingHorizontal: '5%',
    paddingVertical: '1.5%',
    minHeight: 36,
    borderRadius: 20,
  },
  editProfileButtonText: {
    color: '#5A67D8',
    fontWeight: 'bold',
  },
  // Sections
  section: {
    marginTop: '2%',
  },
  sectionTitle: {
    marginBottom: '1%',
  },
  sectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    paddingHorizontal: '4%',
  },
  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: '2%',
    minHeight: 56,
  },
  rowIconContainer: {
    width: 35,
    minWidth: 35,
    height: 35,
    borderRadius: 20,
    backgroundColor: '#E9EFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '4%',
  },
  rowTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    // Styles handled by ResponsiveText
  },
  rowDescription: {
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#EAEAEA',
    marginLeft: '10%',
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoutIndicator: {
    marginRight: '4%',
  },
});

export default BusinessSettingsScreen; 