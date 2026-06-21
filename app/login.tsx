import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [step, setStep] = useState<'email' | 'token'>('email');
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const enviarCodigo = async () => {
    if (!email || !nombre) {
      Alert.alert('Datos incompletos', 'Ingresa tu nombre y correo.');
      return;
    }
    const emailLimpio = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLimpio)) {
      Alert.alert('Correo invalido', 'Ingresa un correo electronico valido.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: emailLimpio,
      options: { data: { nombre } },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setStep('token');
    }
  };

  const verificarToken = async () => {
    let tokenLimpio = token.trim();
    // Extraer token de la URL si se pega el enlace completo
    const match = tokenLimpio.match(/[?&]token=([a-zA-Z0-9]+)/);
    if (match) {
      tokenLimpio = match[1];
    }
    if (!tokenLimpio) {
      Alert.alert('Token vacio', 'Pega el enlace completo.');
      return;
    }

    console.log('TOKEN A VERIFICAR:', tokenLimpio);
    console.log('EMAIL:', email.trim().toLowerCase());

    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: tokenLimpio,
      type: 'email',
    });
    setLoading(false);

    console.log('RESULTADO:', JSON.stringify({ data, error }));

    if (error) {
      Alert.alert('Error: ' + error.message, 'Solicita un nuevo enlace.');
      setToken('');
    } else if (data?.session) {
      // Sesion creada, AuthContext deberia redirigir
      console.log('SESION OK:', data.session.user?.email);
    } else {
      Alert.alert('Sin sesion', 'No se pudo crear la sesion. Intenta de nuevo.');
    }
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
          <Text style={styles.subtitulo}>Predice, juega y gana!</Text>
        </View>

        <View style={styles.card}>
          {step === 'email' ? (
            <>
              <Text style={styles.cardTitulo}>Inicia sesion</Text>
              <Text style={styles.cardSub}>Te enviaremos un enlace de acceso a tu correo</Text>

              <Text style={styles.label}>Nombre completo</Text>
              <TextInput
                style={styles.input}
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej. Carlos Ramirez"
                placeholderTextColor="#bbb"
                autoCapitalize="words"
              />

              <Text style={styles.label}>Correo electronico</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="tucorreo@gmail.com"
                placeholderTextColor="#bbb"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={enviarCodigo}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnTexto}>Enviar enlace</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.enviadoEmoji}>📧</Text>
              <Text style={styles.cardTitulo}>Revisa tu correo</Text>
              <Text style={styles.cardSub}>
                Manten presionado "Sign in" en el correo, copia el enlace y pegalo aqui.
              </Text>

              <Text style={styles.label}>Pega el enlace aqui</Text>
              <TextInput
                style={[styles.input, styles.tokenInput]}
                value={token}
                onChangeText={setToken}
                placeholder="https://kdvbmvs...supabase.co/auth/..."
                placeholderTextColor="#bbb"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                numberOfLines={3}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={verificarToken}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnTexto}>Entrar</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSecundario} onPress={enviarCodigo} disabled={loading}>
                <Text style={styles.btnSecundarioTexto}>Reenviar enlace</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSecundario} onPress={() => { setStep('email'); setToken(''); }}>
                <Text style={styles.btnSecundarioTexto}>Usar otro correo</Text>
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
  cardSub: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 16, marginTop: 6, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 5 },
  input: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },
  tokenInput: { fontSize: 12, minHeight: 80, textAlignVertical: 'top' },
  btn: { backgroundColor: '#009ee3', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  btnDisabled: { backgroundColor: '#90caf9' },
  btnTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnSecundario: { alignItems: 'center', marginTop: 14 },
  btnSecundarioTexto: { color: '#009ee3', fontSize: 14 },
  enviadoEmoji: { fontSize: 48, textAlign: 'center', marginBottom: 10 },
});
