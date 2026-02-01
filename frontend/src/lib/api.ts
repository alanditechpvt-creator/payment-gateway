import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Token refresh handling with queue to prevent concurrent refresh requests
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const onRefreshFailed = () => {
  refreshSubscribers = [];
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
};

// Response interceptor for handling token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry for login/refresh endpoints
      if (originalRequest.url?.includes('/auth/login') || 
          originalRequest.url?.includes('/auth/refresh-token')) {
        return Promise.reject(error);
      }
      
      originalRequest._retry = true;
      
      // If already refreshing, wait for the refresh to complete
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
      
      isRefreshing = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }
        
        const response = await axios.post(`${API_URL}/auth/refresh-token`, {
          refreshToken,
        });
        
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        
        isRefreshing = false;
        onRefreshed(accessToken);
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshFailed();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string, captchaToken?: string, isAdmin?: boolean) =>
    api.post('/auth/login', { email, password, captchaToken, isAdmin }),
  logout: (refreshToken?: string) =>
    api.post('/auth/logout', { refreshToken }),
  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh-token', { refreshToken }),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  // Check if CAPTCHA is required for this email
  checkCaptcha: (email: string) =>
    api.get('/auth/check-captcha', { params: { email } }),
};

// User API
export const userApi = {
  getUsers: (params?: any) => api.get('/users', { params }),
  getUserById: (userId: string) => api.get(`/users/${userId}`),
  createUser: (data: any) => api.post('/users', data),
  updateUser: (userId: string, data: any) => api.patch(`/users/${userId}`, data),
  approveUser: (userId: string, approved: boolean, reason?: string) =>
    api.post(`/users/${userId}/approve`, { approved, reason }),
  suspendUser: (userId: string) => api.post(`/users/${userId}/suspend`),
  reactivateUser: (userId: string) => api.post(`/users/${userId}/reactivate`),
  updatePermissions: (userId: string, permissions: any) =>
    api.put(`/users/${userId}/permissions`, permissions),
  assignPG: (userId: string, pgId: string, customRate?: number) =>
    api.post(`/users/${userId}/pg`, { pgId, customRate }),
  removePGAssignment: (userId: string, pgId: string) =>
    api.delete(`/users/${userId}/pg/${pgId}`),
};

// Wallet API
export const walletApi = {
  getWallet: (userId?: string) => api.get(userId ? `/wallet/${userId}` : '/wallet'),
  getTransactions: (userId?: string, params?: any) =>
    api.get(userId ? `/wallet/${userId}/transactions` : '/wallet/transactions', { params }),
  transfer: (toUserId: string, amount: number, description?: string) =>
    api.post('/wallet/transfer', { toUserId, amount, description }),
  addFunds: (userId: string, amount: number, description?: string) =>
    api.post('/wallet/add', { userId, amount, description }),
  deductFunds: (userId: string, amount: number, description?: string) =>
    api.post('/wallet/deduct', { userId, amount, description }),
};

// Ledger API
export const ledgerApi = {
  getMyLedger: (params?: any) => api.get('/ledger/my', { params }),
  getUserLedger: (userId: string, params?: any) => api.get(`/ledger/user/${userId}`, { params }),
  getGlobalLedger: (params?: any) => api.get('/ledger/global', { params }),
  exportMyLedger: (params?: any) => api.get('/ledger/my/export', { params, responseType: 'blob' }),
  exportUserLedger: (userId: string, params?: any) => api.get(`/ledger/user/${userId}/export`, { params, responseType: 'blob' }),
};

// Announcement API (News Ticker)
export const announcementApi = {
  getActive: () => api.get('/announcements/active'),
};

// Transaction API
export const transactionApi = {
  getTransactions: (params?: any) => api.get('/transactions', { params }),
  getTransactionById: (transactionId: string) => api.get(`/transactions/${transactionId}`),
  getTransactionByIdPublic: (transactionId: string) => api.get(`/transactions/public/${transactionId}`),
  createTransaction: (data: any) => api.post('/transactions', data),
  updateTransactionStatus: (transactionId: string, status: 'SUCCESS' | 'FAILED') => 
    api.patch(`/transactions/${transactionId}/status`, { status }),
  // Check status directly with Payment Gateway (OFFLINE mode)
  checkPGStatus: (transactionId: string) => 
    api.post(`/transactions/${transactionId}/check-pg-status`),
  getStats: (params?: any) => api.get('/transactions/stats', { params }),
};

// Config API (public)
export const configApi = {
  getPGMode: () => api.get('/config/pg-mode'),
};

export const bbpsApi = {
  fetchBill: (data: any) => api.post('/bbps/fetch', data),
  payBill: (data: any) => api.post('/bbps/pay', data),
};

