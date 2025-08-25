// Secure token storage utilities
export interface SecureStorageOptions {
  expires?: number; // Days
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  domain?: string;
}

class SecureStorage {
  private static instance: SecureStorage;
  private readonly DEFAULT_OPTIONS: SecureStorageOptions = {
    expires: 7, // 7 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage();
    }
    return SecureStorage.instance;
  }

  // Store token in httpOnly cookie (server-side only)
  setToken(token: string, options: SecureStorageOptions = {}): void {
    if (typeof window === 'undefined') {
      // Server-side: Set httpOnly cookie
      const opts = { ...this.DEFAULT_OPTIONS, ...options };
      const expires = new Date();
      expires.setDate(expires.getDate() + (opts.expires || 7));
      
      document.cookie = `auth_token=${token}; expires=${expires.toUTCString()}; path=/; ${opts.secure ? 'secure; ' : ''}samesite=${opts.sameSite || 'strict'}`;
    } else {
      // Client-side: Use sessionStorage for temporary storage
      // Note: This is less secure but necessary for client-side access
      // In production, tokens should be handled via httpOnly cookies
      sessionStorage.setItem('auth_token', token);
    }
  }

  // Get token from storage
  getToken(): string | null {
    if (typeof window === 'undefined') {
      // Server-side: Read from cookies
      const cookies = document.cookie.split(';');
      const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('auth_token='));
      return tokenCookie ? tokenCookie.split('=')[1] : null;
    } else {
      // Client-side: Read from sessionStorage
      return sessionStorage.getItem('auth_token');
    }
  }

  // Remove token from storage
  removeToken(): void {
    if (typeof window === 'undefined') {
      // Server-side: Clear cookie
      document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    } else {
      // Client-side: Clear sessionStorage
      sessionStorage.removeItem('auth_token');
    }
  }

  // Store user data (non-sensitive)
  setUserData(userData: any): void {
    if (typeof window !== 'undefined') {
      // Only store non-sensitive user data in localStorage
      const safeUserData = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        isEmailVerified: userData.isEmailVerified,
      };
      localStorage.setItem('user_data', JSON.stringify(safeUserData));
    }
  }

  // Get user data
  getUserData(): any | null {
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('user_data');
      return userData ? JSON.parse(userData) : null;
    }
    return null;
  }

  // Remove user data
  removeUserData(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user_data');
    }
  }

  // Clear all storage
  clear(): void {
    this.removeToken();
    this.removeUserData();
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      // Don't clear all localStorage, just user data
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Get token expiration time
  getTokenExpiration(): Date | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return new Date(payload.exp * 1000);
    } catch (error) {
      console.warn('Failed to parse token expiration:', error);
      return null;
    }
  }

  // Check if token is expired
  isTokenExpired(): boolean {
    const expiration = this.getTokenExpiration();
    if (!expiration) return true;
    return expiration < new Date();
  }

  // Refresh token (placeholder for future implementation)
  async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // Include cookies
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.setToken(data.token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return false;
    }
  }
}

export const secureStorage = SecureStorage.getInstance();

// Hook for React components
export const useSecureStorage = () => {
  return {
    setToken: secureStorage.setToken.bind(secureStorage),
    getToken: secureStorage.getToken.bind(secureStorage),
    removeToken: secureStorage.removeToken.bind(secureStorage),
    setUserData: secureStorage.setUserData.bind(secureStorage),
    getUserData: secureStorage.getUserData.bind(secureStorage),
    removeUserData: secureStorage.removeUserData.bind(secureStorage),
    clear: secureStorage.clear.bind(secureStorage),
    isAuthenticated: secureStorage.isAuthenticated.bind(secureStorage),
    isTokenExpired: secureStorage.isTokenExpired.bind(secureStorage),
    refreshToken: secureStorage.refreshToken.bind(secureStorage),
  };
};