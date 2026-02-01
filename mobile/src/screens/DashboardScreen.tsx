import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { walletApi, transactionApi } from '../api';
import { useAuthStore } from '../store/auth';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function DashboardScreen({ navigation }: Props) {
  const { user } = useAuthStore();
  
  const { data: wallet, refetch: refetchWallet, isRefetching } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.getWallet(),
  });
  
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => transactionApi.getStats(),
  });
  
  const walletData = wallet?.data?.data;
  const statsData = stats?.data?.data;
  
  const quickActions = [
    { icon: 'arrow-down', label: 'Payin', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', action: 'Payin' },
    { icon: 'arrow-up', label: 'Payout', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', action: 'Payout' },
    { icon: 'card', label: 'CC Pay', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', action: 'CCPayment' },
    { icon: 'swap-horizontal', label: 'Transfer', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', action: 'Transfer' },
  ];
  
  const handleQuickAction = (action: string) => {
    if (action === 'Payin') {
      navigation.navigate('Payin');
    } else if (action === 'Payout') {
      navigation.navigate('Payout');
    } else if (action === 'CCPayment') {
      navigation.navigate('CCPayment');
    } else if (action === 'Transfer') {
      navigation.navigate('Transfer');
    } else if (action === 'Scan') {
      // TODO: Implement QR code scanning
      alert('QR code scanning coming soon!');
    }
  };
  
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetchWallet} tintColor="#6366f1" />
      }
    >
      {/* Greeting */}
      <Text style={styles.greeting}>Hello, {user?.firstName || 'User'}! 👋</Text>
      
      {/* Balance Card */}
      <LinearGradient
        colors={['#6366f1', '#8b5cf6', '#d946ef']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.balanceCard}
      >
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>
          ₹{Number(walletData?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
        <View style={styles.balanceFooter}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>Hold</Text>
            <Text style={styles.balanceItemValue}>
              ₹{Number(walletData?.holdBalance || 0).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      </LinearGradient>
      
      {/* Quick Actions */}
      <View style={styles.quickActions}>
        {quickActions.map((action, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.quickAction}
            onPress={() => handleQuickAction(action.action)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: action.bg }]}>
              <Ionicons name={action.icon as any} size={24} color={action.color} />
            </View>
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Stats */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
            <Ionicons name="arrow-down" size={20} color="#10b981" />
          </View>
          <Text style={styles.statLabel}>Total Payin</Text>
          <Text style={styles.statValue}>
            ₹{Number(statsData?.payin?.totalAmount || 0).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.statSubtext}>{statsData?.payin?.count || 0} transactions</Text>
        </View>
        
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
            <Ionicons name="arrow-up" size={20} color="#8b5cf6" />
          </View>
          <Text style={styles.statLabel}>Total Payout</Text>
          <Text style={styles.statValue}>
            ₹{Number(statsData?.payout?.totalAmount || 0).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.statSubtext}>{statsData?.payout?.count || 0} transactions</Text>
        </View>
        
        <View style={[styles.statCard, { marginRight: 0 }]}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
            <Ionicons name="trending-up" size={20} color="#f59e0b" />
          </View>
          <Text style={styles.statLabel}>Commission</Text>
          <Text style={styles.statValue}>
            ₹{Number(statsData?.totalCommissions || 0).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.statSubtext}>Earned</Text>
        </View>
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
    padding: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
  },
  balanceCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
  },
  balanceFooter: {
    flexDirection: 'row',
  },
  balanceItem: {},
  balanceItemLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  balanceItemValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#111118',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#71717a',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statSubtext: {
    fontSize: 11,
    color: '#52525b',
  },
});

