import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transactionApi, pgApi, payoutProfileApi, beneficiaryApi } from '../api';
import * as Location from 'expo-location';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function PayoutScreen({ navigation }: Props) {
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedPG, setSelectedPG] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const queryClient = useQueryClient();

  // Location state for payout
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location disabled',
            'To enhance security, please enable location access in your device settings.'
          );
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(loc);
      } catch (e) {
        console.warn('Failed to get location for payout', e);
      }
    })();
  }, []);

  // Payout profile (grouped by customer mobile)
  const [profileMobile, setProfileMobile] = useState('');
  const [currentProfile, setCurrentProfile] = useState<any | null>(null);
  const [showCreateProfileForm, setShowCreateProfileForm] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', email: '' });

  // Beneficiaries under current profile
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<string>('');

  // Fetch available payment gateways
  const { data: pgData } = useQuery({
    queryKey: ['available-pgs-payout'],
    queryFn: () => pgApi.getAvailable(),
  });

  const pgs = pgData?.data?.data || [];

  // Beneficiaries for current payout profile
  const {
    data: beneficiariesData,
    isLoading: loadingBeneficiaries,
    refetch: refetchBeneficiaries,
  } = useQuery({
    queryKey: ['payout-beneficiaries', currentProfile?.id],
    queryFn: () =>
      beneficiaryApi.getBeneficiaries({ profileId: currentProfile?.id, isActive: 'true' }),
    enabled: !!currentProfile?.id,
  });

  const beneficiaries = beneficiariesData?.data?.data ?? beneficiariesData?.data ?? [];
  const selectedBeneficiaryDetails = beneficiaries.find(
    (b: any) => b.id === selectedBeneficiary
  );

  // Lookup payout profile by mobile
  const lookupProfileMutation = useMutation({
    mutationFn: (mobile: string) => payoutProfileApi.getByMobile(mobile),
    onSuccess: (res) => {
      const profile = res.data?.data ?? res.data;
      if (profile) {
        setCurrentProfile(profile);
        setShowCreateProfileForm(false);
        setSelectedBeneficiary('');
        refetchBeneficiaries();
        Alert.alert('Profile found', `Profile: ${profile.name}`);
      } else {
        setCurrentProfile(null);
        setShowCreateProfileForm(true);
        setSelectedBeneficiary('');
        Alert.alert('Not found', 'No payout profile found. Please create one.');
      }
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || 'Failed to lookup profile';
      if (status === 404 || msg.toLowerCase().includes('not found')) {
        setCurrentProfile(null);
        setShowCreateProfileForm(true);
        setSelectedBeneficiary('');
        Alert.alert('Not found', 'No payout profile found. Please create one.');
      } else {
        Alert.alert('Error', msg);
      }
    },
  });

  // Create payout profile
  const createProfileMutation = useMutation({
    mutationFn: (data: { mobile: string; name: string; email?: string }) =>
      payoutProfileApi.create(data),
    onSuccess: async (res) => {
      const created = res.data?.data ?? res.data;
      if (created?.id) {
        try {
          const full = await payoutProfileApi.getById(created.id);
          setCurrentProfile(full.data?.data ?? full.data ?? created);
        } catch {
          setCurrentProfile(created);
        }
        setShowCreateProfileForm(false);
        setSelectedBeneficiary('');
        refetchBeneficiaries();
        Alert.alert('Success', 'Payout profile created. Add beneficiaries below.');
      }
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to create payout profile');
    },
  });

  // Add beneficiary under profile (uses name/account/IFSC fields)
  const addBeneficiaryMutation = useMutation({
    mutationFn: (data: any) => beneficiaryApi.createBeneficiary(data),
    onSuccess: (response) => {
      const created = response.data?.data ?? response.data;
      queryClient.invalidateQueries({ queryKey: ['payout-beneficiaries', currentProfile?.id] });
      refetchBeneficiaries();
      if (created?.id) setSelectedBeneficiary(created.id);
      setBeneficiaryName('');
      setAccountNumber('');
      setIfscCode('');
      Alert.alert('Success', 'Beneficiary added');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to add beneficiary');
    },
  });

  // Create Payout transaction mutation
  const createPayoutMutation = useMutation({
    mutationFn: (payload: any) => transactionApi.createTransaction(payload),
  });

  const handleCreatePayout = async () => {
    // Validation
    if (!profileMobile.trim() || profileMobile.replace(/\D/g, '').length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit customer mobile');
      return;
    }

    if (!currentProfile?.id) {
      Alert.alert('Error', 'Please lookup or create a payout profile first');
      return;
    }

    if (!selectedBeneficiary || !selectedBeneficiaryDetails) {
      Alert.alert('Error', 'Please select a beneficiary');
      return;
    }

    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!selectedPG) {
      Alert.alert('Error', 'Please select a payment gateway');
      return;
    }

    setIsLoading(true);
    try {
      const payload: any = {
        type: 'PAYOUT',
        amount: Number(amount),
        pgId: selectedPG,
        beneficiaryId: selectedBeneficiaryDetails.id,
        beneficiaryName: selectedBeneficiaryDetails.name,
        beneficiaryAccount: selectedBeneficiaryDetails.accountNumber,
        beneficiaryIfsc: selectedBeneficiaryDetails.ifscCode,
        description: description || `Payout to ${selectedBeneficiaryDetails.name}`,
      };

      if (location?.coords) {
        payload.locationLatitude = location.coords.latitude;
        payload.locationLongitude = location.coords.longitude;
        if (typeof location.coords.accuracy === 'number') {
          payload.locationAccuracyM = location.coords.accuracy;
        }
        payload.locationSource = 'MOBILE';
      }

      const result = await createPayoutMutation.mutateAsync(payload);
      
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-stats'] });

      Alert.alert('Success', 'Payout transaction created successfully', [
        {
          text: 'OK',
          onPress: () => {
            setAmount('');
            setSelectedPG('');
            setDescription('');
            setSelectedBeneficiary('');
            navigation.goBack();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create payout transaction');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient colors={['#8b5cf6', '#7c3aed']} style={styles.header}>
          <Ionicons name="arrow-up" size={32} color="#fff" />
          <Text style={styles.headerTitle}>Payout Transaction</Text>
          <Text style={styles.headerSubtitle}>Create a new payment outgoing transaction</Text>
        </LinearGradient>

        {/* Form */}
        <View style={styles.form}>
          {/* Payout Profile */}
          <Text style={styles.sectionTitle}>Payout Profile</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Customer Mobile *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#71717a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter customer mobile"
                placeholderTextColor="#71717a"
                value={profileMobile}
                onChangeText={setProfileMobile}
                keyboardType="phone-pad"
                maxLength={10}
                editable={!lookupProfileMutation.isPending && !isLoading}
              />
            </View>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                const mobile = profileMobile.replace(/\D/g, '');
                if (mobile.length !== 10) {
                  Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
                  return;
                }
                lookupProfileMutation.mutate(mobile);
              }}
              disabled={lookupProfileMutation.isPending || isLoading}
            >
              {lookupProfileMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.secondaryButtonText}>
                  {currentProfile ? 'Reload Profile' : 'Lookup Profile'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {currentProfile && (
            <View style={styles.profileSummary}>
              <Ionicons name="person-circle-outline" size={28} color="#a855f7" />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.profileName}>{currentProfile.name}</Text>
                <Text style={styles.profileSubtext}>
                  {currentProfile.mobile}
                  {currentProfile.email ? ` • ${currentProfile.email}` : ''}
                </Text>
              </View>
            </View>
          )}

          {showCreateProfileForm && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Create New Profile</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#71717a" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Customer name"
                  placeholderTextColor="#71717a"
                  value={newProfile.name}
                  onChangeText={(t) => setNewProfile((p) => ({ ...p, name: t }))}
                  editable={!createProfileMutation.isPending && !isLoading}
                />
              </View>
              <View style={[styles.inputContainer, { marginTop: 8 }]}>
                <Ionicons name="mail-outline" size={20} color="#71717a" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Customer email (optional)"
                  placeholderTextColor="#71717a"
                  value={newProfile.email}
                  onChangeText={(t) => setNewProfile((p) => ({ ...p, email: t }))}
                  keyboardType="email-address"
                  editable={!createProfileMutation.isPending && !isLoading}
                />
              </View>
              <TouchableOpacity
                style={[styles.secondaryButton, { marginTop: 8 }]}
                onPress={() => {
                  const mobile = profileMobile.replace(/\D/g, '');
                  if (mobile.length !== 10) {
                    Alert.alert('Error', 'Mobile is required to create a profile');
                    return;
                  }
                  if (!newProfile.name.trim()) {
                    Alert.alert('Error', 'Customer name is required');
                    return;
                  }
                  createProfileMutation.mutate({
                    mobile,
                    name: newProfile.name.trim(),
                    email: newProfile.email || undefined,
                  });
                }}
                disabled={createProfileMutation.isPending || isLoading}
              >
                {createProfileMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Create Profile</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Beneficiaries */}
          {currentProfile && (
            <>
              <Text style={styles.sectionTitle}>Beneficiaries</Text>
              <View style={styles.inputGroup}>
                {loadingBeneficiaries ? (
                  <View style={styles.beneficiaryListEmpty}>
                    <ActivityIndicator color="#6366f1" />
                    <Text style={styles.beneficiaryEmptyText}>Loading beneficiaries...</Text>
                  </View>
                ) : beneficiaries.length === 0 ? (
                  <View style={styles.beneficiaryListEmpty}>
                    <Text style={styles.beneficiaryEmptyText}>
                      No beneficiaries for this profile. Add one to proceed.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.beneficiaryScroll}
                    contentContainerStyle={styles.beneficiaryScrollContent}
                  >
                    {beneficiaries.map((b: any) => (
                      <TouchableOpacity
                        key={b.id}
                        style={[
                          styles.beneficiaryChip,
                          selectedBeneficiary === b.id && styles.beneficiaryChipActive,
                        ]}
                        onPress={() => setSelectedBeneficiary(b.id)}
                        disabled={isLoading}
                      >
                        <Text
                          style={[
                            styles.beneficiaryChipText,
                            selectedBeneficiary === b.id && styles.beneficiaryChipTextActive,
                          ]}
                        >
                          {b.name}
                        </Text>
                        <Text style={styles.beneficiaryChipSubtext}>
                          A/c {b.accountNumber} • {b.ifscCode}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                {/* Inline add uses existing beneficiaryName/accountNumber/ifscCode fields */}
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.label}>Add New Beneficiary (inline)</Text>
                  <View style={[styles.inputContainer, { marginBottom: 8 }]}>
                    <Ionicons name="person-outline" size={20} color="#71717a" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Beneficiary name"
                      placeholderTextColor="#71717a"
                      value={beneficiaryName}
                      onChangeText={setBeneficiaryName}
                      editable={!addBeneficiaryMutation.isPending && !isLoading}
                    />
                  </View>
                  <View style={[styles.inputContainer, { marginBottom: 8 }]}>
                    <Ionicons name="wallet-outline" size={20} color="#71717a" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Account number"
                      placeholderTextColor="#71717a"
                      value={accountNumber}
                      onChangeText={setAccountNumber}
                      keyboardType="numeric"
                      editable={!addBeneficiaryMutation.isPending && !isLoading}
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <Ionicons name="code-outline" size={20} color="#71717a" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="IFSC code (e.g., SBIN0001234)"
                      placeholderTextColor="#71717a"
                      value={ifscCode}
                      onChangeText={setIfscCode}
                      autoCapitalize="characters"
                      editable={!addBeneficiaryMutation.isPending && !isLoading}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.secondaryButton, { marginTop: 8 }]}
                    onPress={() => {
                      if (!currentProfile?.id) {
                        Alert.alert('Error', 'Create or load a payout profile first');
                        return;
                      }
                      if (
                        !beneficiaryName.trim() ||
                        !accountNumber.trim() ||
                        !ifscCode.trim()
                      ) {
                        Alert.alert(
                          'Error',
                          'Name, account number and IFSC are required to add a beneficiary'
                        );
                        return;
                      }
                      addBeneficiaryMutation.mutate({
                        name: beneficiaryName.trim(),
                        accountNumber: accountNumber.trim(),
                        ifscCode: ifscCode.trim(),
                        profileId: currentProfile.id,
                      });
                    }}
                    disabled={addBeneficiaryMutation.isPending || isLoading}
                  >
                    {addBeneficiaryMutation.isPending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.secondaryButtonText}>Add Beneficiary</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* Transaction Details Section */}
          <Text style={styles.sectionTitle}>Transaction Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount *</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={[styles.input, { paddingLeft: 10 }]}
                placeholder="Enter amount"
                placeholderTextColor="#71717a"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Payment Gateway Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Payment Gateway *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pgSelector}
              contentContainerStyle={styles.pgSelectorContent}
            >
              {pgs.length === 0 ? (
                <Text style={styles.noPGText}>No payment gateways available</Text>
              ) : (
                pgs.map((pg: any) => (
                  <TouchableOpacity
                    key={pg.id}
                    onPress={() => setSelectedPG(pg.id)}
                    style={[
                      styles.pgButton,
                      selectedPG === pg.id && styles.pgButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pgButtonText,
                        selectedPG === pg.id && styles.pgButtonTextActive,
                      ]}
                    >
                      {pg.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description (Optional)</Text>
            <View style={[styles.inputContainer, styles.textAreaContainer]}>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Add any notes or description"
                placeholderTextColor="#71717a"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Submit Button */}
          <LinearGradient
            colors={['#8b5cf6', '#7c3aed']}
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          >
            <TouchableOpacity
              style={styles.submitButtonContent}
              onPress={handleCreatePayout}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Create Payout</Text>
                </>
              )}
            </TouchableOpacity>
          </LinearGradient>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  form: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 12,
    marginTop: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
  },
  currencySymbol: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '600',
    marginRight: 4,
  },
  textAreaContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 100,
  },
  textarea: {
    textAlignVertical: 'top',
  },
  pgSelector: {
    marginBottom: 4,
  },
  pgSelectorContent: {
    paddingRight: 16,
  },
  pgButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#18181b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    marginRight: 12,
  },
  pgButtonActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#7c3aed',
  },
  pgButtonText: {
    color: '#94a3b8',
    fontWeight: '500',
    fontSize: 14,
  },
  pgButtonTextActive: {
    color: '#fff',
  },
  noPGText: {
    color: '#71717a',
    fontSize: 14,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#4b5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    paddingVertical: 12,
    marginTop: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cancelButtonText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '500',
  },
  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    marginTop: 8,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f9fafb',
  },
  profileSubtext: {
    fontSize: 12,
    color: '#9ca3af',
  },
  beneficiaryScroll: {
    marginTop: 4,
  },
  beneficiaryScrollContent: {
    paddingRight: 16,
  },
  beneficiaryChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    marginRight: 10,
  },
  beneficiaryChipActive: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
  },
  beneficiaryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  beneficiaryChipTextActive: {
    color: '#f9fafb',
  },
  beneficiaryChipSubtext: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  beneficiaryListEmpty: {
    paddingVertical: 8,
  },
  beneficiaryEmptyText: {
    fontSize: 13,
    color: '#9ca3af',
  },
});
