import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

export default function RegistroScreen() {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const procesarPago = async () => {
    if (!nombre || !telefono) {
      Alert.alert('Faltan datos', 'Ingresa tu nombre y teléfono.');
      return;
    }
    setLoading(true);

    try {
      const urlFuncion =
        'https://kdvbmvsolrquphfedldz.supabase.co/functions/v1/crear-pago';

      const response = await fetch(urlFuncion, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono }),
      });

      const data = await response.json();

      if (response.ok && data.urlPago) {
        if (Platform.OS === 'web') {
          window.open(data.urlPago, '_self');
        } else {
          await Linking.openURL(data.urlPago);
        }
      } else {
        Alert.alert('Error', data.error || 'No se pudo crear el pago.');
      }
    } catch (error) {
      Alert.alert('Error', 'Problema de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Banner superior */}
      <View style={styles.banner}>
        <Text style={styles.bannerEmoji}>⚽</Text>
        <Text style={styles.bannerTitle}>Quiniela Pro</Text>
        <Text style={styles.bannerSub}>¡Predice, juega y gana!</Text>
      </View>

      {/* Card de registro */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Registra tu lugar</Text>
        <Text style={styles.cardSub}>Costo de participación: $100 MXN</Text>

        <Text style={styles.label}>Nombre completo</Text>
        <TextInput
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Ej. Carlos Ramírez"
          placeholderTextColor="#bbb"
        />

        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={styles.input}
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="numeric"
          placeholder="Ej. 6671234567"
          placeholderTextColor="#bbb"
          maxLength={10}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={procesarPago}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? '⏳ Generando pago...' : '💳 Pagar $100.00'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Acceso directo si ya pagaste */}
      <TouchableOpacity
        style={styles.linkBtn}
        onPress={() => router.replace('/(tabs)/quiniela')}
      >
        <Text style={styles.linkTexto}>¿Ya pagaste? Ver mi quiniela →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  banner: { alignItems: 'center', marginBottom: 30 },
  bannerEmoji: { fontSize: 60 },
  bannerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  bannerSub: { fontSize: 15, color: '#009ee3', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    padding: 28,
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
    textAlign: 'center',
  },
  cardSub: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 5 },
  input: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  button: {
    backgroundColor: '#009ee3',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { backgroundColor: '#90caf9' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  linkBtn: { marginTop: 20 },
  linkTexto: { color: '#009ee3', fontSize: 14, textDecorationLine: 'underline' },
});
