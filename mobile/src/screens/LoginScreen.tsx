import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../api';
import { useAuthStore } from '../store/auth';

export default function LoginScreen() {
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mpin, setMpin] = useState('');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [forcePassword, setForcePassword] = useState(false);

  // Decide which mode to show: full credentials vs quick login only
  useEffect(() => {
    (async () => {
      try {
        const enabled = await SecureStore.getItemAsync('biometricEnabled');
        setBiometricEnabled(enabled === 'true');
      } catch {
        setBiometricEnabled(false);
      } finally {
        setBootstrapped(true);
      }
    })();
  }, []);

  const quickLoginWithRefresh = async () => {
    try {
      const storedRefresh = await SecureStore.getItemAsync('refreshToken');
      const userString = await SecureStore.getItemAsync('user');
      if (!storedRefresh || !userString) {
        Alert.alert('Session expired', 'Quick login is not available. Please sign in once with email & password.');
        // Immediately show the email/password form so user can continue
        setForcePassword(true);
        return;
      }
      setIsLoading(true);
      const resp = await authApi.refreshToken(storedRefresh);
      const { accessToken, refreshToken } = resp.data.data;
      const user = JSON.parse(userString);
      await setAuth(user, accessToken, refreshToken);
    } catch (e: any) {
      // If the refresh token is invalid/expired, clear quick-login data so the user can log in cleanly.
      if (e.response?.data?.error === 'Invalid or expired refresh token' || e.response?.status === 401) {
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('user');
        await SecureStore.deleteItemAsync('mpin');
        await SecureStore.deleteItemAsync('biometricEnabled');
        Alert.alert('Session expired', 'Please sign in with email & password to continue.');
      } else {
        Alert.alert('Error', e.response?.data?.error || 'Quick login failed. Please sign in with password.');
      }
      // If quick login fails, show the email/password form so the user isn't stuck
      setForcePassword(true);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('🔐 Attempting login with:', email);
      const response = await authApi.login(email, password);
      console.log('✅ Login successful:', response.data);
      const { user, accessToken, refreshToken } = response.data.data;
      await setAuth(user, accessToken, refreshToken);
    } catch (error: any) {
      console.error('❌ Login error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
      });
      Alert.alert('Error', error.response?.data?.error || 'Login failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!bootstrapped) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <ActivityIndicator color="#fff" />
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Once biometric is enabled, default to quick login (MPIN / biometric),
  // but allow user to force showing the password form.
  const quickOnly = biometricEnabled === true && !forcePassword;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['#6366f1', '#d946ef']}
            style={styles.logoGradient}
          >
            <Ionicons name="flash" size={40} color="#fff" />
          </LinearGradient>
          <Text style={styles.logoText}>PaymentGateway</Text>
        </View>
        
        {/* Title */}
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          {quickOnly ? 'Use MPIN or biometric to login' : 'Sign in to your account'}
        </Text>
        
        <View style={styles.form}>
          {!quickOnly && (
            <>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#71717a" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="#71717a"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#71717a" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#71717a"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#71717a"
                  />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleLogin} disabled={isLoading}>
                <LinearGradient
                  colors={['#6366f1', '#d946ef']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.button}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Sign In</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* Quick login options (shown always; when biometric is enabled, this is the default mode) */}
          <View style={{ marginTop: 24, gap: 12 }}>
            <Text style={{ color: '#71717a', fontSize: 13, marginBottom: 4 }}>Or use quick login</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={20} color="#71717a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="MPIN (if configured in Settings)"
                placeholderTextColor="#71717a"
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                value={mpin}
                onChangeText={setMpin}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: 'transparent',
                  borderWidth: 1,
                  borderColor: 'rgba(99,102,241,0.6)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                },
              ]}
              onPress={async () => {
                const stored = await SecureStore.getItemAsync('mpin');
                if (!stored) {
                  Alert.alert('Error', 'MPIN not set. Please configure it in Settings.');
                  return;
                }
                if (!mpin) {
                  Alert.alert('Error', 'Enter your MPIN');
                  return;
                }
                if (stored !== mpin) {
                  Alert.alert('Error', 'Incorrect MPIN');
                  return;
                }
                await quickLoginWithRefresh();
              }}
              disabled={isLoading}
            >
              <Ionicons name="key-outline" size={18} color="#6366f1" />
              <Text style={{ color: '#e5e7eb', fontWeight: '600' }}>Login with MPIN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: 'transparent',
                  borderWidth: 1,
                  borderColor: 'rgba(99,102,241,0.6)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                },
              ]}
              onPress={async () => {
                try {
                  const enabled = await SecureStore.getItemAsync('biometricEnabled');
                  if (enabled !== 'true') {
                    Alert.alert('Error', 'Biometric login not enabled. Turn it on in Settings.');
                    return;
                  }
                  const hasHardware = await LocalAuthentication.hasHardwareAsync();
                  const enrolled = await LocalAuthentication.isEnrolledAsync();
                  if (!hasHardware || !enrolled) {
                    Alert.alert('Error', 'Biometric authentication not available on this device.');
                    return;
                  }
                  const res = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Login with Face/Touch ID',
                    fallbackLabel: 'Use password',
                  });
                  if (res.success) {
                    await quickLoginWithRefresh();
                  }
                } catch (e: any) {
                  Alert.alert('Error', e.message || 'Biometric login failed');
                }
              }}
              disabled={isLoading}
            >
              <Ionicons name="finger-print-outline" size={18} color="#6366f1" />
              <Text style={{ color: '#e5e7eb', fontWeight: '600' }}>Login with Face/Touch ID</Text>
            </TouchableOpacity>
            {quickOnly && (
              <TouchableOpacity
                style={{ marginTop: 8, alignItems: 'center' }}
                onPress={() => setForcePassword(true)}
              >
                <Text style={{ color: '#a5b4fc', fontSize: 13 }}>
                  Trouble with quick login? Use password instead
                </Text>
              </TouchableOpacity>
            )}
            {!quickOnly && biometricEnabled && (
              <TouchableOpacity
                style={{ marginTop: 8, alignItems: 'center' }}
                onPress={() => setForcePassword(false)}
              >
                <Text style={{ color: '#a5b4fc', fontSize: 13 }}>
                  Use quick login (MPIN / biometric) instead
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#71717a',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: '#6366f1',
    fontSize: 14,
  },
  button: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

