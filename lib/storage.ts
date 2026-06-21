/**
 * Web-compatible AsyncStorage wrapper.
 * On web uses localStorage, on native uses @react-native-async-storage/async-storage.
 */
import { Platform } from 'react-native';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

let NativeStorage: any = null;
if (isNative) {
  NativeStorage = require('@react-native-async-storage/async-storage').default;
}

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (isNative && NativeStorage) return NativeStorage.getItem(key);
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isNative && NativeStorage) return NativeStorage.setItem(key, value);
    localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (isNative && NativeStorage) return NativeStorage.removeItem(key);
    localStorage.removeItem(key);
  },
};

export default storage;
