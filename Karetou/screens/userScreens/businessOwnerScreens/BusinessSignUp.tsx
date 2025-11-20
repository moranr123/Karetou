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
import { auth, db } from '../../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

type RootStackParamList = {
  BusinessLogin: undefined;
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../../assets/logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Create Business Account</Text>
            <Text style={styles.subtitle}>Join us and grow your business</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {/* Login/Register Toggle */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={styles.toggleButtonInactive}
                onPress={() => navigation.navigate('BusinessLogin')}
              >
                <Text style={styles.toggleTextInactive}>Log in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toggleButtonActive}>
                <Text style={styles.toggleTextActive}>Register</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#999"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#667eea" style={styles.inputIcon} />
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
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#667eea" style={styles.inputIcon} />
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
                  size={20}
                  color="#667eea"
                />
              </TouchableOpacity>
            </View>

            {/* Password Requirements */}
            {password.length > 0 && (
              <View style={styles.passwordRequirementsContainer}>
                <Text style={styles.passwordRequirementsTitle}>Password Requirements:</Text>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={passwordRequirements.minLength ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={passwordRequirements.minLength ? '#4CAF50' : '#999'}
                  />
                  <Text style={[styles.requirementText, passwordRequirements.minLength && styles.requirementMet]}>
                    At least 8 characters
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={passwordRequirements.hasUppercase ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={passwordRequirements.hasUppercase ? '#4CAF50' : '#999'}
                  />
                  <Text style={[styles.requirementText, passwordRequirements.hasUppercase && styles.requirementMet]}>
                    One uppercase letter (A-Z)
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={passwordRequirements.hasLowercase ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={passwordRequirements.hasLowercase ? '#4CAF50' : '#999'}
                  />
                  <Text style={[styles.requirementText, passwordRequirements.hasLowercase && styles.requirementMet]}>
                    One lowercase letter (a-z)
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={passwordRequirements.hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={passwordRequirements.hasNumber ? '#4CAF50' : '#999'}
                  />
                  <Text style={[styles.requirementText, passwordRequirements.hasNumber && styles.requirementMet]}>
                    One number (0-9)
                  </Text>
                </View>
              </View>
            )}

            {passwordError ? (
              <Text style={styles.errorText}>{passwordError}</Text>
            ) : null}

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#667eea" style={styles.inputIcon} />
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
                  size={20}
                  color="#667eea"
                />
              </TouchableOpacity>
            </View>

            {/* Terms and Conditions */}
            <View style={styles.termsContainer}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={acceptedTerms ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={acceptedTerms ? '#667eea' : '#999'}
                />
                <View style={styles.termsTextContainer}>
                  <Text style={styles.termsText}>
                    I agree to the{' '}
                    <Text style={styles.termsLink} onPress={showTermsAndConditions}>
                      Terms and Conditions
                    </Text>
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.button, styles.signupButton, (loading || !acceptedTerms) && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading || !acceptedTerms}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>
    </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

export default BusinessSignUpScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: width * 0.05,
    paddingBottom: height * 0.02,
  },
  header: {
    alignItems: 'center',
    marginBottom: height * 0.04,
  },
  logoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: (width * 0.3) / 2,
    width: width * 0.3,
    height: width * 0.3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: height * 0.02,
  },
  logoImage: {
    width: '80%',
    height: '80%',
  },
  title: {
    fontSize: width * 0.08,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: height * 0.01,
  },
  subtitle: {
    fontSize: width * 0.04,
    color: '#666',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: width * 0.06,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: height * 0.03,
  },
  toggleButtonActive: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderColor: '#333',
  },
  toggleButtonInactive: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  toggleTextActive: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
    color: '#333',
  },
  toggleTextInactive: {
    fontSize: width * 0.045,
    color: '#aaa',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: height * 0.02,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#333',
    fontSize: width * 0.04,
  },
  eyeIcon: {
    padding: 5,
  },
  button: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginTop: 10,
  },
  signupButton: {
    backgroundColor: '#667eea',
  },
  buttonDisabled: {
    backgroundColor: '#a3a3a3',
  },
  buttonText: {
    color: '#fff',
    fontSize: width * 0.045,
    fontWeight: 'bold',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  loginLinkText: {
    color: '#667eea',
    fontSize: width * 0.035,
  },
  inputError: {
    borderColor: '#FF4444',
    borderWidth: 2,
  },
  errorText: {
    fontSize: width * 0.035,
    color: '#FF4444',
    marginTop: 5,
    marginBottom: 10,
    marginLeft: 5,
  },
  passwordRequirementsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  passwordRequirementsTitle: {
    fontSize: width * 0.038,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  requirementText: {
    fontSize: width * 0.035,
    color: '#666',
    marginLeft: 8,
  },
  requirementMet: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  termsContainer: {
    marginTop: 15,
    marginBottom: 15,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  termsTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  termsText: {
    fontSize: width * 0.035,
    color: '#666',
    lineHeight: width * 0.035 * 1.4,
  },
  termsLink: {
    color: '#667eea',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});