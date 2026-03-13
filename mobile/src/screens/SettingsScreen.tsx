import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../api';
import { useAuthStore } from '../store/auth';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function SettingsScreen({ navigation }: Props) {
  const { user, updateUser } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [mpin, setMpin] = useState('');
  const [mpinConfirm, setMpinConfirm] = useState('');

  React.useEffect(() => {
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricSupported(hasHardware && enrolled);
        const enabled = await SecureStore.getItemAsync('biometricEnabled');
        setBiometricEnabled(enabled === 'true');
      } catch {
        setBiometricSupported(false);
      }
    })();
  }, []);

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      Alert.alert('Success', 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to change password');
    },
  });

  const handleChangePassword = () => {
    if (!currentPassword.trim()) {
      Alert.alert('Error', 'Enter current password');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    changePasswordMutation.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Current password"
            placeholderTextColor="#71717a"
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="New password (min 8 characters)"
            placeholderTextColor="#71717a"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor="#71717a"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleChangePassword}
            disabled={changePasswordMutation.isPending}
          >
            {changePasswordMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Change Password</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.muted}>Email: {user?.email}</Text>
          <Text style={styles.muted}>Role: {user?.role?.replace('_', ' ')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Login</Text>
          {biometricSupported && (
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: biometricEnabled ? '#22c55e' : '#4b5563',
                  marginBottom: 12,
                },
              ]}
              onPress={async () => {
                try {
                  if (!biometricEnabled) {
                    const res = await LocalAuthentication.authenticateAsync({
                      promptMessage: 'Enable biometric login',
                    });
                    if (!res.success) return;
                    await SecureStore.setItemAsync('biometricEnabled', 'true');
                    setBiometricEnabled(true);
                  } else {
                    await SecureStore.deleteItemAsync('biometricEnabled');
                    setBiometricEnabled(false);
                  }
                } catch (e: any) {
                  Alert.alert('Error', e.message || 'Failed to update biometric setting');
                }
              }}
            >
              <Text style={styles.primaryBtnText}>
                {biometricEnabled ? 'Disable biometric login' : 'Enable biometric login'}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={styles.muted}>Set a 4–6 digit MPIN for quick login.</Text>
          <TextInput
            style={styles.input}
            placeholder="New MPIN"
            placeholderTextColor="#71717a"
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            value={mpin}
            onChangeText={setMpin}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm MPIN"
            placeholderTextColor="#71717a"
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            value={mpinConfirm}
            onChangeText={setMpinConfirm}
          />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={async () => {
              if (!mpin || mpin.length < 4) {
                Alert.alert('Error', 'MPIN must be at least 4 digits');
                return;
              }
              if (mpin !== mpinConfirm) {
                Alert.alert('Error', 'MPIN entries do not match');
                return;
              }
              try {
                await SecureStore.setItemAsync('mpin', mpin);
                setMpin('');
                setMpinConfirm('');
                Alert.alert('Success', 'MPIN saved');
              } catch (e: any) {
                Alert.alert('Error', e.message || 'Failed to save MPIN');
              }
            }}
          >
            <Text style={styles.primaryBtnText}>Save MPIN</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 12 },
  input: {
    backgroundColor: '#111118',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  primaryBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  muted: { fontSize: 14, color: '#71717a', marginBottom: 4 },
});