// Payment Gateway API
export const pgApi = {
  getPGs: (params?: any) => api.get('/pg', { params }),
  getPGById: (pgId: string) => api.get(`/pg/${pgId}`),
  getAvailablePGs: () => api.get('/pg/available'),
  getPayoutSlabs: (pgId: string) => api.get(`/pg/${pgId}/payout-slabs`),
  createPG: (data: any) => api.post('/pg', data),
  updatePG: (pgId: string, data: any) => api.patch(`/pg/${pgId}`, data),
  deletePG: (pgId: string) => api.delete(`/pg/${pgId}`),
  togglePGStatus: (pgId: string, isActive: boolean) =>
    api.post(`/pg/${pgId}/toggle`, { isActive }),
  getPGStats: (pgId: string, params?: any) => api.get(`/pg/${pgId}/stats`, { params }),
};

// Onboarding API (public - no auth required)
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

// Beneficiary API
export const beneficiaryApi = {
  getBeneficiaries: (params?: any) => api.get('/beneficiaries', { params }),
  getBeneficiaryById: (beneficiaryId: string) => api.get(`/beneficiaries/${beneficiaryId}`),
  createBeneficiary: (data: any) => api.post('/beneficiaries', data),
  updateBeneficiary: (beneficiaryId: string, data: any) => api.patch(`/beneficiaries/${beneficiaryId}`, data),
  deleteBeneficiary: (beneficiaryId: string) => api.delete(`/beneficiaries/${beneficiaryId}`),
  toggleStatus: (beneficiaryId: string) => api.post(`/beneficiaries/${beneficiaryId}/toggle`),
  verifyBeneficiary: (beneficiaryId: string) => api.post(`/beneficiaries/${beneficiaryId}/verify`),
  lookupIfsc: (ifsc: string) => api.get(`/beneficiaries/ifsc/${ifsc}`),
};

// Schema API
export const schemaApi = {
  getSchemas: (params?: any) => api.get('/schemas', { params }),
  getSchemaById: (schemaId: string) => api.get(`/schemas/${schemaId}`),
  createSchema: (data: any) => api.post('/schemas', data),
  updateSchema: (schemaId: string, data: any) => api.patch(`/schemas/${schemaId}`, data),
  deleteSchema: (schemaId: string) => api.delete(`/schemas/${schemaId}`),
  setPGRates: (schemaId: string, rates: any[]) =>
    api.put(`/schemas/${schemaId}/rates`, { rates }),
  addPGRate: (schemaId: string, rate: any) =>
    api.post(`/schemas/${schemaId}/rates`, rate),
  removePGRate: (schemaId: string, pgId: string) =>
    api.delete(`/schemas/${schemaId}/rates/${pgId}`),
  assignToUser: (schemaId: string, userId: string) =>
    api.post(`/schemas/${schemaId}/assign/${userId}`),
};

// Rate Assignment API (Hierarchical commission system)
export const rateApi = {
  // Get my rates (what I'm charged for each PG)
  getMyRates: () => api.get('/rates/my-rates'),
  // Get my base rate for a specific PG
  getMyBaseRate: (pgId: string) => api.get(`/rates/my-base-rate/${pgId}`),
  // Get available PGs for rate assignment (with min assignable rates)
  getAvailablePGsForAssignment: () => api.get('/rates/available-pgs'),
  // Get children with their rates
  getChildrenRates: (pgId?: string) => api.get('/rates/children', { params: { pgId } }),
  // Assign rate to a child
  assignRate: (targetUserId: string, pgId: string, payinRate: number, payoutRate: number) =>
    api.post('/rates/assign', { targetUserId, pgId, payinRate, payoutRate }),
  // Bulk assign rates
  bulkAssignRates: (assignments: Array<{ targetUserId: string; pgId: string; payinRate: number; payoutRate: number }>) =>
    api.post('/rates/bulk-assign', { assignments }),
  // Toggle PG for a child
  togglePGForUser: (targetUserId: string, pgId: string, isEnabled: boolean) =>
    api.patch(`/rates/toggle/${targetUserId}/${pgId}`, { isEnabled }),
  // Get rate for a specific user
  getUserRate: (userId: string, pgId: string) => api.get(`/rates/user/${userId}/pg/${pgId}`),
  // Preview commission calculation
  previewCommissions: (pgId: string, amount: number, type: 'PAYIN' | 'PAYOUT') =>
    api.post('/rates/preview-commissions', { pgId, amount, type }),
};

// System Settings API
export const systemSettingsApi = {
  getPayoutConfig: () => api.get('/system-settings/payout-config'),
};

