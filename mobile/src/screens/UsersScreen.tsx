import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../api';
import { useAuthStore } from '../store/auth';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
  businessName?: string;
  createdAt: string;
}

export default function UsersScreen() {
  const { user: currentUser } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    businessName: '',
    role: 'RETAILER',
  });

  const queryClient = useQueryClient();

  // Determine allowed child roles
  const allowedRoles = getChildRoles(currentUser?.role || 'RETAILER');

  // Fetch users
  const { data: usersData, refetch, isRefetching, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getUsers(),
    enabled: allowedRoles.length > 0,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (data: any) => userApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreateModal(false);
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        businessName: '',
        role: 'RETAILER',
      });
      Alert.alert('Success', 'User created successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create user');
    },
  });

  // Approve user mutation
  const approveUserMutation = useMutation({
    mutationFn: ({ userId, approved }: { userId: string; approved: boolean }) =>
      userApi.approveUser(userId, approved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      Alert.alert('Success', 'User status updated');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update user');
    },
  });

  const handleCreateUser = () => {
    if (!formData.email || !formData.firstName) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }
    createUserMutation.mutate(formData);
  };

  const handleApproveUser = (userId: string) => {
    Alert.alert('Approve User', 'Are you sure you want to approve this user?', [
      { text: 'Cancel' },
      {
        text: 'Approve',
        onPress: () => approveUserMutation.mutate({ userId, approved: true }),
      },
    ]);
  };

  const users = usersData?.data?.data || [];
  const filteredUsers = users.filter((u: User) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.firstName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (allowedRoles.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed-outline" size={64} color="#71717a" />
          <Text style={styles.emptyText}>No permission to manage users</Text>
          <Text style={styles.emptySubtext}>
            Only Admin, White Label, and Master Distributors can create users
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Users</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#71717a" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor="#71717a"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Users List */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366f1" />
        }
        renderItem={({ item }: { item: User }) => (
          <TouchableOpacity style={styles.userCard}>
            <View style={styles.userInfo}>
              <View style={styles.userAvatar}>
                <Text style={styles.avatarText}>
                  {item.firstName?.[0]?.toUpperCase()}
                </Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>
                  {item.firstName} {item.lastName}
                </Text>
                <Text style={styles.userEmail}>{item.email}</Text>
                <View style={styles.userMeta}>
                  <View style={[styles.badge, { backgroundColor: getRoleColor(item.role) }]}>
                    <Text style={styles.badgeText}>{item.role}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      item.status === 'ACTIVE' ? styles.statusActive : styles.statusPending,
                    ]}
                  >
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>
              </View>
            </View>
            {item.status === 'PENDING_APPROVAL' && (
              <TouchableOpacity
                style={styles.approveButton}
                onPress={() => handleApproveUser(item.id)}
              >
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#71717a" />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        }
        scrollEnabled={false}
        contentContainerStyle={styles.listContent}
      />

      {/* Create User Modal */}
      <Modal visible={showCreateModal} animationType="slide">
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create User</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Form */}
          <ScrollView style={styles.modalForm}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Email *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="user@example.com"
                placeholderTextColor="#71717a"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>First Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="John"
                placeholderTextColor="#71717a"
                value={formData.firstName}
                onChangeText={(text) => setFormData({ ...formData, firstName: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Last Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Doe"
                placeholderTextColor="#71717a"
                value={formData.lastName}
                onChangeText={(text) => setFormData({ ...formData, lastName: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Phone</Text>
              <TextInput
                style={styles.formInput}
                placeholder="+91 98765 43210"
                placeholderTextColor="#71717a"
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Business Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Your Business"
                placeholderTextColor="#71717a"
                value={formData.businessName}
                onChangeText={(text) => setFormData({ ...formData, businessName: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Role *</Text>
              <View style={styles.roleContainer}>
                {allowedRoles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      formData.role === role && styles.roleButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, role })}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        formData.role === role && styles.roleButtonTextActive,
                      ]}
                    >
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, createUserMutation.isPending && styles.submitButtonDisabled]}
              onPress={handleCreateUser}
              disabled={createUserMutation.isPending}
            >
              {createUserMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Create User</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// Helper functions
function getChildRoles(role: string): string[] {
  const roles: Record<string, string[]> = {
    ADMIN: ['WHITE_LABEL', 'MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER'],
    WHITE_LABEL: ['MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER'],
    MASTER_DISTRIBUTOR: ['DISTRIBUTOR', 'RETAILER'],
    DISTRIBUTOR: ['RETAILER'],
    RETAILER: [],
  };
  return roles[role] || [];
}

function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    ADMIN: '#ef4444',
    WHITE_LABEL: '#8b5cf6',
    MASTER_DISTRIBUTOR: '#f59e0b',
    DISTRIBUTOR: '#3b82f6',
    RETAILER: '#10b981',
  };
  return colors[role] || '#6366f1';
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: '#111118',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#fff',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111118',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    color: '#71717a',
    fontSize: 12,
    marginBottom: 6,
  },
  userMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#27272a',
  },
  statusActive: {
    backgroundColor: '#10b98133',
  },
  statusPending: {
    backgroundColor: '#f59e0b33',
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  approveButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 4,
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
  roleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    flex: 1,
    minWidth: '48%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    backgroundColor: '#111118',
  },
  roleButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  roleButtonText: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  roleButtonTextActive: {
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
