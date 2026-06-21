import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

// Storage seguro multiplataforma con soporte SSR
const ExpoSecureStoreAdapter = {
  getItem: (key: string): string | null | Promise<string | null> => {
    if (isNative) {
      const SecureStore = require('expo-secure-store');
      return SecureStore.getItemAsync(key);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string): void | Promise<void> => {
    if (isNative) {
      const SecureStore = require('expo-secure-store');
      return SecureStore.setItemAsync(key, value);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string): void | Promise<void> => {
    if (isNative) {
      const SecureStore = require('expo-secure-store');
      return SecureStore.deleteItemAsync(key);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
