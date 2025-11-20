import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { auth } from '../../firebase';
import { sendEmailVerification, reload, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import UserPreferencesModal from '../../components/UserPreferencesModal';
import { useResponsive } from '../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../components';

const { width, height } = Dimensions.get('window');

type RootStackParamList = {
  Login: undefined;
  EmailVerification: { email: string; password?: string; userType?: 'user' | 'business' };
  Home: undefined;
};

type EmailVerificationScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'EmailVerification'
>;

interface Props {
  navigation: EmailVerificationScreenNavigationProp;
  route: {
    params: {
      email: string;
      password?: string;
      userType?: 'user' | 'business';
    };
  };
}

const EmailVerificationScreen: React.FC<Props> = ({ navigation, route }) => {
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [lastResendTime, setLastResendTime] = useState(0);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const { email, password, userType } = route.params;
  const { setUserType } = useAuth();
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

  // Set initial cooldown after registration
  useEffect(() => {
    // Set a 2-minute initial cooldown when screen first loads
    const initialCooldown = 120; // 2 minutes
    setCountdown(initialCooldown);
    console.log('📧 Email verification screen loaded - setting initial 2-minute cooldown');
  }, []);

  // Load persisted rate limiting data on component mount
  useEffect(() => {
    const loadRateLimitData = async () => {
      try {
        const key = `resend_data_${email}`;
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const { attempts, lastTime, rateLimited, rateLimitEnd } = JSON.parse(data);
          const now = Date.now();
          
          if (rateLimited && now < rateLimitEnd) {
            // Still rate limited - override initial cooldown with longer rate limit
            const remainingTime = Math.ceil((rateLimitEnd - now) / 1000);
            setIsRateLimited(true);
            setCountdown(remainingTime);
            setResendAttempts(attempts || 0);
            setLastResendTime(lastTime || 0);
            console.log(`🔄 Restored rate limit state: ${remainingTime}s remaining (overriding initial cooldown)`);
          } else if (attempts) {
            // Restore attempts but not rate limited anymore - keep initial cooldown
            setResendAttempts(attempts);
            setLastResendTime(lastTime || 0);
            console.log(`🔄 Restored attempt count: ${attempts}, keeping initial cooldown`);
          }
        } else {
          // No existing data - this is truly a fresh registration, keep initial cooldown
          console.log('📧 Fresh registration - keeping initial 2-minute cooldown');
        }
      } catch (error) {
        console.error('Error loading rate limit data:', error);
      }
    };
    
    // Delay loading to allow initial cooldown to be set first
    setTimeout(loadRateLimitData, 100);
  }, [email]);

  // Save rate limiting data to AsyncStorage
  const saveRateLimitData = async (attempts: number, rateLimited: boolean = false, rateLimitDuration: number = 0) => {
    try {
      const key = `resend_data_${email}`;
      const data = {
        attempts,
        lastTime: Date.now(),
        rateLimited,
        rateLimitEnd: rateLimited ? Date.now() + (rateLimitDuration * 1000) : 0,
      };
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving rate limit data:', error);
    }
  };

  // Countdown timer for resend button
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Reset rate limiting when countdown reaches 0
            setIsRateLimited(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [countdown]);

  const checkEmailVerification = async () => {
    setLoading(true);
    try {
      let user = auth.currentUser;
      
      // If user is not signed in, temporarily sign them in to check verification
      if (!user && password) {
        console.log('🔄 User not signed in, temporarily signing in to check verification...');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
        console.log('✅ Temporarily signed in user:', user.uid);
      }
      
      if (user) {
        // Reload user to get the latest email verification status
        await reload(user);
        
        if (user.emailVerified) {
          // Update Firestore to mark email as verified
          const { doc, updateDoc, getDoc } = await import('firebase/firestore');
          const { db } = await import('../../firebase');
          
          await updateDoc(doc(db, 'users', user.uid), {
            emailVerified: true,
            verifiedAt: new Date().toISOString(),
          });

          // Set the correct user type
          const finalUserType = userType || 'user';
          
          // Check if this is a regular user who hasn't set preferences yet
          if (finalUserType === 'user') {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const hasSetPreferences = userData?.hasSetPreferences;
              
              if (hasSetPreferences === false) {
                // Show preferences modal for first-time regular users
                console.log('🎯 Email verified - showing preferences modal for regular user');
                setLoading(false);
                setCurrentUserId(user.uid);
                setShowPreferencesModal(true);
                return; // Don't set user type yet or show alert
              }
            }
          }
          
          // For business users or users who already set preferences
          setUserType(finalUserType);
          
          Alert.alert(
            'Email Verified!',
            `Your email has been successfully verified. Welcome to Karetou${finalUserType === 'business' ? ', Business Owner' : ''}!`,
            [
              {
                text: 'Continue',
                onPress: () => {
                  // Navigation will be handled by AuthContext
                },
              },
            ]
          );
        } else {
          // Sign out again if we temporarily signed in and email is not verified
          if (password && !auth.currentUser) {
            await auth.signOut();
          }
          
          Alert.alert(
            'Email Not Verified',
            'Please check your email and click the verification link. If you cannot find the email, check your spam folder.',
            [
              {
                text: 'OK',
              },
            ]
          );
        }
      } else {
        Alert.alert(
          'Error',
          'Please sign in again to verify your email.',
          [
            {
              text: 'Sign In',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Email verification check error:', error);
      Alert.alert('Error', 'Failed to check email verification status. Please try again.');
    } finally {
      if (!showPreferencesModal) {
        setLoading(false);
      }
    }
  };

  const handlePreferencesClose = async (preferences: string[]) => {
    setShowPreferencesModal(false);
    
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      // Update user preferences in Firestore
      if (preferences.length > 0) {
        await updateDoc(doc(db, 'users', currentUserId), {
          preferences: preferences,
          hasSetPreferences: true,
        });
      } else {
        // User skipped preferences
        await updateDoc(doc(db, 'users', currentUserId), {
          hasSetPreferences: true,
        });
      }
      
      // Now set the user type to complete verification and navigate
      setUserType('user');
      Alert.alert(
        'Welcome to Karetou!',
        'Your account is ready. Let\'s explore!',
        [
          {
            text: 'Continue',
            onPress: () => {
              // Navigation will be handled by AuthContext
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      // Still set user type even if preferences fail
      setUserType('user');
      Alert.alert('Error', 'Failed to save preferences, but you can continue using the app.');
    }
  };

  const getCountdownTime = (attempts: number): number => {
    // Exponential backoff: 60s, 120s, 300s (5min), 600s (10min)
    const baseTimes = [60, 120, 300, 600];
    return baseTimes[Math.min(attempts, baseTimes.length - 1)];
  };

  const resendVerificationEmail = async () => {
    if (countdown > 0 || isRateLimited) return;

    // Client-side rate limiting check
    const now = Date.now();
    const timeSinceLastResend = now - lastResendTime;
    const minInterval = resendAttempts > 2 ? 300000 : resendAttempts > 0 ? 120000 : 60000; // 5min, 2min, 1min
    
    if (timeSinceLastResend < minInterval && lastResendTime > 0) {
      const remainingTime = Math.ceil((minInterval - timeSinceLastResend) / 1000);
      setCountdown(remainingTime);
      Alert.alert(
        'Please Wait', 
        `Please wait ${Math.ceil(remainingTime / 60)} minute(s) before resending.`
      );
      return;
    }

    setResendLoading(true);
    setLastResendTime(now);
    
    try {
      let user = auth.currentUser;
      
      // If user is not signed in, temporarily sign them in to send verification email
      if (!user && password) {
        console.log('🔄 User not signed in, temporarily signing in to resend email...');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
        console.log('✅ Temporarily signed in user:', user.uid);
      }
      
      if (user) {
        await sendEmailVerification(user);
        
        // Sign out the user again after sending email
        if (password) {
          await auth.signOut();
          console.log('🔐 User signed out again after sending verification email');
        }
        
        // Increment attempts and set longer countdown
        const newAttempts = resendAttempts + 1;
        setResendAttempts(newAttempts);
        const countdownTime = getCountdownTime(newAttempts);
        setCountdown(countdownTime);
        
        // Save rate limiting data
        await saveRateLimitData(newAttempts, false, 0);
        
        Alert.alert(
          'Email Sent',
          `A new verification email has been sent to your email address.${
            newAttempts > 1 ? ` Next resend available in ${Math.floor(countdownTime / 60)} minutes.` : ''
          }`,
        );
      } else {
        Alert.alert(
          'Error',
          'Unable to resend verification email. Please try signing up again.',
          [
            {
              text: 'Go to Sign Up',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Resend email error:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      
      let errorMessage = 'Failed to resend verification email. Please try again.';
      let countdownTime = 60;
      
      // Get error code from different possible locations
      const errorCode = error?.code || error?.error?.code || '';
      const errorMsg = error?.message || error?.error?.message || '';
      
      // Handle specific error cases
      if (errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found') {
        errorMessage = 'Unable to resend email. Please try signing up again.';
      } else if (errorCode === 'auth/too-many-requests' || errorMsg.includes('too-many-requests')) {
        console.log('🚫 Firebase rate limiting detected - setting cooldown');
        setIsRateLimited(true);
        
        // For first-time rate limiting, use a longer cooldown since Firebase is already blocking
        const isFirstAttempt = resendAttempts === 0;
        countdownTime = isFirstAttempt ? 900 : 600; // 15 minutes for first detection, 10 minutes for subsequent
        
        setCountdown(countdownTime);
        await saveRateLimitData(Math.max(resendAttempts, 1), true, countdownTime);
        
        errorMessage = isFirstAttempt 
          ? 'Your account has been temporarily rate-limited by Firebase due to too many recent email requests. Please wait 15 minutes before trying again.'
          : 'Too many requests detected. You have been temporarily blocked. Please wait 10 minutes before trying again.';
      } else if (errorCode === 'auth/quota-exceeded' || errorMsg.includes('quota-exceeded')) {
        console.log('🚫 Quota exceeded - setting 30 minute cooldown');
        setIsRateLimited(true);
        countdownTime = 1800; // 30 minutes for quota exceeded
        setCountdown(countdownTime);
        await saveRateLimitData(resendAttempts, true, countdownTime);
        errorMessage = 'Daily email limit exceeded. Please try again in 30 minutes or contact support.';
      } else if (errorMsg.includes('too many') || errorMsg.includes('rate limit')) {
        console.log('🚫 Generic rate limiting detected');
        setIsRateLimited(true);
        countdownTime = 300; // 5 minutes for generic rate limiting
        setCountdown(countdownTime);
        await saveRateLimitData(resendAttempts, true, countdownTime);
        errorMessage = 'Too many attempts. Please wait 5 minutes before trying again.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setResendLoading(false);
    }
  };

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
      position: 'relative',
    },
    logoImage: {
      width: '80%',
      height: '80%',
      resizeMode: 'contain',
    },
    iconWrapper: {
      position: 'relative',
      marginBottom: spacing.md * spacingMultiplier,
    },
    iconCircle: {
      width: getResponsiveWidth(logoSizePercent),
      height: getResponsiveWidth(logoSizePercent),
      borderRadius: getResponsiveWidth(logoSizePercent / 2),
      backgroundColor: 'rgba(102, 126, 234, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md * spacingMultiplier,
    },
    checkmarkBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: '#fff',
      borderRadius: borderRadius.md,
      padding: spacing.xs,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
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
    emailBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.lg,
      marginTop: spacing.sm * spacingMultiplier,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    email: {
      marginLeft: spacing.sm,
    },
    formContainer: {
      width: '100%',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: borderRadius.xl,
      padding: spacing.lg * spacingMultiplier,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    instructionsCard: {
      marginBottom: spacing.md * spacingMultiplier,
    },
    instructionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md * spacingMultiplier,
    },
    stepBadge: {
      width: getResponsiveWidth(8),
      height: getResponsiveWidth(8),
      borderRadius: getResponsiveWidth(4),
      backgroundColor: '#667eea',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    stepNumber: {
      color: '#fff',
      fontSize: fontSizes.sm,
      fontWeight: 'bold',
    },
    instructionText: {
      flex: 1,
      fontSize: fontSizes.md,
      color: '#333',
      lineHeight: fontSizes.md * 1.4,
    },
    noteCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF3E0',
      padding: spacing.md * spacingMultiplier,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md * spacingMultiplier,
      borderLeftWidth: 4,
      borderLeftColor: '#FF9800',
    },
    noteText: {
      flex: 1,
      fontSize: fontSizes.sm,
      color: '#E65100',
      marginLeft: spacing.sm,
      lineHeight: fontSizes.sm * 1.4,
    },
    cooldownCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#E3F2FD',
      padding: spacing.md * spacingMultiplier,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md * spacingMultiplier,
      borderLeftWidth: 4,
      borderLeftColor: '#2196F3',
    },
    cooldownText: {
      flex: 1,
      fontSize: fontSizes.sm,
      color: '#1565C0',
      marginLeft: spacing.sm,
      lineHeight: fontSizes.sm * 1.4,
    },
    warningCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFEBEE',
      padding: spacing.md * spacingMultiplier,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md * spacingMultiplier,
      borderLeftWidth: 4,
      borderLeftColor: '#F44336',
    },
    warningText: {
      flex: 1,
      fontSize: fontSizes.sm,
      color: '#C62828',
      marginLeft: spacing.sm,
      lineHeight: fontSizes.sm * 1.4,
    },
    buttonContainer: {
      marginTop: spacing.md * spacingMultiplier,
    },
    button: {
      flexDirection: 'row',
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
    verifyButton: {
      backgroundColor: '#4CAF50',
    },
    resendButton: {
      backgroundColor: '#fff',
      borderWidth: 2,
      borderColor: '#667eea',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: fontSizes.md,
      fontWeight: '600',
      marginLeft: spacing.sm,
    },
    verifyButtonText: {
      color: '#fff',
    },
    resendButtonText: {
      color: '#667eea',
    },
    resendButtonTextDisabled: {
      color: '#999',
    },
    footer: {
      alignItems: 'center',
      marginTop: spacing.xl * spacingMultiplier,
      paddingTop: spacing.lg * spacingMultiplier,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm * spacingMultiplier,
    },
    backButtonText: {
      fontSize: fontSizes.md,
      fontWeight: '600',
    },
  });

  return (
    <LinearGradient colors={['#F5F5F5', '#F5F5F5']} style={styles.container}>
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
              <ResponsiveView style={styles.iconWrapper}>
                <ResponsiveView style={styles.iconCircle}>
                  <Ionicons name="mail" size={iconSizes.xxl} color="#667eea" />
                </ResponsiveView>
                <ResponsiveView style={styles.checkmarkBadge}>
                  <Ionicons name="checkmark-circle" size={iconSizes.lg} color="#4CAF50" />
                </ResponsiveView>
              </ResponsiveView>
              <ResponsiveText size={isSmallDevice ? "xl" : isTablet ? "xxxl" : "xxl"} weight="bold" color="#000" style={styles.title}>
                Verify Your Email
              </ResponsiveText>
              <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} color="#666" style={styles.subtitle}>
                We've sent a verification link to:
              </ResponsiveText>
              <ResponsiveView style={styles.emailBadge}>
                <Ionicons name="mail-outline" size={iconSizes.sm} color="#667eea" />
                <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "sm"} weight="600" color="#667eea" style={styles.email}>
                  {email}
                </ResponsiveText>
              </ResponsiveView>
            </ResponsiveView>

            {/* Form */}
            <ResponsiveView style={styles.formContainer}>
            {/* Instructions */}
            <ResponsiveView style={styles.instructionsCard}>
              <ResponsiveView style={styles.instructionItem}>
                <ResponsiveView style={styles.stepBadge}>
                  <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "sm"} weight="bold" color="#fff" style={styles.stepNumber}>
                    1
                  </ResponsiveText>
                </ResponsiveView>
                <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "md"} color="#333" style={styles.instructionText}>
                  Check your email inbox
                </ResponsiveText>
              </ResponsiveView>
              
              <ResponsiveView style={styles.instructionItem}>
                <ResponsiveView style={styles.stepBadge}>
                  <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "sm"} weight="bold" color="#fff" style={styles.stepNumber}>
                    2
                  </ResponsiveText>
                </ResponsiveView>
                <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "md"} color="#333" style={styles.instructionText}>
                  Click the verification link
                </ResponsiveText>
              </ResponsiveView>
              
              <ResponsiveView style={styles.instructionItem}>
                <ResponsiveView style={styles.stepBadge}>
                  <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "sm"} weight="bold" color="#fff" style={styles.stepNumber}>
                    3
                  </ResponsiveText>
                </ResponsiveView>
                <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "md"} color="#333" style={styles.instructionText}>
                  Return here and click "I've Verified"
                </ResponsiveText>
              </ResponsiveView>
            </ResponsiveView>

            {/* Important Note */}
            <ResponsiveView style={styles.noteCard}>
              <Ionicons name="information-circle" size={iconSizes.md} color="#FF9800" />
              <ResponsiveText size={isSmallDevice ? "xs" : isTablet ? "sm" : "sm"} color="#E65100" style={styles.noteText}>
                Check your spam folder if you don't see the email
              </ResponsiveText>
            </ResponsiveView>

            {/* Cooldown Info */}
            {resendAttempts === 0 && countdown > 60 && (
              <ResponsiveView style={styles.cooldownCard}>
                <Ionicons name="time-outline" size={iconSizes.md} color="#2196F3" />
                <ResponsiveText size={isSmallDevice ? "xs" : isTablet ? "sm" : "sm"} color="#1565C0" style={styles.cooldownText}>
                  Please wait 2 minutes. This gives the email time to arrive.
                </ResponsiveText>
              </ResponsiveView>
            )}

            {resendAttempts > 1 && (
              <ResponsiveView style={styles.warningCard}>
                <Ionicons name="warning-outline" size={iconSizes.md} color="#F44336" />
                <ResponsiveText size={isSmallDevice ? "xs" : isTablet ? "sm" : "sm"} color="#C62828" style={styles.warningText}>
                  Multiple resends detected. Longer delays applied to prevent spam.
                </ResponsiveText>
              </ResponsiveView>
            )}

            {/* Buttons */}
            <ResponsiveView style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.verifyButton, loading && styles.buttonDisabled]}
                onPress={checkEmailVerification}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Ionicons name="sync" size={iconSizes.md} color="#fff" />
                    <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} weight="600" color="#fff" style={[styles.buttonText, styles.verifyButtonText]}>
                      Checking...
                    </ResponsiveText>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={iconSizes.md} color="#fff" />
                    <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} weight="600" color="#fff" style={[styles.buttonText, styles.verifyButtonText]}>
                      I've Verified My Email
                    </ResponsiveText>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.resendButton,
                  (resendLoading || countdown > 0 || isRateLimited) && styles.buttonDisabled,
                ]}
                onPress={resendVerificationEmail}
                disabled={resendLoading || countdown > 0 || isRateLimited}
              >
                {resendLoading ? (
                  <>
                    <Ionicons name="sync" size={iconSizes.md} color="#667eea" />
                    <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} weight="600" color="#667eea" style={[styles.buttonText, styles.resendButtonText]}>
                      Sending...
                    </ResponsiveText>
                  </>
                ) : countdown > 0 ? (
                  <>
                    <Ionicons 
                      name={isRateLimited ? "warning-outline" : "time-outline"} 
                      size={iconSizes.md} 
                      color="#999" 
                    />
                    <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} weight="600" color="#999" style={[styles.buttonText, styles.resendButtonTextDisabled]}>
                      {resendAttempts === 0 && countdown > 60
                        ? `Wait ${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')}`
                        : countdown >= 60 
                        ? `Wait ${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')}`
                        : `Resend in ${countdown}s`
                      }
                    </ResponsiveText>
                  </>
                ) : (
                  <>
                    <Ionicons name="mail-outline" size={iconSizes.md} color="#667eea" />
                    <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "lg" : "md"} weight="600" color="#667eea" style={[styles.buttonText, styles.resendButtonText]}>
                      {resendAttempts > 0 ? `Resend Email (${resendAttempts})` : 'Resend Email'}
                    </ResponsiveText>
                  </>
                )}
              </TouchableOpacity>
            </ResponsiveView>
            </ResponsiveView>

            {/* Footer */}
            <ResponsiveView style={styles.footer}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.navigate('Login')}
              >
                <Ionicons name="arrow-back" size={iconSizes.md} color="#667eea" />
                <ResponsiveText size={isSmallDevice ? "sm" : isTablet ? "md" : "md"} weight="600" color="#667eea" style={styles.backButtonText}>
                  Back to Sign In
                </ResponsiveText>
              </TouchableOpacity>
            </ResponsiveView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <UserPreferencesModal
        visible={showPreferencesModal}
        onClose={handlePreferencesClose}
      />
    </LinearGradient>
  );
};

export default EmailVerificationScreen;
