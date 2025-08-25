// Security utilities for frontend

// Input sanitization
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

// XSS prevention for HTML content
export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Secure storage with encryption (basic implementation)
export class SecureStorage {
  private static readonly STORAGE_KEY = 'secure_storage_key';
  
  private static getEncryptionKey(): string {
    // In a real implementation, this would be more secure
    // For now, using a simple key derivation
    const userAgent = navigator.userAgent;
    const timestamp = Math.floor(Date.now() / (24 * 60 * 60 * 1000)); // Daily rotation
    return btoa(`${userAgent}-${timestamp}-${this.STORAGE_KEY}`);
  }
  
  private static encrypt(data: string): string {
    try {
      const key = this.getEncryptionKey();
      // Simple XOR encryption (not cryptographically secure, but better than plaintext)
      let encrypted = '';
      for (let i = 0; i < data.length; i++) {
        encrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return btoa(encrypted);
    } catch (error) {
      console.error('Encryption failed:', error);
      return '';
    }
  }
  
  private static decrypt(encryptedData: string): string {
    try {
      const key = this.getEncryptionKey();
      const data = atob(encryptedData);
      let decrypted = '';
      for (let i = 0; i < data.length; i++) {
        decrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      return '';
    }
  }
  
  static setItem(key: string, value: string): void {
    try {
      const encrypted = this.encrypt(value);
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Failed to store encrypted data:', error);
    }
  }
  
  static getItem(key: string): string | null {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      return this.decrypt(encrypted);
    } catch (error) {
      console.error('Failed to retrieve encrypted data:', error);
      return null;
    }
  }
  
  static removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove encrypted data:', error);
    }
  }
  
  static clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear encrypted data:', error);
    }
  }
}

// CSRF token management
export class CSRFManager {
  private static readonly TOKEN_KEY = 'csrf_token';
  
  static generateToken(): string {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    this.setToken(token);
    return token;
  }
  
  static getToken(): string | null {
    return SecureStorage.getItem(this.TOKEN_KEY);
  }
  
  static setToken(token: string): void {
    SecureStorage.setItem(this.TOKEN_KEY, token);
  }
  
  static validateToken(token: string): boolean {
    const storedToken = this.getToken();
    return storedToken === token;
  }
  
  static clearToken(): void {
    SecureStorage.removeItem(this.TOKEN_KEY);
  }
}

// Input validation
export const validators = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  password: (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/(?=.*[@$!%*?&])/.test(password)) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  },
  
  url: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  
  phone: (phone: string): boolean => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  },
  
  username: (username: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }
    
    if (username.length > 30) {
      errors.push('Username cannot exceed 30 characters');
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, and underscores');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  },
};

// Rate limiting for API calls
export class RateLimiter {
  private static requests = new Map<string, { count: number; resetTime: number }>();
  
  static checkLimit(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const request = this.requests.get(key);
    
    if (!request || now > request.resetTime) {
      this.requests.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (request.count >= limit) {
      return false;
    }
    
    request.count++;
    return true;
  }
  
  static clear(): void {
    this.requests.clear();
  }
}

// Content Security Policy helper
export const CSP = {
  nonce: (): string => {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },
  
  hash: (content: string): string => {
    // In a real implementation, you'd use a proper hash function
    // This is a simplified version
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  },
};

// Secure API request wrapper
export const secureRequest = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const csrfToken = CSRFManager.getToken();
  
  const secureOptions: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      ...options.headers,
    },
    credentials: 'include',
  };
  
  return fetch(url, secureOptions);
};