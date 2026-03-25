import { create } from 'zustand';
import api from '../services/api';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: 'candidate' | 'admin') => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  setUser: (user: User | null) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      const { user, accessToken, refreshToken } = response.data.data || response.data;

      // Store tokens in localStorage
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Update state
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      throw error;
    }
  },

  signup: async (email: string, password: string, name: string, role: 'candidate' | 'admin') => {
    try {
      const response = await api.post('/auth/signup', {
        email,
        password,
        name,
        role,
      });

      const { user, accessToken, refreshToken } = response.data.data || response.data;

      // Store tokens in localStorage
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Update state
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      throw error;
    }
  },

  logout: () => {
    // Clear tokens from localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    // Clear state
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  refreshToken: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await api.post('/auth/refresh', {
        refreshToken,
      });

      const { accessToken } = response.data.data || response.data;

      // Store new access token
      localStorage.setItem('accessToken', accessToken);
    } catch (error) {
      // If refresh fails, logout user
      set({ user: null, isAuthenticated: false, isLoading: false });
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      throw error;
    }
  },

  setUser: (user: User | null) => {
    set({ user, isAuthenticated: !!user, isLoading: false });
  },

  checkAuth: async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');

      if (!accessToken) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      // Fetch current user profile
      const response = await api.get('/auth/profile');
      // Response shape: { status, data: { user: {...} } }
      const data = response.data.data || response.data;
      const user = data.user || data;

      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      // If profile fetch fails, try to refresh token
      try {
        await useAuthStore.getState().refreshToken();
        
        // Retry fetching profile
        const response = await api.get('/auth/profile');
        const data = response.data.data || response.data;
        const user = data.user || data;

        set({ user, isAuthenticated: true, isLoading: false });
      } catch (refreshError) {
        // If refresh also fails, logout
        set({ user: null, isAuthenticated: false, isLoading: false });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    }
  },
}));
