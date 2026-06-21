import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Campos requeridos', 'Ingresa tu correo y contrasena.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    console.log('LOGIN resultado:', JSON.stringify({ user: data?.user?.email, error }));
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        Alert.alert(
          'Correo no confirmado',
          'Ve a Supabase > Authentication > Providers > Email y desactiva "Confirm email".'
        );
      } else if (error.message.includes('Invalid login credentials')) {
        Alert.alert('Credenciales incorrectas', 'El correo o la contrasena no coinciden.');
      } else {
        Alert.alert('Error', error.message);
      }
    }
  };

  const handleRegistro = async () => {
    if (!nombre || !email || !password) {
      Alert.alert('Campos requeridos', 'Completa todos los campos.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Contrasena muy corta', 'Minimo 6 caracteres.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { nombre } },
    });
    setLoading(false);
    console.log('REGISTRO resultado:', JSON.stringify({ user: data?.user?.email, confirmed: data?.user?.confirmed_at, error }));
    if (error) {
      if (error.message.includes('already registered')) {
        Alert.alert('Correo en uso', 'Ya existe una cuenta. Inicia sesion.');
        setModo('login');
      } else {
        Alert.alert('Error', error.message);
      }
    } else if (data?.user && !data.user.confirmed_at) {
      Alert.alert(
        'Confirma tu correo',
        'Te enviamos un correo de confirmacion. Si no quieres esto, desactiva "Confirm email" en Supabase.'
      );
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
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, modo === 'login' && styles.tabActivo]}
              onPress={() => setModo('login')}
            >
              <Text style={[styles.tabTexto, modo === 'login' && styles.tabTextoActivo]}>Iniciar sesion</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, modo === 'registro' && styles.tabActivo]}
              onPress={() => setModo('registro')}
            >
              <Text style={[styles.tabTexto, modo === 'registro' && styles.tabTextoActivo]}>Crear cuenta</Text>
            </TouchableOpacity>
          </View>

          {modo === 'registro' && (
            <>
              <Text style={styles.label}>Nombre completo</Text>
              <TextInput
                style={styles.input}
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej. Carlos Ramirez"
                placeholderTextColor="#bbb"
                autoCapitalize="words"
              />
            </>
          )}

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

          <Text style={styles.label}>Contrasena</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder={modo === 'registro' ? 'Minimo 6 caracteres' : 'Tu contrasena'}
              placeholderTextColor="#bbb"
              secureTextEntry={!verPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setVerPassword(!verPassword)} style={styles.eyeBtn}>
              <Text style={styles.eyeIcon}>{verPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={modo === 'login' ? handleLogin : handleRegistro}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnTexto}>{modo === 'login' ? 'Entrar' : 'Crear cuenta'}</Text>
            }
          </TouchableOpacity>

          {modo === 'login' && (
            <TouchableOpacity style={styles.btnSecundario} onPress={() => setModo('registro')}>
              <Text style={styles.btnSecundarioTexto}>No tengo cuenta, registrarme</Text>
            </TouchableOpacity>
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
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 16, width: '100%', maxWidth: 420, elevation: 8 },
  tabs: { flexDirection: 'row', marginBottom: 24, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: '#009ee3' },
  tab: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#fff' },
  tabActivo: { backgroundColor: '#009ee3' },
  tabTexto: { fontWeight: '600', color: '#009ee3', fontSize: 14 },
  tabTextoActivo: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 5 },
  input: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },
  passwordContainer: { flexDirection: 'row', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, marginBottom: 20, backgroundColor: '#fafafa', alignItems: 'center' },
  passwordInput: { flex: 1, padding: 12, fontSize: 15, color: '#333' },
  eyeBtn: { padding: 12 },
  eyeIcon: { fontSize: 18 },
  btn: { backgroundColor: '#009ee3', padding: 16, borderRadius: 10, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#90caf9' },
  btnTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnSecundario: { alignItems: 'center', marginTop: 16 },
  btnSecundarioTexto: { color: '#009ee3', fontSize: 14 },
});
