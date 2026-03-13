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
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { transactionApi, pgApi, rateApi } from '../api';
import { useAuthStore } from '../store/auth';
import * as Location from 'expo-location';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function PayinScreen({ navigation }: Props) {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedPG, setSelectedPG] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [ratesModalPGCode, setRatesModalPGCode] = useState<string | null>(null);
  const [ratesModalData, setRatesModalData] = useState<
    Record<
      string,
      {
        paymentGateway?: { code: string };
        rates?: {
          channelName?: string;
          channelCode?: string;
          rate?: number;
          rateDisplay?: string;
          schemaRate?: number;
          schemaRateDisplay?: string;
        }[];
      }
    > | null
  >(null);
  const [loadingRatesModal, setLoadingRatesModal] = useState(false);
  const user = useAuthStore((s) => s.user);

  // Location state for payin
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
        console.warn('Failed to get location for payin', e);
      }
    })();
  }, []);

  // Fetch available payment gateways
  const { data: pgData } = useQuery({
    queryKey: ['available-pgs'],
    queryFn: () => pgApi.getAvailable(),
  });

  const pgs = pgData?.data?.data || [];

  // Create Payin transaction mutation
  const createPayinMutation = useMutation({
    mutationFn: (payload) =>
      transactionApi.createTransaction(payload),
  });

  const handleCreatePayin = async () => {
    // Validation - only amount and PG required; customer fields optional (fallback to logged-in user)
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
      const resolvedName =
        customerName.trim() ||
        [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
        user?.email ||
        'Guest';
      const resolvedEmail = customerEmail.trim() || user?.email || '';
      const resolvedPhone = customerPhone.trim() || user?.phone || '';

      const payload: any = {
        type: 'PAYIN',
        amount: Number(amount),
        pgId: selectedPG,
        customerName: resolvedName,
        customerEmail: resolvedEmail,
        customerPhone: resolvedPhone,
        description: description || `Payin from ${resolvedName}`,
      };

      if (location?.coords) {
        payload.locationLatitude = location.coords.latitude;
        payload.locationLongitude = location.coords.longitude;
        if (typeof location.coords.accuracy === 'number') {
          payload.locationAccuracyM = location.coords.accuracy;
        }
        payload.locationSource = 'MOBILE';
      }

      const result = await createPayinMutation.mutateAsync(payload);
      const transactionData = result.data.data;
      const selectedPGDetails = pgs.find((pg: any) => pg.id === selectedPG);
      const pgCode = selectedPGDetails?.code;

      if (transactionData.paymentLink) {
        // Determine payment type based on PG code
        let paymentType = 'URL';
        if (pgCode === 'RAZORPAY') {
          paymentType = 'RAZORPAY';
        } else if (pgCode === 'SABPAISA') {
          paymentType = 'SABPAISA';
        }

        navigation.navigate('PaymentWebView', {
          url: transactionData.paymentLink,
          type: paymentType,
          pgCode: pgCode,
          successUrl: 'dashboard/transactions?status=SUCCESS',
          transactionId: transactionData.id,
          orderId: transactionData.pgTransactionId || transactionData.id,
        });
        
        // Reset form
        setCustomerName('');
        setCustomerEmail('');
        setCustomerPhone('');
        setAmount('');
        setSelectedPG('');
        setDescription('');
      } else {
        Alert.alert('Success', 'Payin transaction created successfully', [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setCustomerName('');
              setCustomerEmail('');
              setCustomerPhone('');
              setAmount('');
              setSelectedPG('');
              setDescription('');
              navigation.goBack();
            },
          },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create payin transaction');
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
        <LinearGradient colors={['#10b981', '#059669']} style={styles.header}>
          <Ionicons name="arrow-down" size={32} color="#fff" />
          <Text style={styles.headerTitle}>Payin Transaction</Text>
          <Text style={styles.headerSubtitle}>Create a new payment incoming transaction</Text>
        </LinearGradient>

        {/* Form */}
        <View style={styles.form}>
          {/* Customer Details Section - optional, uses your profile if empty */}
          <Text style={styles.sectionTitle}>Customer Details (Optional)</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Customer Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#71717a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Uses your name if empty"
                placeholderTextColor="#71717a"
                value={customerName}
                onChangeText={setCustomerName}
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#71717a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter email"
                placeholderTextColor="#71717a"
                value={customerEmail}
                onChangeText={setCustomerEmail}
                keyboardType="email-address"
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#71717a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Uses your phone if empty"
                placeholderTextColor="#71717a"
                value={customerPhone}
                onChangeText={setCustomerPhone}
                keyboardType="phone-pad"
                editable={!isLoading}
              />
            </View>
          </View>

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
                    <View style={styles.pgButtonHeader}>
                      <Text
                        style={[
                          styles.pgButtonText,
                          selectedPG === pg.id && styles.pgButtonTextActive,
                        ]}
                      >
                        {pg.name}
                      </Text>
                      {/* (i) button to show schema payin rates for this PG */}
                      {pg.code ? (
                        <TouchableOpacity
                          style={styles.infoIconButton}
                          onPress={async () => {
                            try {
                              setRatesModalPGCode(pg.code);
                              setShowRatesModal(true);
                              setLoadingRatesModal(true);
                              const res = await rateApi.getMyPayinRates();
                              const data = res.data?.data?.ratesByPG ?? {};
                              setRatesModalData(data);
                            } catch (e: any) {
                              setRatesModalData(null);
                              Alert.alert('Error', 'Could not load rate details');
                            } finally {
                              setLoadingRatesModal(false);
                            }
                          }}
                        >
                          <Ionicons
                            name="information-circle-outline"
                            size={18}
                            color="#a1a1aa"
                          />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {pg.code ? (
                      <Text style={styles.pgCodeText}>{pg.code}</Text>
                    ) : null}
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
            colors={['#10b981', '#059669']}
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          >
            <TouchableOpacity
              style={styles.submitButtonContent}
              onPress={handleCreatePayin}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Create Payin</Text>
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
        {/* Rates (i) modal – schema-based payin rates per PG */}
        <Modal
          visible={showRatesModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowRatesModal(false);
            setRatesModalPGCode(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {ratesModalPGCode
                    ? `Rates for ${
                        pgs.find(
                          (p: any) =>
                            (p.code || '').toLowerCase() ===
                            (ratesModalPGCode || '').toLowerCase()
                        )?.name || ratesModalPGCode
                      }`
                    : 'Payin rates as per your schema'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowRatesModal(false);
                    setRatesModalPGCode(null);
                  }}
                >
                  <Ionicons name="close" size={22} color="#e5e7eb" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>
                Payin rates by card / channel (schema rates). Your charges are based on these.
              </Text>
              <View style={styles.modalContent}>
                {loadingRatesModal ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator size="small" color="#6366f1" />
                  </View>
                ) : ratesModalData && Object.keys(ratesModalData).length > 0 ? (
                  (() => {
                    const entries = ratesModalPGCode
                      ? Object.entries(ratesModalData).filter(
                          ([code]) =>
                            (code || '').toLowerCase() ===
                            (ratesModalPGCode || '').toLowerCase()
                        )
                      : Object.entries(ratesModalData);
                    return entries.map(([code, pgRates]: [string, any]) => (
                      <View key={code} style={styles.modalPGSection}>
                        <Text style={styles.modalPGTitle}>
                          {pgs.find(
                            (p: any) =>
                              (p.code || '').toLowerCase() === (code || '').toLowerCase()
                          )?.name || code}
                        </Text>
                        {(pgRates?.rates || []).map((r: any, idx: number) => (
                          <View key={idx} style={styles.modalRateRow}>
                            <Text style={styles.modalRateChannel}>
                              {r.channelName || r.channelCode}
                            </Text>
                            <Text style={styles.modalRateValue}>
                              {r.schemaRateDisplay ??
                                (r.schemaRate != null
                                  ? `${(Number(r.schemaRate) * 100).toFixed(2)}%`
                                  : r.rateDisplay)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ));
                  })()
                ) : (
                  <Text style={styles.modalEmpty}>No rate details available.</Text>
                )}
              </View>
            </View>
          </View>
        </Modal>
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
    backgroundColor: '#10b981',
    borderColor: '#059669',
  },
  pgButtonText: {
    color: '#94a3b8',
    fontWeight: '500',
    fontSize: 14,
  },
  pgButtonTextActive: {
    color: '#fff',
  },
  pgButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  infoIconButton: {
    paddingLeft: 4,
  },
  pgCodeText: {
    marginTop: 4,
    fontSize: 12,
    color: '#9ca3af',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    flex: 1,
    marginRight: 8,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 12,
  },
  modalContent: {
    maxHeight: '75%',
  },
  modalLoading: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPGSection: {
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(55,65,81,0.8)',
  },
  modalPGTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 6,
  },
  modalRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalRateChannel: {
    fontSize: 13,
    color: '#d1d5db',
  },
  modalRateValue: {
    fontSize: 13,
    color: '#34d399',
    fontWeight: '600',
  },
  modalEmpty: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
