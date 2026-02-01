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

export default function PayinScreen({ navigation }: Props) {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedPG, setSelectedPG] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    // Validation
    if (!customerName.trim()) {
      Alert.alert('Error', 'Please enter customer name');
      return;
    }

    if (!customerEmail.trim()) {
      Alert.alert('Error', 'Please enter customer email');
      return;
    }

    if (!customerPhone.trim()) {
      Alert.alert('Error', 'Please enter customer phone');
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
        type: 'PAYIN',
        amount: Number(amount),
        pgId: selectedPG,
        customerName,
        customerEmail,
        customerPhone,
        description: description || `Payin from ${customerName}`,
      };

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
          {/* Customer Details Section */}
          <Text style={styles.sectionTitle}>Customer Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Customer Name *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#71717a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter customer name"
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
            <Text style={styles.label}>Phone *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#71717a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter phone number"
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
