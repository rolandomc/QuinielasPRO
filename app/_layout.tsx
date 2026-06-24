import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

// Rutas que requieren sesión activa pero NO son (tabs) ni pago
const RUTAS_AUTENTICADAS = ['admin', 'admin-retiros', 'mis-pronosticos'];

// Rutas públicas (no redirigir aunque haya sesión)
const RUTAS_PUBLICAS = ['login', 'registro', 'index'];

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const segmento = segments[0] as string | undefined;
    const inTabs = segmento === '(tabs)';
    const inPago = segmento === 'pago';
    const inRutaAutenticada = RUTAS_AUTENTICADAS.includes(segmento ?? '');
    const inRutaPublica = RUTAS_PUBLICAS.includes(segmento ?? '');

    if (!session) {
      // Sin sesión: redirigir a login si está en ruta protegida
      if (inTabs || inRutaAutenticada) {
        router.replace('/login');
      }
    } else {
      // Con sesión: redirigir a quiniela solo si está en ruta pública (login/registro)
      if (inRutaPublica) {
        router.replace('/(tabs)/quiniela');
      }
      // inPago, inTabs, inRutaAutenticada → dejar pasar sin redirigir
    }
  }, [session, loading, segments]);

  return (
    <>
      <StatusBar style={colors.statusBar} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: 'bold' },
          animation: 'fade',
          animationDuration: 180,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index"          options={{ headerShown: false }} />
        <Stack.Screen name="login"          options={{ headerShown: false }} />
        <Stack.Screen name="registro"       options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"         options={{ headerShown: false }} />
        <Stack.Screen name="mis-pronosticos" options={{ headerShown: false }} />
        <Stack.Screen name="admin"          options={{ headerShown: false }} />
        <Stack.Screen name="admin-retiros" options={{ headerShown: false }} />
        <Stack.Screen name="pago/exito"    options={{ title: 'Pago Exitoso',   headerBackVisible: false }} />
        <Stack.Screen name="pago/pendiente" options={{ title: 'Pago Pendiente', headerBackVisible: false }} />
        <Stack.Screen name="pago/error"    options={{ title: 'Pago Fallido',   headerBackVisible: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
