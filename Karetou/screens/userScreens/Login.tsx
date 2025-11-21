import { auth } from '../../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import { 
  SafeAreaView, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Alert,
  Dimensions,
  Image 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useResponsive } from '../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView, ResponsiveButton, ResponsiveInput } from '../../components';

// Get responsive dimensions dynamically
const getScreenDimensions = () => Dimensions.get('window');

type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Home: undefined;
  BusinessSignUp: undefined;
  EmailVerification: { email: string; password?: string; userType?: 'user' | 'business' };
};

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

export default function Login({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userType, setUserTypeState] = useState<'user' | 'business'>('user');
  const { setUserType } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius, dimensions } = useResponsive();
  
  // Get responsive values from hook
  const screenWidth = dimensions.width;
  const screenHeight = dimensions.height;
  const isSmallDevice = screenWidth < 375 || screenHeight < 667;
  const isVerySmallScreen = screenWidth < 360;
  const isMediumDevice = screenWidth >= 375 && screenWidth <= 414;
  const isLargeDevice = screenWidth > 414 || screenHeight > 844;
  const isTablet = screenWidth > 768;
  
  // Platform-specific adjustments
  const isIOS = Platform.OS === 'ios';
  
  // Responsive calculations - use percentage-based sizing
  const spacingMultiplier = isVerySmallScreen ? 0.75 : isSmallDevice ? 0.85 : isMediumDevice ? 1 : isTablet ? 1.3 : 1.1;
  const logoSize = isVerySmallScreen ? screenWidth * 0.15 : isSmallDevice ? screenWidth * 0.18 : isMediumDevice ? screenWidth * 0.22 : isTablet ? screenWidth * 0.25 : screenWidth * 0.22;
  const inputHeight = isVerySmallScreen ? 48 : isSmallDevice ? 50 : isMediumDevice ? 52 : isTablet ? 56 : 52;

  // --- Styles ---
  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContainer: {
      flexGrow: 1,
      paddingHorizontal: isVerySmallScreen ? spacing.md : spacing.lg * spacingMultiplier,
      paddingTop: spacing.lg * spacingMultiplier,
      paddingBottom: spacing.md * spacingMultiplier,
      justifyContent: 'flex-start',
      width: '100%',
      minHeight: screenHeight * 0.9, // Ensure content fills screen
    },
    header: {
      alignItems: 'center',
      marginBottom: spacing.lg * spacingMultiplier,
    },
    logoContainer: {
      width: logoSize,
      height: logoSize,
      borderRadius: logoSize / 2,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md * spacingMultiplier,
      minWidth: isVerySmallScreen ? 60 : 70,
      maxWidth: 120, // Prevent logo from getting too large on tablets
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
      paddingHorizontal: isVerySmallScreen ? spacing.sm : spacing.md * spacingMultiplier,
      marginBottom: spacing.sm * spacingMultiplier,
    },
    formContainer: {
      width: '100%',
      maxWidth: 500, // Prevent form from getting too wide on tablets
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: borderRadius.xl,
      padding: isVerySmallScreen ? spacing.md : spacing.lg * spacingMultiplier,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      alignSelf: 'center', // Center form on larger screens
    },
    userTypeSelector: {
      flexDirection: 'row',
      backgroundColor: '#f0f0f0',
      borderRadius: borderRadius.lg,
      padding: spacing.xs * spacingMultiplier,
      marginBottom: spacing.lg * spacingMultiplier,
    },
    userTypeButton: {
      flex: 1,
      paddingVertical: spacing.sm * spacingMultiplier,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44, // Ensure touch target is at least 44px
    },
    userTypeButtonActive: {
      backgroundColor: '#667eea',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    userTypeButtonInactive: {
      backgroundColor: 'transparent',
    },
    userTypeButtonText: {
      fontSize: fontSizes.sm,
      fontWeight: '600',
    },
    userTypeButtonTextActive: {
      color: '#fff',
    },
    userTypeButtonTextInactive: {
      color: '#666',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: borderRadius.lg,
      marginBottom: spacing.lg * spacingMultiplier,
      paddingHorizontal: isVerySmallScreen ? spacing.md : spacing.lg,
      height: inputHeight,
      minHeight: 44, // Ensure touch target is at least 44px
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
      minHeight: 20, // Ensure text doesn't get cut off
    },
    eyeIcon: {
      padding: spacing.xs,
      minWidth: 44, // Ensure touch target is at least 44px
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    button: {
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md * spacingMultiplier,
      minHeight: 50, // Ensure touch target is adequate
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
    },
    loginButton: {
      backgroundColor: '#667eea',
    },
    signupButton: {
      backgroundColor: '#4CAF50',
      borderWidth: 0,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: fontSizes.md,
      fontWeight: '600',
    },
    signupButtonText: {
      color: '#fff',
    },
    forgotPasswordButton: {
      alignItems: 'center',
      paddingVertical: spacing.sm * spacingMultiplier,
      marginBottom: spacing.md * spacingMultiplier,
      minHeight: 44, // Ensure touch target is at least 44px
      justifyContent: 'center',
    },
    forgotPasswordText: {
      fontSize: fontSizes.sm,
    },
    footer: {
      alignItems: 'center',
      marginTop: spacing.xl * spacingMultiplier,
      paddingTop: spacing.lg * spacingMultiplier,
      paddingBottom: spacing.lg,
    },
    footerText: {
      fontSize: fontSizes.xs,
      textAlign: 'center',
      lineHeight: fontSizes.xs * 1.4,
    },
  });

  const signIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check email verification status
      if (!user.emailVerified) {
        await auth.signOut();
        Alert.alert(
          'Email Not Verified',
          'Please verify your email address before signing in. Check your inbox for the verification email.',
          [
            {
              text: 'Resend Email',
              onPress: () => navigation.navigate('EmailVerification', { email, password, userType: userType }),
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ]
        );
        return;
      }

      // Check if user has a Firestore document
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // No Firestore document - only allow if user type is 'user'
        if (userType === 'user') {
          console.log('✅ Login Debug - No Firestore document found, treating as regular user');
          setUserType('user');
          Alert.alert('Success', 'Welcome back!');
        } else {
          await auth.signOut();
          Alert.alert(
            'Login Error',
            'Business account not found. Please register a business account first.'
          );
        }
        return;
      }

      const userData = userDoc.data();
      const accountUserType = userData?.userType;
      const isActive = userData?.isActive !== undefined ? userData.isActive : true;
      
      // Check if user account is active
      if (!isActive) {
        console.log('❌ Login Debug - User account is deactivated');
        await auth.signOut();
        Alert.alert(
          'Account Deactivated',
          `Your ${userType === 'business' ? 'business' : ''} account has been deactivated. Please contact support for assistance.`
        );
        return;
      }
      
      // Validate user type matches selected type
      if (userType === 'business') {
        if (accountUserType === 'business') {
          setUserType('business');
          Alert.alert('Success', 'Welcome back, Business Owner!');
        } else {
          await auth.signOut();
          Alert.alert(
            'Login Error',
            'This is not a business account. Please select "User" to login.'
          );
        }
      } else {
        // User login
        if (!accountUserType || accountUserType === 'user') {
          setUserType('user');
          Alert.alert('Success', 'Welcome back!');
        } else {
          await auth.signOut();
          Alert.alert(
            'Login Error',
            'This is a business account. Please select "Business Owner" to login.'
          );
        }
      }
    } catch (error: any) {
      let errorMessage = 'An error occurred. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please check your email and try again.';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled. Please contact support for assistance.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'This sign-in method is not enabled. Please contact support.';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please sign out and sign in again to perform this action.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Login Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        'Password Reset Email Sent',
        'Check your email for password reset instructions.',
        [
          {
            text: 'OK',
            onPress: () => console.log('OK Pressed'),
          },
        ]
      );
    } catch (error: any) {
      let errorMessage = 'An error occurred. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please check your email and try again.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many password reset attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Password reset is not enabled. Please contact support.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <LinearGradient
      colors={['#F5F5F5', '#F5F5F5']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
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
                Welcome Back
              </ResponsiveText>
              <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} color="#666" style={styles.subtitle}>
                Sign in to continue your journey
              </ResponsiveText>
            </ResponsiveView>

            {/* Form */}
            <ResponsiveView style={styles.formContainer}>
              {/* User Type Selector */}
              <ResponsiveView style={styles.userTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.userTypeButton,
                    userType === 'user' ? styles.userTypeButtonActive : styles.userTypeButtonInactive
                  ]}
                  onPress={() => setUserTypeState('user')}
                >
                  <ResponsiveText 
                    size={isSmallDevice ? "sm" : isTablet ? "md" : "sm"} 
                    weight="600" 
                    style={[
                      styles.userTypeButtonText,
                      userType === 'user' ? styles.userTypeButtonTextActive : styles.userTypeButtonTextInactive
                    ]}
                  >
                    User
                  </ResponsiveText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.userTypeButton,
                    userType === 'business' ? styles.userTypeButtonActive : styles.userTypeButtonInactive
                  ]}
                  onPress={() => setUserTypeState('business')}
                >
                  <ResponsiveText 
                    size={isSmallDevice ? "sm" : isTablet ? "md" : "sm"} 
                    weight="600" 
                    style={[
                      styles.userTypeButtonText,
                      userType === 'business' ? styles.userTypeButtonTextActive : styles.userTypeButtonTextInactive
                    ]}
                  >
                    Business Owner
                  </ResponsiveText>
                </TouchableOpacity>
              </ResponsiveView>

              <ResponsiveView style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={iconSizes.md} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={userType === 'business' ? 'Business Email' : 'Email'}
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  importantForAutofill="yes"
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
                  autoComplete="password"
                  textContentType="password"
                  importantForAutofill="yes"
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

              {/* Buttons */}
              <TouchableOpacity
                style={[styles.button, styles.loginButton, loading && styles.buttonDisabled]}
                onPress={signIn}
                disabled={loading}
              >
                <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} weight="600" color="#fff" style={styles.buttonText}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </ResponsiveText>
              </TouchableOpacity>

              {/* Forgot Password */}
              <TouchableOpacity 
                style={styles.forgotPasswordButton}
                onPress={handleForgotPassword}
              >
                <ResponsiveText size={isSmallDevice ? "xs" : isTablet ? "md" : "sm"} color="#667eea" style={styles.forgotPasswordText}>
                  Forgot Password?
                </ResponsiveText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.signupButton, loading && styles.buttonDisabled]}
                onPress={() => {
                  if (userType === 'business') {
                    navigation.navigate('BusinessSignUp');
                  } else {
                    navigation.navigate('Signup');
                  }
                }}
                disabled={loading}
              >
                <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} weight="600" color="#fff" style={[styles.buttonText, styles.signupButtonText]}>
                  Create Account
                </ResponsiveText>
              </TouchableOpacity>

            </ResponsiveView>

            {/* Footer */}
            <ResponsiveView style={styles.footer}>
              <ResponsiveText size={isSmallDevice ? "xs" : isTablet ? "sm" : "xs"} color="#999" style={styles.footerText}>
                By continuing, you agree to our Terms of Service and Privacy Policy
              </ResponsiveText>
            </ResponsiveView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
