import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { walletApi } from '../api';
import { format } from 'date-fns';

export default function WalletScreen() {
  const { data: wallet, refetch, isRefetching } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.getWallet(),
  });
  
  const { data: transactions } = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: () => walletApi.getTransactions({ limit: 20 }),
  });
  
  const walletData = wallet?.data?.data;
  const txnData = transactions?.data?.data || [];
  
  const getTypeIcon = (type: string) => {
    const icons: Record<string, { name: string; color: string; bg: string }> = {
      CREDIT: { name: 'add-circle', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
      DEBIT: { name: 'remove-circle', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
      COMMISSION: { name: 'trending-up', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
      TRANSFER_IN: { name: 'arrow-down-circle', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
      TRANSFER_OUT: { name: 'arrow-up-circle', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
      REFUND: { name: 'refresh-circle', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
    };
    return icons[type] || icons.CREDIT;
  };
  
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366f1" />
      }
    >
      {/* Balance Card */}
      <LinearGradient
        colors={['#111118', '#1a1a24']}
        style={styles.balanceCard}
      >
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>
          ₹{Number(walletData?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>Available</Text>
            <Text style={[styles.balanceItemValue, { color: '#10b981' }]}>
              ₹{Number((walletData?.balance || 0) - (walletData?.holdBalance || 0)).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>On Hold</Text>
            <Text style={[styles.balanceItemValue, { color: '#f59e0b' }]}>
              ₹{Number(walletData?.holdBalance || 0).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      </LinearGradient>
      
      {/* Quick Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn}>
          <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.actionGradient}>
            <Ionicons name="paper-plane" size={20} color="#fff" />
          </LinearGradient>
          <Text style={styles.actionText}>Transfer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <View style={[styles.actionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
            <Ionicons name="add" size={20} color="#10b981" />
          </View>
          <Text style={styles.actionText}>Add Money</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <View style={[styles.actionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
            <Ionicons name="time" size={20} color="#f59e0b" />
          </View>
          <Text style={styles.actionText}>History</Text>
        </TouchableOpacity>
      </View>
      
      {/* Recent Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {txnData.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No wallet transactions yet</Text>
          </View>
        ) : (
          txnData.map((txn: any) => {
            const icon = getTypeIcon(txn.type);
            const isPositive = Number(txn.amount) > 0;
            return (
              <View key={txn.id} style={styles.txnItem}>
                <View style={[styles.txnIcon, { backgroundColor: icon.bg }]}>
                  <Ionicons name={icon.name as any} size={20} color={icon.color} />
                </View>
                <View style={styles.txnDetails}>
                  <Text style={styles.txnType}>{txn.type.replace('_', ' ')}</Text>
                  <Text style={styles.txnDesc}>{txn.description || 'Transaction'}</Text>
                </View>
                <View style={styles.txnRight}>
                  <Text style={[styles.txnAmount, { color: isPositive ? '#10b981' : '#ef4444' }]}>
                    {isPositive ? '+' : ''}₹{Math.abs(Number(txn.amount)).toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.txnDate}>{format(new Date(txn.createdAt), 'MMM d')}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  content: {
    padding: 16,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#71717a',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceItem: {
    flex: 1,
  },
  balanceItemLabel: {
    fontSize: 12,
    color: '#52525b',
    marginBottom: 4,
  },
  balanceItemValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionGradient: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#52525b',
  },
  txnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111118',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txnDetails: {
    flex: 1,
  },
  txnType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  txnDesc: {
    fontSize: 12,
    color: '#71717a',
  },
  txnRight: {
    alignItems: 'flex-end',
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  txnDate: {
    fontSize: 11,
    color: '#52525b',
  },
});

