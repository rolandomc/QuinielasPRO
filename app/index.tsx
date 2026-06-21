import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';

export default function RegistroQuinielaScreen() {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);

  const procesarPago = async () => {
    if (!nombre || !telefono) {
      Alert.alert('Faltan datos', 'Ingresa tu nombre y teléfono.');
      return;
    }
    setLoading(true);

    try {
      // ESTA ES LA URL DE TU FUNCIÓN EN LA NUBE
      const urlFuncion = 'https://kdvbmvsolrquphfedldz.supabase.co/functions/v1/crear-pago';
      
      const response = await fetch(urlFuncion, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono })
      });

      const data = await response.json();

      if (response.ok && data.urlPago) {
        if (Platform.OS === 'web') {
          window.open(data.urlPago, '_self');
        } else {
          Linking.openURL(data.urlPago);
        }
      } else {
        Alert.alert('Error', 'No se pudo crear el pago.');
      }
    } catch (error) {
      Alert.alert('Error', 'Problema de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>⚽ Quiniela Pro</Text>
        
        <Text style={styles.label}>Nombre:</Text>
        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} />

        <Text style={styles.label}>Teléfono:</Text>
        <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} keyboardType="numeric" />

        <TouchableOpacity style={styles.button} onPress={procesarPago} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Cargando...' : 'Pagar $100.00'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: '#fff', padding: 30, borderRadius: 10, width: '100%', maxWidth: 400, elevation: 5 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 14, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 15 },
  button: { backgroundColor: '#009ee3', padding: 15, borderRadius: 5, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});