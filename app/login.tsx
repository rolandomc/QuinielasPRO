import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Switch,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const EMAIL_KEY = 'saved_email';
const BIOMETRIC_KEY = 'biometric_enabled';

export default function LoginScreen() {
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const [recordarCorreo, setRecordarCorreo] = useState(false);
  const [biometricDisponible, setBiometricDisponible] = useState(false);
  const [biometricHabilitado, setBiometricHabilitado] = useState(false);
  const [biometricTipo, setBiometricTipo] = useState<'FaceID' | 'Huella' | 'Biometrico'>('Biometrico');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { inicializar(); }, []);

  const inicializar = async () => {
    const emailGuardado = await AsyncStorage.getItem(EMAIL_KEY);
    if (emailGuardado) { setEmail(emailGuardado); setRecordarCorreo(true); }
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrollado = await LocalAuthentication.isEnrolledAsync();
    setBiometricDisponible(compatible && enrollado);
    if (compatible && enrollado) {
      const tipos = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) setBiometricTipo('FaceID');
      else if (tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) setBiometricTipo('Huella');
      const habilitado = await AsyncStorage.getItem(BIOMETRIC_KEY);
      if (habilitado === 'true') { setBiometricHabilitado(true); autenticarBiometrico(); }
    }
  };

  const autenticarBiometrico = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Ingresa con ${biometricTipo}`,
      fallbackLabel: 'Usar contraseña',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    if (result.success) {
      const emailGuardado = await AsyncStorage.getItem(EMAIL_KEY);
      const passGuardado = await AsyncStorage.getItem('saved_password');
      if (emailGuardado && passGuardado) {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email: emailGuardado, password: passGuardado });
        setLoading(false);
        if (error) Alert.alert('Error', 'No se pudo autenticar. Ingresa manualmente.');
      } else {
        Alert.alert('Sin credenciales', 'Inicia sesión manualmente primero.');
      }
    }
  };

  const toggleBiometrico = async (valor: boolean) => {
    if (valor) {
      if (!email || !password) { Alert.alert('Ingresa primero', 'Escribe tu correo y contraseña antes de habilitar la biometría.'); return; }
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: `Confirma tu identidad para habilitar ${biometricTipo}` });
      if (result.success) {
        await AsyncStorage.setItem(BIOMETRIC_KEY, 'true');
        await AsyncStorage.setItem('saved_password', password);
        setBiometricHabilitado(true);
        Alert.alert('✅ Listo', `${biometricTipo} habilitado.`);
      }
    } else {
      await AsyncStorage.setItem(BIOMETRIC_KEY, 'false');
      await AsyncStorage.removeItem('saved_password');
      setBiometricHabilitado(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Campos requeridos', 'Ingresa tu correo y contraseña.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (error) {
      if (error.message.includes('Invalid login credentials')) Alert.alert('Credenciales incorrectas', 'El correo o la contraseña no coinciden.');
      else Alert.alert('Error', error.message);
    } else {
      if (recordarCorreo) await AsyncStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
      else await AsyncStorage.removeItem(EMAIL_KEY);
    }
  };

  const handleRegistro = async () => {
    if (!nombre || !username || !email || !password) { Alert.alert('Campos requeridos', 'Completa todos los campos.'); return; }
    if (username.length < 3) { Alert.alert('Username inválido', 'El nombre de usuario debe tener al menos 3 caracteres.'); return; }
    if (/\s/.test(username)) { Alert.alert('Username inválido', 'El nombre de usuario no puede tener espacios.'); return; }
    if (password.length < 6) { Alert.alert('Contraseña muy corta', 'Mínimo 6 caracteres.'); return; }
    setLoading(true);

    // Verificar que username no exista
    const { data: existeUsername } = await supabase
      .from('usuarios')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .single();
    if (existeUsername) {
      setLoading(false);
      Alert.alert('Username en uso', 'Ese nombre de usuario ya está tomado. Elige otro.');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { nombre, username: username.trim().toLowerCase() } },
    });
    setLoading(false);
    if (error) {
      if (error.message.includes('already registered')) { Alert.alert('Correo en uso', 'Ya existe una cuenta. Inicia sesión.'); setModo('login'); }
      else Alert.alert('Error', error.message);
    } else {
      if (recordarCorreo) await AsyncStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <Text style={styles.emoji}>⚽</Text>
          <Text style={styles.titulo}>Quiniela Pro</Text>
          <Text style={styles.subtitulo}>Predice, juega y gana!</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, modo === 'login' && styles.tabActivo]} onPress={() => setModo('login')}>
              <Text style={[styles.tabTexto, modo === 'login' && styles.tabTextoActivo]}>Iniciar sesión</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, modo === 'registro' && styles.tabActivo]} onPress={() => setModo('registro')}>
              <Text style={[styles.tabTexto, modo === 'registro' && styles.tabTextoActivo]}>Crear cuenta</Text>
            </TouchableOpacity>
          </View>

          {modo === 'registro' && (
            <>
              <Text style={styles.label}>Nombre completo</Text>
              <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej. Carlos Ramírez" placeholderTextColor="#bbb" autoCapitalize="words" returnKeyType="next" onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })} />
              <Text style={styles.label}>Nombre de usuario</Text>
              <View style={styles.usernameContainer}>
                <Text style={styles.usernameAt}>@</Text>
                <TextInput
                  style={styles.usernameInput}
                  value={username}
                  onChangeText={t => setUsername(t.replace(/\s/g, '').toLowerCase())}
                  placeholder="carlosrm"
                  placeholderTextColor="#bbb"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
                />
              </View>
              <Text style={styles.hint}>Este es el nombre que verán otros jugadores</Text>
            </>
          )}

          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="tucorreo@gmail.com" placeholderTextColor="#bbb" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })} />

          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.passwordContainer}>
            <TextInput style={styles.passwordInput} value={password} onChangeText={setPassword} placeholder={modo === 'registro' ? 'Mínimo 6 caracteres' : 'Tu contraseña'} placeholderTextColor="#bbb" secureTextEntry={!verPassword} autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={modo === 'login' ? handleLogin : handleRegistro} onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })} />
            <TouchableOpacity onPress={() => setVerPassword(!verPassword)} style={styles.eyeBtn}>
              <Text style={styles.eyeIcon}>{verPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.opcionRow}>
            <Switch value={recordarCorreo} onValueChange={setRecordarCorreo} trackColor={{ false: '#ddd', true: '#009ee3' }} thumbColor={recordarCorreo ? '#fff' : '#f4f3f4'} style={styles.switch} />
            <Text style={styles.opcionTexto}>Recordar correo</Text>
          </View>

          {biometricDisponible && modo === 'login' && (
            <View style={styles.opcionRow}>
              <Switch value={biometricHabilitado} onValueChange={toggleBiometrico} trackColor={{ false: '#ddd', true: '#009ee3' }} thumbColor={biometricHabilitado ? '#fff' : '#f4f3f4'} style={styles.switch} />
              <View style={styles.opcionTextoContainer}>
                <Ionicons name={biometricTipo === 'FaceID' ? 'scan-outline' : 'finger-print-outline'} size={18} color="#555" style={{ marginRight: 5 }} />
                <Text style={styles.opcionTexto}>Acceso con {biometricTipo}</Text>
              </View>
            </View>
          )}

          {biometricDisponible && biometricHabilitado && modo === 'login' && (
            <TouchableOpacity style={styles.btnBiometrico} onPress={autenticarBiometrico}>
              <Ionicons name={biometricTipo === 'FaceID' ? 'scan-outline' : 'finger-print-outline'} size={28} color="#009ee3" />
              <Text style={styles.btnBiometricoTexto}>Entrar con {biometricTipo}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={modo === 'login' ? handleLogin : handleRegistro} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTexto}>{modo === 'login' ? 'Entrar' : 'Crear cuenta'}</Text>}
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 20 },
  banner: { alignItems: 'center', marginBottom: 24 },
  emoji: { fontSize: 64 },
  titulo: { fontSize: 34, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  subtitulo: { fontSize: 15, color: '#009ee3', marginTop: 4 },
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 16, width: '100%', maxWidth: 420, elevation: 8 },
  tabs: { flexDirection: 'row', marginBottom: 20, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: '#009ee3' },
  tab: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#fff' },
  tabActivo: { backgroundColor: '#009ee3' },
  tabTexto: { fontWeight: '600', color: '#009ee3', fontSize: 14 },
  tabTextoActivo: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 5 },
  input: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },
  usernameContainer: { flexDirection: 'row', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, marginBottom: 4, backgroundColor: '#fafafa', alignItems: 'center' },
  usernameAt: { paddingLeft: 12, fontSize: 16, color: '#009ee3', fontWeight: 'bold' },
  usernameInput: { flex: 1, padding: 12, fontSize: 15, color: '#333' },
  hint: { fontSize: 11, color: '#aaa', marginBottom: 14, marginTop: 2 },
  passwordContainer: { flexDirection: 'row', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, marginBottom: 14, backgroundColor: '#fafafa', alignItems: 'center' },
  passwordInput: { flex: 1, padding: 12, fontSize: 15, color: '#333' },
  eyeBtn: { padding: 12 },
  eyeIcon: { fontSize: 18 },
  opcionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  switch: { marginRight: 10, transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },
  opcionTextoContainer: { flexDirection: 'row', alignItems: 'center' },
  opcionTexto: { fontSize: 13, color: '#555' },
  btnBiometrico: { alignItems: 'center', padding: 14, borderWidth: 1.5, borderColor: '#009ee3', borderRadius: 10, marginBottom: 14, gap: 6 },
  btnBiometricoTexto: { color: '#009ee3', fontWeight: '600', fontSize: 14 },
  btn: { backgroundColor: '#009ee3', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  btnDisabled: { backgroundColor: '#90caf9' },
  btnTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
