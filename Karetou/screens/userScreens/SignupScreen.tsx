import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useResponsive } from '../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView, ResponsiveButton } from '../../components';

const { width, height } = Dimensions.get('window');

type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Home: undefined;
  EmailVerification: { email: string; password?: string; userType?: 'user' | 'business' };
};

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Signup'>;

interface Props {
  navigation: SignupScreenNavigationProp;
}


const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { setUserType } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius, getResponsiveWidth, getResponsiveHeight } = useResponsive();
  
  // Device size detection
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const isSmallDevice = screenWidth < 375 || screenHeight < 667; // iPhone SE, small Android
  const isMediumDevice = screenWidth >= 375 && screenWidth <= 414;
  const isLargeDevice = screenWidth > 414 || screenHeight > 844; // iPhone Pro Max, Plus models
  const isTablet = screenWidth > 768; // Tablets
  
  // Platform-specific adjustments
  const isIOS = Platform.OS === 'ios';
  
  // Responsive calculations
  const spacingMultiplier = isSmallDevice ? 0.8 : isMediumDevice ? 1 : isTablet ? 1.5 : 1.1;
  const logoSizePercent = isSmallDevice ? 16 : isMediumDevice ? 20 : isTablet ? 30 : 22;
  const inputHeight = isSmallDevice ? 6 : isMediumDevice ? 6.5 : isTablet ? 8 : 7;

  // --- Styles ---
  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContainer: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg * spacingMultiplier,
      paddingTop: spacing.lg * spacingMultiplier,
      paddingBottom: spacing.md * spacingMultiplier,
      justifyContent: 'flex-start',
      width: '100%',
    },
    header: {
      alignItems: 'center',
      marginBottom: spacing.lg * spacingMultiplier,
    },
    logoContainer: {
      width: getResponsiveWidth(logoSizePercent),
      height: getResponsiveWidth(logoSizePercent),
      borderRadius: getResponsiveWidth(logoSizePercent / 2),
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md * spacingMultiplier,
    },
    logoImage: {
      width: '80%',
      height: '80%',
      resizeMode: 'contain',
    },
    title: {
      marginBottom: spacing.sm * spacingMultiplier,
      textAlign: 'center',
    },
    subtitle: {
      textAlign: 'center',
      paddingHorizontal: spacing.md * spacingMultiplier,
      marginBottom: spacing.sm * spacingMultiplier,
    },
    formContainer: {
      width: '100%',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: borderRadius.lg,
      marginBottom: spacing.lg * spacingMultiplier,
      paddingHorizontal: spacing.lg,
      height: getResponsiveHeight(inputHeight),
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    inputIcon: {
      marginRight: spacing.sm,
    },
    input: {
      flex: 1,
      fontSize: fontSizes.md,
      color: '#000',
    },
    eyeIcon: {
      padding: spacing.xs,
    },
    button: {
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md * spacingMultiplier,
      minHeight: getResponsiveHeight(inputHeight),
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
    },
    signupButton: {
      backgroundColor: '#4CAF50',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: fontSizes.md,
      fontWeight: '600',
      color: '#fff',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: spacing.xl * spacingMultiplier,
      paddingTop: spacing.lg * spacingMultiplier,
    },
    footerText: {
      color: '#666',
      fontSize: fontSizes.md,
    },
    linkText: {
      color: '#667eea',
      fontSize: fontSizes.md,
      fontWeight: '600',
    },
  });

  const handleSignup = async () => {
    if (!fullName || !email || !password || !confirmPassword || !phoneNumber) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    // Basic phone number validation
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(phoneNumber)) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Send email verification
      await sendEmailVerification(user);

      // Save user type to Firestore (but don't set as verified until email is confirmed)
      await setDoc(doc(db, 'users', user.uid), {
        fullName: fullName,
        email: user.email,
        userType: 'user',
        phoneNumber: phoneNumber,
        emailVerified: false,
        preferences: [],
        hasSetPreferences: false, // Track if user has completed preferences setup
        createdAt: new Date().toISOString(),
      });

      // Sign out the user until they verify their email
      await auth.signOut();

      Alert.alert(
        'Verification Email Sent',
        'Please check your email and click the verification link to activate your account.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('EmailVerification', { email, password, userType: 'user' }),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <LinearGradient
      colors={['#F5F5F5', '#F5F5F5']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <ResponsiveView style={styles.header}>
            <ResponsiveView style={styles.logoContainer}>
              <Image 
                source={require('../../assets/logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </ResponsiveView>
            <ResponsiveText size={isSmallDevice ? "xl" : isTablet ? "xxxl" : "xxl"} weight="bold" color="#000" style={styles.title}>
              Create Account
            </ResponsiveText>
            <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} color="#666" style={styles.subtitle}>
              Join us and start your journey
            </ResponsiveText>
          </ResponsiveView>

          {/* Form */}
          <ResponsiveView style={styles.formContainer}>
            <ResponsiveView style={styles.inputContainer}>
              <Ionicons name="person-outline" size={iconSizes.md} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#999"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </ResponsiveView>

            <ResponsiveView style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={iconSizes.md} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </ResponsiveView>

            <ResponsiveView style={styles.inputContainer}>
              <Ionicons name="call-outline" size={iconSizes.md} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor="#999"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            </ResponsiveView>

            <ResponsiveView style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={iconSizes.md} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={iconSizes.md}
                  color="#667eea"
                />
              </TouchableOpacity>
            </ResponsiveView>

            <ResponsiveView style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={iconSizes.md} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={iconSizes.md}
                  color="#667eea"
                />
              </TouchableOpacity>
            </ResponsiveView>

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.button, styles.signupButton, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} weight="600" color="#fff" style={styles.buttonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </ResponsiveText>
            </TouchableOpacity>

            {/* Footer */}
            <ResponsiveView style={styles.footer}>
              <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "md"} color="#666" style={styles.footerText}>
                Already have an account? 
              </ResponsiveText>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "md"} weight="600" color="#667eea" style={styles.linkText}>
                  Sign In
                </ResponsiveText>
              </TouchableOpacity>
            </ResponsiveView>
          </ResponsiveView>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

export default SignupScreen; 