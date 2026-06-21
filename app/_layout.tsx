import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="pago/exito"
          options={{ title: 'Pago Exitoso', headerBackVisible: false }}
        />
        <Stack.Screen
          name="pago/error"
          options={{ title: 'Pago Fallido', headerBackVisible: false }}
        />
      </Stack>
    </>
  );
}
