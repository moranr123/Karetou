import { auth } from '../../../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
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
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../firebase';
import { doc, getDoc } from 'firebase/firestore';

const { width, height } = Dimensions.get('window');

type RootStackParamList = {
  BusinessLogin: undefined;
  BusinessSignUp: undefined;
  Login: undefined;
  EmailVerification: { email: string; password?: string; userType?: 'user' | 'business' };
};

type BusinessLoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessLogin'>;

interface Props {
  navigation: BusinessLoginScreenNavigationProp;
}

export default function BusinessLogin({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setUserType } = useAuth();

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
        // Sign out the user and redirect to email verification
        await auth.signOut();
        Alert.alert(
          'Email Not Verified',
          'Please verify your email address before signing in. Check your inbox for the verification email.',
          [
            {
              text: 'Resend Email',
              onPress: () => navigation.navigate('EmailVerification', { email, password, userType: 'business' }),
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ]
        );
        return;
      }

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists() && userDoc.data().userType === 'business') {
        // Set user type as business owner
        setUserType('business');
        Alert.alert('Success', 'Welcome back, Business Owner!');
      } else {
        // Not a business user, show alert and log out
        await auth.signOut();
        Alert.alert(
          'Login Error',
          'This is not a business account. Please use the regular user login.'
        );
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
              <Text style={styles.title}>Business Login</Text>
              <Text style={styles.subtitle}>Sign in to your business account</Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
              {/* Login/Register Toggle */}
              <View style={styles.toggleContainer}>
                <TouchableOpacity style={styles.toggleButtonActive}>
                  <Text style={styles.toggleTextActive}>Log in</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.toggleButtonInactive}
                  onPress={() => navigation.navigate('BusinessSignUp')}
                >
                  <Text style={styles.toggleTextInactive}>Register</Text>
                </TouchableOpacity>
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
                  autoComplete="email"
                  textContentType="emailAddress"
                  importantForAutofill="yes"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#667eea" style={styles.inputIcon} />
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
                    size={20}
                    color="#667eea"
                  />
                </TouchableOpacity>
              </View>

              {/* Buttons */}
              <TouchableOpacity
                style={[styles.button, styles.loginButton, loading && styles.buttonDisabled]}
                onPress={signIn}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </Text>
              </TouchableOpacity>

              {/* Forgot Password */}
              <TouchableOpacity 
                style={styles.forgotPasswordButton}
                onPress={handleForgotPassword}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.forgotPasswordButton}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.forgotPasswordText}>Back to User Login</Text>
              </TouchableOpacity>
    </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

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
  loginButton: {
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
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: 15,
  },
  forgotPasswordText: {
    color: '#667eea',
    fontSize: width * 0.035,
  },
});