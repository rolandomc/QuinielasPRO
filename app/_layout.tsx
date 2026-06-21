import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inTabs = segments[0] === '(tabs)';
    const inPago = segments[0] === 'pago';
    if (!session && inTabs) {
      router.replace('/login');
    } else if (session && !inTabs && !inPago) {
      router.replace('/(tabs)/quiniela');
    }
  }, [session, loading, segments, router]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" backgroundColor="#0d0d1a" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: '#0d0d1a' },
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="registro" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="pago/exito" options={{ title: 'Pago Exitoso', headerBackVisible: false }} />
        <Stack.Screen name="pago/error" options={{ title: 'Pago Fallido', headerBackVisible: false }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
});
