import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminAccessToken') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('adminRefreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh-token`, {
            refreshToken,
          });
          
          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          localStorage.setItem('adminAccessToken', accessToken);
          localStorage.setItem('adminRefreshToken', newRefreshToken);
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('adminAccessToken');
        localStorage.removeItem('adminRefreshToken');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string, captchaToken?: string) =>
    api.post('/auth/login', { email, password, captchaToken, isAdmin: true }),
  logout: (refreshToken?: string) =>
    api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  checkCaptcha: (email: string) =>
    api.get('/auth/check-captcha', { params: { email } }),
};

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
  getOnboardingLink: (userId: string) => api.get(`/users/${userId}/onboarding-link`),
};

export const walletApi = {
  getWallet: (userId?: string) => api.get(userId ? `/wallet/${userId}` : '/wallet'),
  addFunds: (userId: string, amount: number, description?: string) =>
    api.post('/wallet/add', { userId, amount, description }),
  deductFunds: (userId: string, amount: number, description?: string) =>
    api.post('/wallet/deduct', { userId, amount, description }),
};

export const ledgerApi = {
  getMyLedger: (params?: any) => api.get('/ledger/my', { params }),
  getUserLedger: (userId: string, params?: any) => api.get(`/ledger/user/${userId}`, { params }),
  getGlobalLedger: (params?: any) => api.get('/ledger/global', { params }),
  exportUserLedger: (userId: string, params?: any) => api.get(`/ledger/user/${userId}/export`, { params, responseType: 'blob' }),
};

export const transactionApi = {
  getTransactions: (params?: any) => api.get('/transactions', { params }),
  getStats: (params?: any) => api.get('/transactions/stats', { params }),
  updateTransactionStatus: (id: string, status: string) => api.patch(`/transactions/${id}/status`, { status }),
};

export const pgApi = {
  getPGs: (params?: any) => api.get('/pg', { params }),
  createPG: (data: any) => api.post('/pg', data),
  updatePG: (pgId: string, data: any) => api.patch(`/pg/${pgId}`, data),
  deletePG: (pgId: string) => api.delete(`/pg/${pgId}`),
  togglePGStatus: (pgId: string, isActive: boolean) =>
    api.post(`/pg/${pgId}/toggle`, { isActive }),
  getPGStats: (pgId: string, params?: any) => api.get(`/pg/${pgId}/stats`, { params }),
};

export const schemaApi = {
  getSchemas: (params?: any) => api.get('/schemas', { params }),
  getSchemaById: (schemaId: string) => api.get(`/schemas/${schemaId}`),
  createSchema: (data: any) => api.post('/schemas', data),
  updateSchema: (schemaId: string, data: any) => api.patch(`/schemas/${schemaId}`, data),
  deleteSchema: (schemaId: string) => api.delete(`/schemas/${schemaId}`),
  toggleStatus: (schemaId: string, isActive: boolean) => 
    api.post(`/schemas/${schemaId}/toggle`, { isActive }),
  setPGRates: (schemaId: string, rates: any[]) =>
    api.put(`/schemas/${schemaId}/rates`, { rates }),
  addPGRate: (schemaId: string, rate: any) =>
    api.post(`/schemas/${schemaId}/rates`, rate),
  removePGRate: (schemaId: string, pgId: string) =>
    api.delete(`/schemas/${schemaId}/rates/${pgId}`),
  
  // Assign schema to user (migrate user to new schema)
  assignToUser: (schemaId: string, userId: string) =>
    api.post(`/schemas/${schemaId}/assign/${userId}`),
  
  // Payout Slab Management (Admin Only)
  getPayoutSlabs: (schemaPGRateId: string) =>
    api.get(`/schemas/pg-rate/${schemaPGRateId}/payout-slabs`),
  setPayoutSlabs: (schemaPGRateId: string, slabs: any[]) =>
    api.put(`/schemas/pg-rate/${schemaPGRateId}/payout-slabs`, { slabs }),
  upsertPayoutSlab: (schemaPGRateId: string, data: any) =>
    api.post(`/schemas/pg-rate/${schemaPGRateId}/payout-slab`, data),
  deletePayoutSlab: (slabId: string) =>
    api.delete(`/schemas/payout-slab/${slabId}`),
  updatePayoutSettings: (schemaPGRateId: string, data: any) =>
    api.put(`/schemas/pg-rate/${schemaPGRateId}/payout-settings`, data),
};

// Rate Assignment API (Hierarchical commission system)
export const rateApi = {
  // Get available PGs for rate assignment (with min assignable rates)
  getAvailablePGsForAssignment: () => api.get('/rates/available-pgs'),
  // Get children with their rates
  getChildrenRates: (pgId?: string) => api.get('/rates/children', { params: { pgId } }),
  // Assign rate to a user
  assignRate: (targetUserId: string, pgId: string, payinRate: number, payoutRate: number) =>
    api.post('/rates/assign', { targetUserId, pgId, payinRate, payoutRate }),
  // Bulk assign rates
  bulkAssignRates: (assignments: Array<{ targetUserId: string; pgId: string; payinRate: number; payoutRate: number }>) =>
    api.post('/rates/bulk-assign', { assignments }),
  // Get rate for a specific user
  getUserRate: (userId: string, pgId: string) => api.get(`/rates/user/${userId}/pg/${pgId}`),
  // Preview commission calculation
  previewCommissions: (pgId: string, amount: number, type: 'PAYIN' | 'PAYOUT') =>
    api.post('/rates/preview-commissions', { pgId, amount, type }),
};

// Card Type Management (for PG-specific card types like visa-normal, master-corporate, etc.)
export const cardTypeApi = {
  // CRUD
  getAll: (params?: any) => api.get('/card-types', { params }),
  getByPG: (pgId: string) => api.get(`/card-types/pg/${pgId}`),
  getById: (cardTypeId: string) => api.get(`/card-types/${cardTypeId}`),
  create: (data: any) => api.post('/card-types', data),
  update: (cardTypeId: string, data: any) => api.patch(`/card-types/${cardTypeId}`, data),
  toggle: (cardTypeId: string, isActive: boolean) => api.post(`/card-types/${cardTypeId}/toggle`, { isActive }),
  delete: (cardTypeId: string) => api.delete(`/card-types/${cardTypeId}`),
  
  // Schema Card Type Rates
  getSchemaRates: (schemaId: string) => api.get(`/card-types/schema/${schemaId}/rates`),
  setSchemaRate: (schemaId: string, cardTypeId: string, payinRate: number) => 
    api.post(`/card-types/schema/${schemaId}/rate/${cardTypeId}`, { payinRate }),
  bulkSetSchemaRates: (schemaId: string, rates: Array<{ cardTypeId: string; payinRate: number }>) =>
    api.put(`/card-types/schema/${schemaId}/rates`, { rates }),
  
  // User Card Type Rates
  getUserRates: (userId: string) => api.get(`/card-types/user/${userId}/rates`),
  assignUserRate: (userId: string, cardTypeId: string, payinRate: number) =>
    api.post(`/card-types/user/${userId}/rate/${cardTypeId}`, { payinRate }),
  
  // Rate lookup
  getTransactionRate: (pgId: string, cardTypeCode?: string) =>
    api.get(`/card-types/rate/${pgId}`, { params: { cardTypeCode } }),
};

// Security Management (Admin only)
export const securityApi = {
  // Get security settings
  getSettings: () => api.get('/security/settings'),
  
  // Update a security setting (requires password confirmation)
  updateSetting: (key: string, value: string, confirmPassword: string) =>
    api.patch(`/security/settings/${key}`, { value, confirmPassword }),
  
  // Bulk update settings (requires password confirmation)
  bulkUpdateSettings: (settings: Array<{ key: string; value: string }>, confirmPassword: string) =>
    api.put('/security/settings', { settings, confirmPassword }),
  
  // Unlock a locked account (requires password confirmation)
  unlockAccount: (email: string, confirmPassword: string) =>
    api.post(`/security/unlock/${email}`, { confirmPassword }),
  
  // Get login history for a user
  getLoginHistory: (email: string, limit?: number) =>
    api.get(`/security/login-history/${email}`, { params: { limit } }),
  
  // Get failed login statistics
  getFailedLoginStats: (hours?: number) =>
    api.get('/security/failed-login-stats', { params: { hours } }),
  
  // Get CAPTCHA configuration
  getCaptchaConfig: () => api.get('/security/captcha-config'),
};

// Announcement API (News Ticker Management)
export const announcementApi = {
  getAll: (params?: any) => api.get('/announcements', { params }),
  getById: (id: string) => api.get(`/announcements/${id}`),
  getStats: () => api.get('/announcements/stats'),
  create: (data: any) => api.post('/announcements', data),
  update: (id: string, data: any) => api.patch(`/announcements/${id}`, data),
  toggle: (id: string, isActive: boolean) => api.post(`/announcements/${id}/toggle`, { isActive }),
  delete: (id: string) => api.delete(`/announcements/${id}`),
};

export const systemSettingsApi = {
  getPayoutConfig: () => api.get('/system-settings/payout-config'),
  updatePayoutConfig: (data: { activePgId: string; slabs: any[] }) =>
    api.put('/system-settings/payout-config', data),
};

