import React, { useState, useRef, useEffect } from 'react';
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
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { 
  PhoneAuthProvider, 
  signInWithCredential, 
  signInWithPhoneNumber 
} from 'firebase/auth';
import { auth } from '../../firebase';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Home: undefined;
  SMSOTP: undefined;
};

type SMSOTPScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SMSOTP'>;

interface Props {
  navigation: SMSOTPScreenNavigationProp;
}

const SMSOTPScreen: React.FC<Props> = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verificationId, setVerificationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const otpInputs = useRef<TextInput[]>([]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handlePhoneNumberChange = (text: string) => {
    console.log('Input text:', text);
    // For debugging, just set the text directly
    setPhoneNumber(text);
  };

  const formatPhoneNumber = (text: string) => {
    // Format as +63 XXX XXX XXXX for Philippine numbers
    if (text.length <= 3) {
      return `+63 ${text}`;
    } else if (text.length <= 6) {
      return `+63 ${text.slice(0, 3)} ${text.slice(3)}`;
    } else if (text.length <= 9) {
      return `+63 ${text.slice(0, 3)} ${text.slice(3, 6)} ${text.slice(6)}`;
    } else {
      return `+63 ${text.slice(0, 3)} ${text.slice(3, 6)} ${text.slice(6, 10)}`;
    }
  };

  const sendOTP = async () => {
    if (!phoneNumber || phoneNumber.replace(/\D/g, '').length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit Philippine phone number');
      return;
    }

    setLoading(true);
    try {
      // Format phone number for Firebase (E.164 format for Philippines: +63XXXXXXXXXX)
      const formattedPhone = `+63${phoneNumber.replace(/\D/g, '')}`;
      console.log('Sending OTP to:', formattedPhone);
      
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone);
      setVerificationId(confirmationResult.verificationId);
      setCodeSent(true);
      setCountdown(60); // 60 second countdown
      Alert.alert('Success', 'OTP sent to your Philippine phone number!');
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/argument-error') {
        Alert.alert(
          'Phone Auth Not Available', 
          'Phone authentication requires a development build. Please use Expo Development Build or test on a physical device.',
          [
            { text: 'OK', onPress: () => console.log('OK Pressed') },
            { text: 'Learn More', onPress: () => {
              // You can add a link to documentation here
              console.log('Learn more pressed');
            }}
          ]
        );
      } else if (error.code === 'auth/invalid-phone-number') {
        Alert.alert('Error', 'Invalid phone number format. Please check your number.');
      } else if (error.code === 'auth/too-many-requests') {
        Alert.alert('Error', 'Too many requests. Please try again later.');
      } else {
        Alert.alert('Error', `Failed to send OTP: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-focus next input
    if (text && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const verifyOTP = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otpString);
      await signInWithCredential(auth, credential);
      Alert.alert('Success', 'Phone number verified successfully!');
      // Navigation will be handled by AuthContext
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      Alert.alert('Error', 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = () => {
    if (countdown === 0) {
      sendOTP();
    }
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Phone Verification</Text>
            </View>

            {/* Logo/Icon */}
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="phone-portrait" size={60} color="#667eea" />
              </View>
            </View>

            {/* Phone Number Input */}
            {!codeSent ? (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Enter your Philippine phone number</Text>
                
                {/* Info Note */}
                <View style={styles.infoContainer}>
                  <Ionicons name="information-circle" size={16} color="#fff" />
                  <Text style={styles.infoText}>
                    Note: Phone auth requires a development build for testing
                  </Text>
                </View>
                
                <View style={styles.phoneInputContainer}>
                  <Ionicons name="call" size={20} color="#667eea" style={styles.inputIcon} />
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Enter phone number"
                    placeholderTextColor="#999"
                    value={phoneNumber}
                    onChangeText={handlePhoneNumberChange}
                    keyboardType="numeric"
                    maxLength={20}
                    editable={true}
                    autoFocus={false}
                    onFocus={() => console.log('Phone input focused')}
                    onBlur={() => console.log('Phone input blurred')}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.sendButton, loading && styles.disabledButton]}
                  onPress={sendOTP}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.sendButtonText}>Send OTP</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* OTP Input */
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Enter the 6-digit code</Text>
                <Text style={styles.subLabel}>
                  We've sent a verification code to {phoneNumber}
                </Text>
                
                <View style={styles.otpContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => {
                        if (ref) otpInputs.current[index] = ref;
                      }}
                      style={styles.otpInput}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      keyboardType="numeric"
                      maxLength={1}
                      textAlign="center"
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.verifyButton, loading && styles.disabledButton]}
                  onPress={verifyOTP}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.verifyButtonText}>Verify OTP</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.resendButton, countdown > 0 && styles.disabledButton]}
                  onPress={resendOTP}
                  disabled={countdown > 0}
                >
                  <Text style={styles.resendButtonText}>
                    {countdown > 0 
                      ? `Resend code in ${countdown}s` 
                      : 'Resend code'
                    }
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                By continuing, you agree to our Terms of Service and Privacy Policy
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  backButton: {
    padding: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  inputContainer: {
    marginBottom: 30,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subLabel: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
    opacity: 0.8,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
    minHeight: 50,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputIcon: {
    marginRight: 10,
  },
  phoneInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  sendButton: {
    backgroundColor: '#667eea',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  verifyButton: {
    backgroundColor: '#667eea',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
  },
  resendButtonText: {
    color: '#fff',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  disabledButton: {
    opacity: 0.6,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.7,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 5,
  },
});

export default SMSOTPScreen; 