import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);

  const enviarOTP = async () => {
    if (!email || !nombre) {
      Alert.alert('Datos incompletos', 'Ingresa tu nombre y correo.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { data: { nombre } },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setStep('otp');
    }
  };

  const verificarOTP = async () => {
    if (otp.length < 6) {
      Alert.alert('Código inválido', 'El código debe tener 6 dígitos.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: 'email',
    });
    setLoading(false);
    if (error) Alert.alert('Error', 'Código incorrecto o expirado.');
    // Si es correcto, AuthContext detecta la sesión y redirige automáticamente
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.banner}>
          <Text style={styles.emoji}>⚽</Text>
          <Text style={styles.titulo}>Quiniela Pro</Text>
          <Text style={styles.subtitulo}>¡Predice, juega y gana!</Text>
        </View>

        <View style={styles.card}>
          {step === 'email' ? (
            <>
              <Text style={styles.cardTitulo}>Inicia sesión</Text>
              <Text style={styles.cardSub}>Te enviaremos un código de 6 dígitos a tu correo</Text>

              <Text style={styles.label}>Nombre completo</Text>
              <TextInput
                style={styles.input}
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej. Carlos Ramírez"
                placeholderTextColor="#bbb"
                autoCapitalize="words"
              />

              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="tucorreo@gmail.com"
                placeholderTextColor="#bbb"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={enviarOTP}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnTexto}>Enviar código →</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.cardTitulo}>Ingresa tu código</Text>
              <Text style={styles.cardSub}>Revisá tu correo {email}</Text>

              <TextInput
                style={[styles.input, styles.inputOTP]}
                value={otp}
                onChangeText={setOtp}
                placeholder="000000"
                placeholderTextColor="#bbb"
                keyboardType="numeric"
                maxLength={6}
                textAlign="center"
              />

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={verificarOTP}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnTexto}>✅ Verificar y entrar</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkBtn} onPress={() => setStep('email')}>
                <Text style={styles.linkTexto}>← Cambiar correo</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 20 },
  banner: { alignItems: 'center', marginBottom: 30 },
  emoji: { fontSize: 64 },
  titulo: { fontSize: 34, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  subtitulo: { fontSize: 15, color: '#009ee3', marginTop: 4 },
  card: { backgroundColor: '#fff', padding: 28, borderRadius: 16, width: '100%', maxWidth: 420, elevation: 8 },
  cardTitulo: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', textAlign: 'center' },
  cardSub: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 20, marginTop: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 5 },
  input: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },
  inputOTP: { fontSize: 32, letterSpacing: 12, fontWeight: 'bold', color: '#1a1a2e', padding: 16 },
  btn: { backgroundColor: '#009ee3', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  btnDisabled: { backgroundColor: '#90caf9' },
  btnTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  linkBtn: { alignItems: 'center', marginTop: 14 },
  linkTexto: { color: '#009ee3', fontSize: 14 },
});
