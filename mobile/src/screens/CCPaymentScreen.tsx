import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { bbpsApi, api } from '../api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function CCPaymentScreen({ navigation }: any) {
  const [mobileNumber, setMobileNumber] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [billDetails, setBillDetails] = useState<any>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Fetch Bill Mutation
  const fetchBillMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await bbpsApi.fetchBill(data);
      return res.data;
    },
    onSuccess: (data) => {
      setBillDetails(data.data);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to fetch bill');
    },
  });

  const handleFetchBill = () => {
    if (mobileNumber.length < 10) {
      Alert.alert('Invalid Input', 'Please enter a valid mobile number');
      return;
    }
    fetchBillMutation.mutate({
      category: 'CREDIT_CARD',
      mobileNumber,
      cardLast4: cardLast4 || undefined,
    });
  };

  const handlePay = async () => {
    if (!billDetails) return;
    
    try {
      setPaymentLoading(true);
      // First get available PGs
      const pgRes = await api.get('/pg/available');
      const pgs = pgRes.data.data || [];
      // Find a PG that supports payout (assuming CC payment uses payout channels)
      // or just pick the first one for now as mobile UI for selection might be complex
      // Ideally show a modal to select PG. For simplicity, we pick first payout-supporting PG.
      const payoutPg = pgs.find((p: any) => p.supportsPayout !== false);
      
      if (!payoutPg) {
        Alert.alert('Error', 'No suitable payment gateway found');
        return;
      }
      
      const res = await bbpsApi.payBill({
        amount: billDetails.billAmount,
        mobileNumber: billDetails.params.mobileNumber,
        cardLast4: billDetails.params.cardLast4,
        billerName: billDetails.billerName,
        pgId: payoutPg.id
      });
      
      Alert.alert('Success', `Payment initiated! TXN ID: ${res.data.transactionId}`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Payment failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Credit Card Payment</Text>
        <Text style={styles.subtitle}>Pay your credit card bills instantly</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Registered Mobile Number</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="phone-portrait-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={mobileNumber}
              onChangeText={(text) => setMobileNumber(text.replace(/\D/g, '').slice(0, 10))}
              placeholder="Enter 10 digit mobile number"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Last 4 Digits of Card (Optional)</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="card-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={cardLast4}
              onChangeText={(text) => setCardLast4(text.replace(/\D/g, '').slice(0, 4))}
              placeholder="e.g. 1234"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              maxLength={4}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.fetchButton}
          onPress={handleFetchBill}
          disabled={fetchBillMutation.isPending}
        >
          {fetchBillMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.fetchButtonText}>Fetch Bill</Text>
          )}
        </TouchableOpacity>
      </View>

      {billDetails && (
        <View style={styles.billCard}>
          <View style={styles.billHeader}>
            <View>
              <Text style={styles.billerName}>{billDetails.billerName}</Text>
              <Text style={styles.customerName}>{billDetails.customerName}</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>

          <View style={styles.billDetails}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Bill Date</Text>
              <Text style={styles.billValue}>{billDetails.billDate}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Due Date</Text>
              <Text style={styles.billValue}>{billDetails.dueDate}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Bill Number</Text>
              <Text style={styles.billValue}>{billDetails.billNumber}</Text>
            </View>
            <View style={[styles.billRow, styles.amountRow]}>
              <Text style={styles.billLabel}>Bill Amount</Text>
              <Text style={styles.amountValue}>₹{billDetails.billAmount.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.payButton}
            onPress={handlePay}
            disabled={paymentLoading}
          >
            {paymentLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payButtonText}>Pay ₹{billDetails.billAmount.toLocaleString('en-IN')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  form: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputIcon: {
    paddingLeft: 12,
  },
  input: {
    flex: 1,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  fetchButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  fetchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  billCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  billerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  verifiedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  verifiedText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '500',
  },
  billDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  amountRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 0,
    alignItems: 'center',
  },
  billLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  billValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  payButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
