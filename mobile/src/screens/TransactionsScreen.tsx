import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionApi, pgApi } from '../api';
import { useAuthStore } from '../store/auth';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  transactionId: string;
  type: 'PAYIN' | 'PAYOUT';
  status: string;
  amount: number;
  pgCharges: number;
  netAmount: number;
  createdAt: string;
  customerName?: string;
  customerEmail?: string;
  pgName?: string;
}

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export default function TransactionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'PAYIN' | 'PAYOUT'>('PAYIN');
  const [formData, setFormData] = useState({
    amount: '',
    pgId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    beneficiaryName: '',
    beneficiaryAccount: '',
    beneficiaryIfsc: '',
  });

  // Fetch transactions
  const { data: transactionsData, refetch, isRefetching } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => transactionApi.getTransactions({ limit: 50 }),
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['transaction-stats'],
    queryFn: () => transactionApi.getStats(),
  });

  // Fetch available PGs
  const { data: pgsData } = useQuery({
    queryKey: ['available-pgs'],
    queryFn: () => pgApi.getAvailablePGs(),
  });

  // Create transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: (data: any) => transactionApi.createTransaction(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-stats'] });
      setShowCreateModal(false);
      resetForm();

      const transactionData = result.data.data;
      if (transactionData.type === 'PAYIN' && transactionData.paymentLink) {
        // Find PG Code
        const pgs = pgsData?.data?.data || [];
        const pg = pgs.find((p: any) => p.id === transactionData.pgId);
        const pgCode = pg?.code;

        navigation.navigate('PaymentWebView', {
          url: transactionData.paymentLink,
          type: pgCode === 'RAZORPAY' ? 'RAZORPAY' : 'URL',
          pgCode: pgCode,
          successUrl: 'dashboard/transactions?status=SUCCESS',
        });
      } else {
        Alert.alert('Success', 'Transaction created successfully');
      }
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create transaction');
    },
  });

  const resetForm = () => {
    setFormData({
      amount: '',
      pgId: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      beneficiaryName: '',
      beneficiaryAccount: '',
      beneficiaryIfsc: '',
    });
  };

  const handleCreateTransaction = () => {
    if (!formData.amount || !formData.pgId) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    const transactionData = {
      type: transactionType,
      amount: parseFloat(formData.amount),
      pgId: formData.pgId,
      ...(transactionType === 'PAYIN' && {
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
      }),
      ...(transactionType === 'PAYOUT' && {
        beneficiaryName: formData.beneficiaryName,
        beneficiaryAccount: formData.beneficiaryAccount,
        beneficiaryIfsc: formData.beneficiaryIfsc,
      }),
    };

    createTransactionMutation.mutate(transactionData);
  };

  const transactions: Transaction[] = transactionsData?.data?.data || [];
  const stats = statsData?.data?.data;
  const pgs = pgsData?.data?.data || [];

  const canCreateTransaction =
    user?.role === 'ADMIN' ||
    user?.role === 'WHITE_LABEL' ||
    user?.role === 'MASTER_DISTRIBUTOR' ||
    user?.role === 'DISTRIBUTOR' ||
    user?.role === 'RETAILER';

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isPayin = item.type === 'PAYIN';
    const statusColors: Record<string, { bg: string; text: string }> = {
      SUCCESS: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981' },
      PENDING: { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b' },
      FAILED: { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
      PROCESSING: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' },
    };
    const status = statusColors[item.status] || statusColors.PENDING;

    return (
      <TouchableOpacity style={styles.transactionItem}>
        <View
          style={[
            styles.transactionIcon,
            {
              backgroundColor: isPayin
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(139, 92, 246, 0.1)',
            },
          ]}
        >
          <Ionicons
            name={isPayin ? 'arrow-down' : 'arrow-up'}
            size={20}
            color={isPayin ? '#10b981' : '#8b5cf6'}
          />
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionId}>{item.transactionId}</Text>
          <Text style={styles.transactionSubtext}>
            {item.type} • {item.pgName || 'N/A'}
          </Text>
          <Text style={styles.transactionDate}>
            {format(new Date(item.createdAt), 'MMM d, h:mm a')}
          </Text>
        </View>
        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, { color: isPayin ? '#10b981' : '#fff' }]}>
            {isPayin ? '+' : '-'}₹{Number(item.amount).toLocaleString('en-IN')}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>
              {item.status}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Create Button */}
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        {canCreateTransaction && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="arrow-down" size={24} color="#10b981" />
            <Text style={styles.statLabel}>Total Payin</Text>
            <Text style={styles.statValue}>
              ₹{Number(stats.totalPayin || 0).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="arrow-up" size={24} color="#8b5cf6" />
            <Text style={styles.statLabel}>Total Payout</Text>
            <Text style={styles.statValue}>
              ₹{Number(stats.totalPayout || 0).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      )}

      {/* Transactions List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color="#3f3f46" />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        }
      />

      {/* Create Transaction Modal */}
      <Modal visible={showCreateModal} animationType="slide">
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Transaction</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Transaction Type Tabs */}
          <View style={styles.typeTabs}>
            <TouchableOpacity
              style={[
                styles.typeTab,
                transactionType === 'PAYIN' && styles.typeTabActive,
              ]}
              onPress={() => {
                setTransactionType('PAYIN');
                resetForm();
              }}
            >
              <Ionicons
                name="arrow-down"
                size={18}
                color={transactionType === 'PAYIN' ? '#fff' : '#71717a'}
              />
              <Text
                style={[
                  styles.typeTabText,
                  transactionType === 'PAYIN' && styles.typeTabTextActive,
                ]}
              >
                Payin
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeTab,
                transactionType === 'PAYOUT' && styles.typeTabActive,
              ]}
              onPress={() => {
                setTransactionType('PAYOUT');
                resetForm();
              }}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={transactionType === 'PAYOUT' ? '#fff' : '#71717a'}
              />
              <Text
                style={[
                  styles.typeTabText,
                  transactionType === 'PAYOUT' && styles.typeTabTextActive,
                ]}
              >
                Payout
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView style={styles.modalForm}>
            {/* Amount */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Amount *</Text>
              <View style={styles.amountInput}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.formInputAmount}
                  placeholder="0.00"
                  placeholderTextColor="#71717a"
                  value={formData.amount}
                  onChangeText={(text) =>
                    setFormData({ ...formData, amount: text.replace(/[^0-9.]/g, '') })
                  }
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Payment Gateway */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Payment Gateway *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.pgContainer}
              >
                {pgs.map((pg) => (
                  <TouchableOpacity
                    key={pg.id}
                    style={[
                      styles.pgButton,
                      formData.pgId === pg.id && styles.pgButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, pgId: pg.id })}
                  >
                    <Text
                      style={[
                        styles.pgButtonText,
                        formData.pgId === pg.id && styles.pgButtonTextActive,
                      ]}
                    >
                      {pg.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Payin Fields */}
            {transactionType === 'PAYIN' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Customer Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="John Doe"
                    placeholderTextColor="#71717a"
                    value={formData.customerName}
                    onChangeText={(text) =>
                      setFormData({ ...formData, customerName: text })
                    }
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Customer Email *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="customer@example.com"
                    placeholderTextColor="#71717a"
                    value={formData.customerEmail}
                    onChangeText={(text) =>
                      setFormData({ ...formData, customerEmail: text })
                    }
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Customer Phone</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="+91 98765 43210"
                    placeholderTextColor="#71717a"
                    value={formData.customerPhone}
                    onChangeText={(text) =>
                      setFormData({ ...formData, customerPhone: text })
                    }
                    keyboardType="phone-pad"
                  />
                </View>
              </>
            )}

            {/* Payout Fields */}
            {transactionType === 'PAYOUT' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Beneficiary Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="John Doe"
                    placeholderTextColor="#71717a"
                    value={formData.beneficiaryName}
                    onChangeText={(text) =>
                      setFormData({ ...formData, beneficiaryName: text })
                    }
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Account Number *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="1234567890123456"
                    placeholderTextColor="#71717a"
                    value={formData.beneficiaryAccount}
                    onChangeText={(text) =>
                      setFormData({ ...formData, beneficiaryAccount: text })
                    }
                    keyboardType="number-pad"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>IFSC Code *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="SBIN0001234"
                    placeholderTextColor="#71717a"
                    value={formData.beneficiaryIfsc}
                    onChangeText={(text) =>
                      setFormData({ ...formData, beneficiaryIfsc: text.toUpperCase() })
                    }
                  />
                </View>
              </>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                createTransactionMutation.isPending && styles.submitButtonDisabled,
              ]}
              onPress={handleCreateTransaction}
              disabled={createTransactionMutation.isPending}
            >
              {createTransactionMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Create Transaction</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#111118',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  statLabel: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111118',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionId: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  transactionSubtext: {
    fontSize: 11,
    color: '#71717a',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 11,
    color: '#71717a',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#52525b',
    marginTop: 12,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  typeTabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  typeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#111118',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  typeTabActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  typeTabText: {
    color: '#71717a',
    fontSize: 13,
    fontWeight: '600',
  },
  typeTabTextActive: {
    color: '#fff',
  },
  modalForm: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#111118',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111118',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  formInputAmount: {
    flex: 1,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  pgContainer: {
    marginBottom: 8,
  },
  pgButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#111118',
    borderWidth: 1,
    borderColor: '#27272a',
    marginRight: 8,
  },
  pgButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  pgButtonText: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '600',
  },
  pgButtonTextActive: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

