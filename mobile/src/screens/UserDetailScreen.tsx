import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, rateApi, pgApi } from '../api';
import { useAuthStore } from '../store/auth';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: { params: { userId: string } };
};

export default function UserDetailScreen({ navigation, route }: Props) {
  const userId = route.params?.userId;
  const queryClient = useQueryClient();
  const [showAssignPG, setShowAssignPG] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userApi.getUserById(userId),
    enabled: !!userId,
  });

  const { data: ratesData } = useQuery({
    queryKey: ['user-rates', userId],
    queryFn: () => rateApi.getRatesForUser(userId),
    enabled: !!userId,
  });

  const { data: pgsData } = useQuery({
    queryKey: ['available-pgs'],
    queryFn: () => pgApi.getAvailablePGs(),
    enabled: showAssignPG,
  });

  const approveMutation = useMutation({
    mutationFn: ({ approved }: { approved: boolean }) => userApi.approveUser(userId, approved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      Alert.alert('Success', 'User status updated');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Failed'),
  });

  const assignPGMutation = useMutation({
    mutationFn: (pgId: string) => userApi.assignPG(userId, pgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-rates', userId] });
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      setShowAssignPG(false);
      Alert.alert('Success', 'Payment gateway assigned');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Failed to assign PG'),
  });

  const u = data?.data?.data ?? data?.data;
  // Backend returns an array of assignments directly in `data`
  const assignments = ratesData?.data?.data ?? ratesData?.data ?? [];
  const pgs = pgsData?.data?.data ?? pgsData?.data ?? [];
  const currentUser = useAuthStore((s) => s.user);

  if (!userId || isLoading) return <View style={styles.centered}><ActivityIndicator size="large" color="#6366f1" /></View>;
  if (!u) return <View style={styles.centered}><Text style={styles.empty}>User not found</Text></View>;
  const isPending = u.status === 'PENDING_APPROVAL' || u.status === 'PENDING_ONBOARDING';
  const canAssign = ['ADMIN', 'WHITE_LABEL', 'MASTER_DISTRIBUTOR', 'DISTRIBUTOR'].includes(currentUser?.role || '') && u.status === 'ACTIVE';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.name}>{u.firstName} {u.lastName || ''}</Text>
        <Text style={styles.email}>{u.email}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{u.role?.replace('_', ' ')}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={[styles.value, styles.status]}>{u.status}</Text>
        </View>
        {u.phone ? <View style={styles.row}><Text style={styles.label}>Phone</Text><Text style={styles.value}>{u.phone}</Text></View> : null}
        {u.schema?.name ? <View style={styles.row}><Text style={styles.label}>Schema</Text><Text style={styles.value}>{u.schema.name}</Text></View> : null}
      </View>
      {isPending && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.approveBtn} onPress={() => approveMutation.mutate({ approved: true })} disabled={approveMutation.isPending}>
            <Text style={styles.approveBtnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={() => Alert.alert('Reject', 'Reject this user?', [{ text: 'Cancel' }, { text: 'Reject', style: 'destructive', onPress: () => approveMutation.mutate({ approved: false }) }])} disabled={approveMutation.isPending}>
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
      {canAssign && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assigned PGs</Text>
            {assignments.length === 0 ? (
              <Text style={styles.muted}>No payment gateways assigned.</Text>
            ) : (
              assignments.map((a: any) => (
                <View key={a.pgId || a.id} style={styles.pgRow}>
                  <Text style={styles.pgName}>{a.paymentGateway?.name || a.pgName || a.pgId}</Text>
                  {a.payinRate != null && <Text style={styles.rate}>Payin: {(Number(a.payinRate) * 100).toFixed(2)}%</Text>}
                </View>
              ))
            )}
          </View>
          <TouchableOpacity style={styles.assignBtn} onPress={() => setShowAssignPG(true)}>
            <Ionicons name="add-circle-outline" size={20} color="#6366f1" />
            <Text style={styles.assignBtnText}>Assign Payment Gateway</Text>
          </TouchableOpacity>
        </>
      )}
      <Modal visible={showAssignPG} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign PG</Text>
              <TouchableOpacity onPress={() => setShowAssignPG(false)}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            </View>
            <FlatList
              data={pgs}
              keyExtractor={(item: any) => item.id}
              renderItem={({ item }: { item: any }) => (
                <TouchableOpacity
                  style={styles.pgItem}
                  onPress={() => {
                    Alert.alert('Assign', `Assign ${item.name} to this user?`, [
                      { text: 'Cancel' },
                      { text: 'Assign', onPress: () => assignPGMutation.mutate(item.id) },
                    ]);
                  }}
                  disabled={assignPGMutation.isPending}
                >
                  <Text style={styles.pgItemName}>{item.name}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#71717a" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.muted}>No PGs available</Text>}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' },
  empty: { color: '#71717a' },
  card: { backgroundColor: '#111118', borderRadius: 12, padding: 16, marginBottom: 16 },
  name: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  email: { fontSize: 14, color: '#a1a1aa', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 14, color: '#71717a' },
  value: { fontSize: 14, color: '#fff', fontWeight: '500' },
  status: { color: '#f59e0b' },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  approveBtn: { flex: 1, backgroundColor: '#10b981', padding: 14, borderRadius: 12, alignItems: 'center' },
  approveBtnText: { color: '#fff', fontWeight: '600' },
  rejectBtn: { flex: 1, backgroundColor: 'rgba(239,68,68,0.2)', padding: 14, borderRadius: 12, alignItems: 'center' },
  rejectBtnText: { color: '#ef4444', fontWeight: '600' },
  section: { backgroundColor: '#111118', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
  pgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  pgName: { fontSize: 14, color: '#fff' },
  rate: { fontSize: 13, color: '#10b981' },
  muted: { fontSize: 14, color: '#71717a', marginTop: 8 },
  assignBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#6366f1', borderStyle: 'dashed' },
  assignBtnText: { color: '#6366f1', fontWeight: '600', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#111118', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  pgItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  pgItemName: { fontSize: 16, color: '#fff' },
});
