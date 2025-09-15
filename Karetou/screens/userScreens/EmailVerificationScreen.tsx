import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  Image,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { auth } from '../../firebase';
import { sendEmailVerification, reload, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';

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
  const { email, password, userType } = route.params;
  const { setUserType } = useAuth();

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
          const { doc, updateDoc } = await import('firebase/firestore');
          const { db } = await import('../../firebase');
          
          await updateDoc(doc(db, 'users', user.uid), {
            emailVerified: true,
            verifiedAt: new Date().toISOString(),
          });

          // Set the correct user type
          const finalUserType = userType || 'user';
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
      setLoading(false);
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

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="mail-outline" size={80} color="#fff" />
            </View>
            <Text style={styles.title}>Verify Your Email</Text>
            <Text style={styles.subtitle}>
              We've sent a verification link to
            </Text>
            <Text style={styles.email}>{email}</Text>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructions}>
              Please check your email and click the verification link to activate your account.
            </Text>
            <Text style={styles.highlightedInstructions}>
              ⚠️ Don't forget to check your spam folder if you don't see the email in your inbox.
            </Text>
            {resendAttempts === 0 && countdown > 60 && (
              <Text style={styles.initialCooldownInfo}>
                📧 Please wait 2 minutes before resending. This gives the initial email time to arrive.
              </Text>
            )}
            {resendAttempts > 1 && (
              <Text style={styles.rateLimitInfo}>
                ⚠️ Multiple resend attempts detected. Longer delays are applied to prevent spam.
              </Text>
            )}
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={checkEmailVerification}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Checking...' : 'I\'ve Verified My Email'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.secondaryButton,
                (resendLoading || countdown > 0 || isRateLimited) && styles.buttonDisabled,
              ]}
              onPress={resendVerificationEmail}
              disabled={resendLoading || countdown > 0 || isRateLimited}
            >
              {resendLoading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.secondaryButtonText}>Sending...</Text>
                </View>
              ) : countdown > 0 ? (
                <View style={styles.countdownContainer}>
                  <Ionicons 
                    name={isRateLimited ? "warning-outline" : "time-outline"} 
                    size={20} 
                    color="rgba(255, 255, 255, 0.7)" 
                  />
                  <Text style={[styles.secondaryButtonText, styles.countdownText]}>
                    {resendAttempts === 0 && countdown > 60
                      ? `Please wait ${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')} - Email may take time to arrive`
                      : countdown >= 60 
                      ? `Wait ${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')}`
                      : `Resend in ${countdown}s`
                    }
                  </Text>
                </View>
              ) : (
                <View style={styles.resendContainer}>
                  <Ionicons name="mail-outline" size={20} color="#fff" />
                  <Text style={[styles.secondaryButtonText, { marginLeft: 8 }]}>
                    {resendAttempts > 0 ? `Resend Email (${resendAttempts} sent)` : 'Resend Email'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>


            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.linkText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 8,
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  instructionsContainer: {
    paddingHorizontal: 20,
  },
  instructions: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  subInstructions: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  highlightedInstructions: {
    fontSize: 15,
    color: '#FFE066',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 224, 102, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 224, 102, 0.3)',
  },
  initialCooldownInfo: {
    fontSize: 14,
    color: '#87CEEB',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(135, 206, 235, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(135, 206, 235, 0.3)',
    fontWeight: '500',
  },
  rateLimitInfo: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 12,
    paddingHorizontal: 10,
    fontStyle: 'italic',
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButton: {
    backgroundColor: '#fff',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#667eea',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  linkButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  linkText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textDecorationLine: 'underline',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    marginLeft: 8,
    opacity: 0.7,
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default EmailVerificationScreen;
