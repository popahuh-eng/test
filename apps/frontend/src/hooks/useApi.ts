// ============================================================
// API Fetch Hook with JWT Auth Injection
// ============================================================
import { useAuthStore } from '../store/auth';

interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const { token, clearAuth } = useAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAuth();
    if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `HTTP error ${response.status}`);
  }

  return result.data !== undefined ? result.data : result;
}
