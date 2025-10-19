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

const { width, height } = Dimensions.get('window');

type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Home: undefined;
  BusinessLogin: undefined;
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
    safeArea: {
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
      
      console.log('✅ Login Debug - User signed in successfully:', user.uid);
      
      // Check if user has a Firestore document
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        console.log('✅ Login Debug - No Firestore document found, treating as regular user');
        // Set user type as regular user for accounts without Firestore document
        setUserType('user');
        Alert.alert('Success', 'Welcome back!');
      } else {
        const userData = userDoc.data();
        const userType = userData?.userType;
        
        if (!userType || userType === 'user') {
          console.log('✅ Login Debug - User type is user or undefined, allowing login');
          // Set user type as regular user
          setUserType('user');
          Alert.alert('Success', 'Welcome back!');
        } else {
          console.log('❌ Login Debug - User type is business, blocking login');
          // This is a business account, show alert and log out
          await auth.signOut();
          Alert.alert(
            'Login Error',
            'This is a business account. Please use the business login screen.'
          );
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
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
      Alert.alert('Error', error.message);
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
                style={styles.forgotPasswordButton}
                onPress={() => navigation.navigate('BusinessLogin')}
              >
                <ResponsiveText size={isSmallDevice ? "xs" : isTablet ? "md" : "sm"} color="#667eea" style={styles.forgotPasswordText}>
                  Business Owner? Register here.
                </ResponsiveText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.signupButton, loading && styles.buttonDisabled]}
                onPress={() => navigation.navigate('Signup')}
                disabled={loading}
              >
                <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} weight="600" color="#667eea" style={[styles.buttonText, styles.signupButtonText]}>
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
