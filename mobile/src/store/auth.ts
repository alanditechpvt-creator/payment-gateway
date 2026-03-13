import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  updateUser: (user: Partial<User> | null) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  
  setAuth: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(user));
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  updateUser: (userUpdate) => {
    set((state) => {
      if (!userUpdate) return { user: null };
      const next = state.user ? { ...state.user, ...userUpdate } : (userUpdate as User);
      return { user: next };
    });
  },

  logout: async () => {
    // For mobile quick login (MPIN / biometric), keep refreshToken + user in SecureStore
    // and only clear the in-memory auth state + accessToken.
    await SecureStore.deleteItemAsync('accessToken');
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
  
  initialize: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      const userString = await SecureStore.getItemAsync('user');
      
      if (accessToken && refreshToken && userString) {
        const user = JSON.parse(userString);
        set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false });
    }
  },
}));

