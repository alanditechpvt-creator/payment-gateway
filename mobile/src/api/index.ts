import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// For real devices, always use your machine's LAN IP.
// You can still override this via EXPO_PUBLIC_API_URL if needed.
const DEV_API_URL = 'http://192.168.31.250:4100/api';
const API_URL = process.env.EXPO_PUBLIC_API_URL || DEV_API_URL;
console.log('🌐 Mobile API URL:', API_URL);

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      console.error('Error getting token:', e);
    }
    return config;
  },
  (e) => Promise.reject(e)
);

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const orig = err.config;
    if (err.response?.status === 401 && !orig._retry) {
      if (orig.url?.includes('/auth/login') || orig.url?.includes('/auth/refresh-token')) {
        return Promise.reject(err);
      }
      orig._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken, refreshToken: newRT } = data.data;
        await SecureStore.setItemAsync('accessToken', accessToken);
        await SecureStore.setItemAsync('refreshToken', newRT);
        orig.headers.Authorization = `Bearer ${accessToken}`;
        return api(orig);
      } catch (refreshErr) {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('user');
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string, captchaToken?: string) =>
    api.post('/auth/login', { email, password, captchaToken }),
  logout: (refreshToken?: string) =>
    api.post('/auth/logout', { refreshToken }),
  refreshToken: (token: string) =>
    api.post('/auth/refresh-token', { refreshToken: token }),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Wallet (align with frontend)
export const walletApi = {
  getWallet: (userId?: string) =>
    api.get(userId ? `/wallet/${userId}` : '/wallet'),
  getTransactions: (params?: any) =>
    api.get('/wallet/transactions', { params }),
  transfer: (toUserId: string, amount: number, description?: string) =>
    api.post('/wallet/transfer', { toUserId, amount, description }),
};

// Transactions (align with frontend)
export const transactionApi = {
  getTransactions: (params?: any) => api.get('/transactions', { params }),
  getTransactionById: (id: string) => api.get(`/transactions/${id}`),
  createTransaction: (data: any) => api.post('/transactions', data),
  getStats: (params?: any) => api.get('/transactions/stats', { params }),
  checkPGStatus: (transactionId: string) =>
    api.post(`/transactions/${transactionId}/check-pg-status`),
};

// Users (frontend user API – no admin-only)
export const userApi = {
  getUsers: (params?: any) => api.get('/users', { params }),
  getUserById: (userId: string) => api.get(`/users/${userId}`),
  createUser: (data: any) => api.post('/users', data),
  updateUser: (userId: string, data: any) => api.patch(`/users/${userId}`, data),
  approveUser: (userId: string, approved: boolean, reason?: string) =>
    api.post(`/users/${userId}/approve`, { approved, reason }),
  assignPG: (userId: string, pgId: string, customRate?: number) =>
    api.post(`/users/${userId}/pg`, { pgId, customRate }),
  removePGAssignment: (userId: string, pgId: string) =>
    api.delete(`/users/${userId}/pg/${pgId}`),
  resendOnboardingEmail: (userId: string) =>
    api.post(`/users/${userId}/resend-onboarding`),
};

// PG (frontend – list and available only)
export const pgApi = {
  getPGs: (params?: any) => api.get('/pg', { params }),
  getPGById: (pgId: string) => api.get(`/pg/${pgId}`),
  // Preferred name (used by most screens)
  getAvailablePGs: () => api.get('/pg/available'),
  // Backwards-compatible alias used by Payin screen
  getAvailable: () => api.get('/pg/available'),
};

// Ledger (frontend – my ledger only; no global)
export const ledgerApi = {
  getMyLedger: (params?: any) => api.get('/ledger/my', { params }),
  exportMyLedger: (params?: { startDate?: string; endDate?: string; format?: 'json' | 'csv' }) =>
    api.get('/ledger/my/export', { params, responseType: 'blob' }),
};

// Rates (frontend – my rates, assign to downstream)
export const rateApi = {
  getMyRates: () => api.get('/rates/my-rates'),
  getMyPayinRates: () => api.get('/rates/my-payin-rates'),
  getAvailablePGsForAssignment: () => api.get('/rates/available-pgs'),
  getRatesForUser: (userId: string) => api.get(`/rates/user/${userId}/assignments`),
  assignRate: (targetUserId: string, pgId: string, payinRate?: number, payoutRate?: number) =>
    api.post('/rates/assign', { targetUserId, pgId, payinRate, payoutRate }),
  togglePGForUser: (targetUserId: string, pgId: string, isEnabled: boolean) =>
    api.patch(`/rates/toggle/${targetUserId}/${pgId}`, { isEnabled }),
};

// Beneficiaries
export const beneficiaryApi = {
  getBeneficiaries: (params?: any) => api.get('/beneficiaries', { params }),
  getBeneficiaryById: (id: string) => api.get(`/beneficiaries/${id}`),
  createBeneficiary: (data: any) => api.post('/beneficiaries', data),
  updateBeneficiary: (id: string, data: any) => api.patch(`/beneficiaries/${id}`, data),
  deleteBeneficiary: (id: string) => api.delete(`/beneficiaries/${id}`),
  lookupIfsc: (ifsc: string) => api.get(`/beneficiaries/ifsc/${ifsc}`),
};

// Payout profiles (group beneficiaries by mobile)
export const payoutProfileApi = {
  list: () => api.get('/payout-profiles'),
  getById: (id: string) => api.get(`/payout-profiles/${id}`),
  getByMobile: (mobile: string) => api.get(`/payout-profiles/by-mobile/${encodeURIComponent(mobile)}`),
  create: (data: { mobile: string; name: string; email?: string }) =>
    api.post('/payout-profiles', data),
  update: (id: string, data: any) => api.patch(`/payout-profiles/${id}`, data),
  delete: (id: string) => api.delete(`/payout-profiles/${id}`),
};

// Schemas (frontend – list/view for MD; no admin channel config)
export const schemaApi = {
  getSchemas: (params?: any) => api.get('/schemas', { params }),
  getSchemaById: (schemaId: string) => api.get(`/schemas/${schemaId}`),
};

// Announcements (ticker)
export const announcementApi = {
  getActive: () => api.get('/announcements/active'),
};

// BBPS (CC bill payment)
export const bbpsApi = {
  fetchBill: (data: any) => api.post('/bbps/fetch', data),
  payBill: (data: any) => api.post('/bbps/pay', data),
};

// Onboarding (public)
export const onboardingApi = {
  getOnboardingInfo: (token: string) =>
    axios.get(`${API_URL}/users/onboarding/${token}`),
  completeOnboarding: (token: string, formData: FormData) =>
    axios.post(`${API_URL}/users/onboarding/${token}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  sendEmailOTP: (token: string) =>
    axios.post(`${API_URL}/users/onboarding/${token}/send-otp`),
  verifyEmailOTP: (token: string, otp: string) =>
    axios.post(`${API_URL}/users/onboarding/${token}/verify-otp`, { otp }),
};
