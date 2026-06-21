import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [step, setStep] = useState<'email' | 'enviado'>('email');
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);

  // Escucha el deep link cuando el usuario toca "Sign in" en su correo
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url) return;
      // Supabase incluye access_token en el hash o query del link
      if (url.includes('access_token') || url.includes('token_hash')) {
        const { data, error } = await supabase.auth.getSessionFromUrl(url as any);
        if (error) Alert.alert('Error', 'El enlace no es válido o ya expiró.');
        // Si es correcto, AuthContext detecta la sesión y redirige automáticamente
      }
    };

    // Revisar si la app fue abierta desde un link
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });

    // Escuchar links mientras la app está abierta
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  const enviarMagicLink = async () => {
    if (!email || !nombre) {
      Alert.alert('Datos incompletos', 'Ingresa tu nombre y correo.');
      return;
    }
    const emailLimpio = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLimpio)) {
      Alert.alert('Correo inválido', 'Ingresa un correo electrónico válido.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: emailLimpio,
      options: {
        data: { nombre },
        emailRedirectTo: 'quinielapro://login',
      },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setStep('enviado');
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
          <Text style={styles.subtitulo}>¡Predice, juega y gana!</Text>
        </View>

        <View style={styles.card}>
          {step === 'email' ? (
            <>
              <Text style={styles.cardTitulo}>Inicia sesión</Text>
              <Text style={styles.cardSub}>Te enviaremos un enlace mágico a tu correo</Text>

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
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={enviarMagicLink}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnTexto}>✉️ Enviar enlace de acceso</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.enviadoEmoji}>📧</Text>
              <Text style={styles.cardTitulo}>¡Revisa tu correo!</Text>
              <Text style={styles.cardSub}>
                Enviamos un enlace de acceso a:{'
'}
                <Text style={styles.emailDestacado}>{email}</Text>
              </Text>

              <View style={styles.pasos}>
                <Text style={styles.paso}>1️⃣  Abre tu app de correo</Text>
                <Text style={styles.paso}>2️⃣  Busca el correo de Quiniela Pro</Text>
                <Text style={styles.paso}>3️⃣  Toca el botón <Text style={{fontWeight:'bold'}}>&quot;Sign in&quot;</Text></Text>
                <Text style={styles.paso}>4️⃣  La app te abrirá automáticamente</Text>
              </View>

              <TouchableOpacity
                style={styles.btnSecundario}
                onPress={() => setStep('email')}
              >
                <Text style={styles.btnSecundarioTexto}>← Usar otro correo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, { marginTop: 10 }, loading && styles.btnDisabled]}
                onPress={enviarMagicLink}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnTexto}>🔄 Reenviar enlace</Text>
                }
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
  cardSub: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 20, marginTop: 6, lineHeight: 20 },
  emailDestacado: { color: '#009ee3', fontWeight: 'bold' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 5 },
  input: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },
  btn: { backgroundColor: '#009ee3', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  btnDisabled: { backgroundColor: '#90caf9' },
  btnTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnSecundario: { alignItems: 'center', marginTop: 16 },
  btnSecundarioTexto: { color: '#009ee3', fontSize: 14 },
  enviadoEmoji: { fontSize: 48, textAlign: 'center', marginBottom: 10 },
  pasos: { backgroundColor: '#f0f2f5', borderRadius: 10, padding: 16, marginBottom: 8 },
  paso: { fontSize: 14, color: '#444', marginBottom: 8, lineHeight: 20 },
});
