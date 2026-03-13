import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { beneficiaryApi } from '../api';

export default function BeneficiariesScreen() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    accountNumber: '',
    ifscCode: '',
    accountType: 'SAVINGS',
    bankName: '',
  });

  const { data, refetch, isRefetching, isLoading } = useQuery({
    queryKey: ['beneficiaries'],
    queryFn: () => beneficiaryApi.getBeneficiaries(),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => beneficiaryApi.createBeneficiary(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      setShowAdd(false);
      setForm({ name: '', accountNumber: '', ifscCode: '', accountType: 'SAVINGS', bankName: '' });
      Alert.alert('Success', 'Beneficiary added');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Failed to add beneficiary'),
  });

  const list = data?.data?.data ?? data?.data ?? [];

  const handleAdd = () => {
    if (!form.name?.trim() || !form.accountNumber?.trim() || !form.ifscCode?.trim()) {
      Alert.alert('Error', 'Name, account number and IFSC are required');
      return;
    }
    createMutation.mutate(form);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.acc}>A/c: {item.accountNumber} • IFSC: {item.ifscCode}</Text>
    </View>
  );

  if (isLoading) return <View style={styles.centered}><ActivityIndicator size="large" color="#6366f1" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Beneficiaries</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#6366f1" />}
        ListEmptyComponent={<Text style={styles.empty}>No beneficiaries. Tap + to add.</Text>}
      />
      <Modal visible={showAdd} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Beneficiary</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <TextInput style={styles.input} placeholder="Name *" placeholderTextColor="#71717a" value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} />
              <TextInput style={styles.input} placeholder="Account number *" placeholderTextColor="#71717a" value={form.accountNumber} onChangeText={(t) => setForm((f) => ({ ...f, accountNumber: t }))} keyboardType="number-pad" />
              <TextInput style={styles.input} placeholder="IFSC code *" placeholderTextColor="#71717a" value={form.ifscCode} onChangeText={(t) => setForm((f) => ({ ...f, ifscCode: t.toUpperCase() }))} autoCapitalize="characters" />
              <TextInput style={styles.input} placeholder="Bank name (optional)" placeholderTextColor="#71717a" value={form.bankName} onChangeText={(t) => setForm((f) => ({ ...f, bankName: t }))} />
              <TouchableOpacity style={styles.submitBtn} onPress={handleAdd} disabled={createMutation.isPending}>
                {createMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Add</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  addBtn: { backgroundColor: '#6366f1', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' },
  empty: { textAlign: 'center', color: '#71717a', marginTop: 24, padding: 16 },
  card: { backgroundColor: '#111118', borderRadius: 12, padding: 16, marginBottom: 12, marginHorizontal: 16 },
  name: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 4 },
  acc: { fontSize: 13, color: '#a1a1aa' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#111118', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  modalBody: { padding: 16 },
  input: { backgroundColor: '#0a0a0f', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  submitBtn: { backgroundColor: '#6366f1', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
