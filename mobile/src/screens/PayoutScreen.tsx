import React, { useState } from 'react';
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
import { useMutation, useQuery } from '@tanstack/react-query';
import { transactionApi, pgApi } from '../api';
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

  // Fetch available payment gateways
  const { data: pgData } = useQuery({
    queryKey: ['available-pgs-payout'],
    queryFn: () => pgApi.getAvailable(),
  });

  const pgs = pgData?.data?.data || [];

  // Create Payout transaction mutation
  const createPayoutMutation = useMutation({
    mutationFn: (payload) =>
      transactionApi.createTransaction(payload),
  });

  const handleCreatePayout = async () => {
    // Validation
    if (!beneficiaryName.trim()) {
      Alert.alert('Error', 'Please enter beneficiary name');
      return;
    }

    if (!accountNumber.trim()) {
      Alert.alert('Error', 'Please enter account number');
      return;
    }

    if (!ifscCode.trim()) {
      Alert.alert('Error', 'Please enter IFSC code');
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
      const payload = {
        type: 'PAYOUT',
        amount: Number(amount),
        pgId: selectedPG,
        beneficiaryName,
        accountNumber,
        ifscCode,
        description: description || `Payout to ${beneficiaryName}`,
      };

      const result = await createPayoutMutation.mutateAsync(payload);
      
      Alert.alert('Success', 'Payout transaction created successfully', [
        {
          text: 'OK',
          onPress: () => {
            // Reset form
            setBeneficiaryName('');
            setAccountNumber('');
            setIfscCode('');
            setAmount('');
            setSelectedPG('');
            setDescription('');
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
          {/* Beneficiary Details Section */}
          <Text style={styles.sectionTitle}>Beneficiary Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Beneficiary Name *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#71717a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter beneficiary name"
                placeholderTextColor="#71717a"
                value={beneficiaryName}
                onChangeText={setBeneficiaryName}
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Account Number *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="wallet-outline" size={20} color="#71717a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter account number"
                placeholderTextColor="#71717a"
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="numeric"
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>IFSC Code *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="code-outline" size={20} color="#71717a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter IFSC code (e.g., SBIN0001234)"
                placeholderTextColor="#71717a"
                value={ifscCode}
                onChangeText={setIfscCode}
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
});
