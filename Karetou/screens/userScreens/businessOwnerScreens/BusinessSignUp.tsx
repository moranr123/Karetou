import React, { useState } from 'react';
import {
  SafeAreaView,
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
import { auth, db } from '../../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../../contexts/AuthContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../../components';

// Get responsive dimensions dynamically
const getScreenDimensions = () => Dimensions.get('window');

type RootStackParamList = {
  Login: undefined;
  BusinessSignUp: undefined;
  EmailVerification: { email: string; password?: string; userType?: 'user' | 'business' };
};

type BusinessSignUpScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'BusinessSignUp'
>;

interface Props {
  navigation: BusinessSignUpScreenNavigationProp;
}

const BusinessSignUpScreen: React.FC<Props> = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordRequirements, setPasswordRequirements] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { setUserType } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius, dimensions } = useResponsive();
  
  // Get responsive values from hook
  const screenWidth = dimensions.width;
  const screenHeight = dimensions.height;
  const isSmallDevice = screenWidth < 375 || screenHeight < 667;
  const isVerySmallScreen = screenWidth < 360;
  const isMediumDevice = screenWidth >= 375 && screenWidth <= 414;
  const isTablet = screenWidth > 768;
  
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
    inputError: {
      borderColor: '#FF4444',
      borderWidth: 2,
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
    signupButton: {
      backgroundColor: '#4CAF50',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: fontSizes.md,
      fontWeight: '600',
    },
    errorText: {
      fontSize: fontSizes.sm,
      color: '#FF4444',
      marginTop: spacing.xs * spacingMultiplier,
      marginBottom: spacing.sm * spacingMultiplier,
      marginLeft: spacing.sm,
    },
    passwordRequirementsContainer: {
      backgroundColor: '#f8f9fa',
      borderRadius: borderRadius.md,
      padding: isVerySmallScreen ? spacing.sm : spacing.md * spacingMultiplier,
      marginBottom: spacing.md * spacingMultiplier,
      borderWidth: 1,
      borderColor: '#e0e0e0',
    },
    passwordRequirementsTitle: {
      marginBottom: spacing.sm * spacingMultiplier,
    },
    requirementItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs * spacingMultiplier,
      minHeight: 24, // Ensure items don't get too small
    },
    requirementText: {
      marginLeft: spacing.sm,
      lineHeight: fontSizes.sm * 1.4,
      flex: 1, // Allow text to wrap properly
      flexWrap: 'wrap',
    },
    requirementMet: {
      fontWeight: '500',
    },
    termsContainer: {
      marginTop: spacing.sm * spacingMultiplier,
      marginBottom: spacing.md * spacingMultiplier,
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      minHeight: 44, // Ensure touch target is at least 44px
      paddingVertical: spacing.xs,
    },
    termsTextContainer: {
      flex: 1,
      marginLeft: spacing.sm,
    },
    termsTextRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    termsText: {
      lineHeight: fontSizes.sm * 1.4,
    },
    termsLink: {
      textDecorationLine: 'underline',
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

  const validatePassword = (pwd: string) => {
    const requirements = {
      minLength: pwd.length >= 8,
      hasUppercase: /[A-Z]/.test(pwd),
      hasLowercase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
    };

    setPasswordRequirements(requirements);

    const allMet = Object.values(requirements).every((req) => req === true);

    if (!allMet) {
      const missing = [];
      if (!requirements.minLength) missing.push('at least 8 characters');
      if (!requirements.hasUppercase) missing.push('one uppercase letter');
      if (!requirements.hasLowercase) missing.push('one lowercase letter');
      if (!requirements.hasNumber) missing.push('one number');
      
      setPasswordError(`Password must contain: ${missing.join(', ')}`);
      return false;
    }

    setPasswordError('');
    return true;
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    validatePassword(text);
    
    // Also check if confirm password matches
    if (confirmPassword && text !== confirmPassword) {
      // Keep confirm password error handling separate
    }
  };

  const showTermsAndConditions = () => {
    Alert.alert(
      'Terms and Conditions',
      'By creating a business account, you agree to:\n\n' +
      '1. Provide accurate business information and documentation\n' +
      '2. Maintain the accuracy of your business profile\n' +
      '3. Comply with all applicable business laws and regulations\n' +
      '4. Respect customer privacy and data protection\n' +
      '5. Not engage in fraudulent or misleading practices\n' +
      '6. Follow all platform guidelines and policies\n\n' +
      'We reserve the right to suspend or terminate accounts that violate these terms.',
      [{ text: 'OK' }]
    );
  };

  const handleSignup = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Terms Required', 'Please accept the Terms and Conditions to create a business account.');
      return;
    }

    // Validate strong password
    if (!validatePassword(password)) {
      Alert.alert('Weak Password', 'Please ensure your password meets all the requirements shown below.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
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
        userType: 'business',
        emailVerified: false,
        createdAt: new Date().toISOString(),
      });

      // Sign out the user until they verify their email
      await auth.signOut();

      Alert.alert(
        'Verification Email Sent',
        'Please check your email and click the verification link to activate your business account.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('EmailVerification', { email, password, userType: 'business' }),
          },
        ]
      );
    } catch (error: any) {
      let errorMessage = 'An error occurred. Please try again.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email address is already registered. Please sign in or use a different email.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please check your email and try again.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please ensure your password meets all the requirements shown above.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/password accounts are not enabled. Please contact support.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many signup attempts. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Signup Error', errorMessage);
    } finally {
      setLoading(false);
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
                  source={require('../../../assets/logo.png')} 
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </ResponsiveView>
              <ResponsiveText size={isSmallDevice ? "xl" : isTablet ? "xxxl" : "xxl"} weight="bold" color="#000" style={styles.title}>
                Create Business Account
              </ResponsiveText>
              <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} color="#666" style={styles.subtitle}>
                Join us and grow your business
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
                placeholder="Business Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </ResponsiveView>

            <ResponsiveView style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={iconSizes.md} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, passwordError && styles.inputError]}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={handlePasswordChange}
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

            {/* Password Requirements */}
            {password.length > 0 && (
              <ResponsiveView style={styles.passwordRequirementsContainer}>
                <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "sm"} weight="600" color="#333" style={styles.passwordRequirementsTitle}>
                  Password Requirements:
                </ResponsiveText>
                <ResponsiveView style={styles.requirementItem}>
                  <Ionicons
                    name={passwordRequirements.minLength ? 'checkmark-circle' : 'ellipse-outline'}
                    size={iconSizes.sm}
                    color={passwordRequirements.minLength ? '#4CAF50' : '#999'}
                  />
                  <ResponsiveText size={isSmallDevice ? "xs" : isTablet ? "sm" : "xs"} color={passwordRequirements.minLength ? "#4CAF50" : "#666"} style={[styles.requirementText, passwordRequirements.minLength && styles.requirementMet]}>
                    At least 8 characters
                  </ResponsiveText>
                </ResponsiveView>
                <ResponsiveView style={styles.requirementItem}>
                  <Ionicons
                    name={passwordRequirements.hasUppercase ? 'checkmark-circle' : 'ellipse-outline'}
                    size={iconSizes.sm}
                    color={passwordRequirements.hasUppercase ? '#4CAF50' : '#999'}
                  />
                  <ResponsiveText size={isSmallDevice ? "xs" : isTablet ? "sm" : "xs"} color={passwordRequirements.hasUppercase ? "#4CAF50" : "#666"} style={[styles.requirementText, passwordRequirements.hasUppercase && styles.requirementMet]}>
                    One uppercase letter (A-Z)
                  </ResponsiveText>
                </ResponsiveView>
                <ResponsiveView style={styles.requirementItem}>
                  <Ionicons
                    name={passwordRequirements.hasLowercase ? 'checkmark-circle' : 'ellipse-outline'}
                    size={iconSizes.sm}
                    color={passwordRequirements.hasLowercase ? '#4CAF50' : '#999'}
                  />
                  <ResponsiveText size={isSmallDevice ? "xs" : isTablet ? "sm" : "xs"} color={passwordRequirements.hasLowercase ? "#4CAF50" : "#666"} style={[styles.requirementText, passwordRequirements.hasLowercase && styles.requirementMet]}>
                    One lowercase letter (a-z)
                  </ResponsiveText>
                </ResponsiveView>
                <ResponsiveView style={styles.requirementItem}>
                  <Ionicons
                    name={passwordRequirements.hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
                    size={iconSizes.sm}
                    color={passwordRequirements.hasNumber ? '#4CAF50' : '#999'}
                  />
                  <ResponsiveText size={isSmallDevice ? "xs" : isTablet ? "sm" : "xs"} color={passwordRequirements.hasNumber ? "#4CAF50" : "#666"} style={[styles.requirementText, passwordRequirements.hasNumber && styles.requirementMet]}>
                    One number (0-9)
                  </ResponsiveText>
                </ResponsiveView>
              </ResponsiveView>
            )}

            {passwordError ? (
              <ResponsiveText size={isSmallDevice ? "xs" : isTablet ? "sm" : "xs"} color="#FF4444" style={styles.errorText}>
                {passwordError}
              </ResponsiveText>
            ) : null}

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

            {/* Terms and Conditions */}
            <ResponsiveView style={styles.termsContainer}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={acceptedTerms ? 'checkbox' : 'square-outline'}
                  size={iconSizes.md}
                  color={acceptedTerms ? '#667eea' : '#999'}
                />
                <ResponsiveView style={styles.termsTextContainer}>
                  <ResponsiveView style={styles.termsTextRow}>
                    <ResponsiveText size={isSmallDevice ? "xs" : isTablet ? "md" : "sm"} color="#666" style={styles.termsText}>
                      I agree to the{' '}
                    </ResponsiveText>
                    <TouchableOpacity onPress={showTermsAndConditions}>
                      <ResponsiveText size={isSmallDevice ? "xs" : isTablet ? "md" : "sm"} color="#667eea" weight="600" style={styles.termsLink}>
                        Terms and Conditions
                      </ResponsiveText>
                    </TouchableOpacity>
                  </ResponsiveView>
                </ResponsiveView>
              </TouchableOpacity>
            </ResponsiveView>

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.button, styles.signupButton, (loading || !acceptedTerms) && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading || !acceptedTerms}
            >
              <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} weight="600" color="#fff" style={styles.buttonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </ResponsiveText>
            </TouchableOpacity>

            {/* Footer */}
            <ResponsiveView style={styles.footer}>
              <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "md"} color="#666" style={styles.footerText}>
                Already have an account?{' '}
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
      </SafeAreaView>
    </LinearGradient>
  );
};

export default BusinessSignUpScreen;