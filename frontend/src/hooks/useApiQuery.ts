import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { AxiosError } from 'axios';

// Query keys for cache management
export const queryKeys = {
  user: ['user'],
  sessions: (userId?: string) => ['sessions', userId],
  session: (sessionId: string) => ['session', sessionId],
  leaderboard: (role?: string) => ['leaderboard', role],
  adminDashboard: ['admin', 'dashboard'],
  adminUsers: (filters?: any) => ['admin', 'users', filters],
  adminSessions: (filters?: any) => ['admin', 'sessions', filters],
  codingChallenges: (role: string) => ['coding', 'challenges', role],
};

// Hook for fetching user profile
export const useUserProfile = () => {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: async () => {
      const response = await api.get('/auth/profile');
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook for fetching user sessions
export const useUserSessions = (userId?: string) => {
  return useQuery({
    queryKey: queryKeys.sessions(userId),
    queryFn: async () => {
      const endpoint = userId ? `/api/sessions/user/${userId}` : '/api/sessions/user/me';
      const response = await api.get(endpoint);
      return response.data;
    },
    enabled: !!userId || true,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Hook for fetching a specific session
export const useSession = (sessionId: string) => {
  return useQuery({
    queryKey: queryKeys.session(sessionId),
    queryFn: async () => {
      const response = await api.get(`/api/sessions/${sessionId}`);
      return response.data;
    },
    enabled: !!sessionId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for fetching leaderboard
export const useLeaderboard = (role?: string) => {
  return useQuery({
    queryKey: queryKeys.leaderboard(role),
    queryFn: async () => {
      const params = role ? { role } : {};
      const response = await api.get('/api/leaderboard', { params });
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for fetching admin dashboard
export const useAdminDashboard = () => {
  return useQuery({
    queryKey: queryKeys.adminDashboard,
    queryFn: async () => {
      const response = await api.get('/api/admin/dashboard');
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Hook for fetching admin users
export const useAdminUsers = (filters?: any) => {
  return useQuery({
    queryKey: queryKeys.adminUsers(filters),
    queryFn: async () => {
      const response = await api.get('/api/admin/users', { params: filters });
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Hook for fetching admin sessions
export const useAdminSessions = (filters?: any) => {
  return useQuery({
    queryKey: queryKeys.adminSessions(filters),
    queryFn: async () => {
      const response = await api.get('/api/admin/sessions', { params: filters });
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Hook for fetching coding challenges
export const useCodingChallenges = (role: string) => {
  return useQuery({
    queryKey: queryKeys.codingChallenges(role),
    queryFn: async () => {
      const response = await api.get(`/api/coding/challenges/${role}`);
      return response.data;
    },
    enabled: !!role,
    staleTime: 30 * 60 * 1000, // 30 minutes (challenges don't change often)
  });
};

// Mutation hook for starting a session
export const useStartSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/api/sessions/start', data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate sessions cache to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions() });
    },
  });
};

// Mutation hook for completing a session
export const useCompleteSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sessionId, ...data }: any) => {
      const response = await api.post(`/api/sessions/${sessionId}/complete`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate relevant caches
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.session(variables.sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard() });
    },
  });
};

// Mutation hook for submitting an answer
export const useSubmitAnswer = () => {
  return useMutation({
    mutationFn: async ({ sessionId, ...data }: any) => {
      const response = await api.post(`/api/sessions/${sessionId}/submit-answer`, data);
      return response.data;
    },
  });
};

// Error handler helper
export const handleApiError = (error: unknown): string => {
  if (error instanceof AxiosError) {
    return error.response?.data?.message || error.message || 'An error occurred';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
};
