import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [step, setStep] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

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
      setStep('codigo');
    }
  };

  const verificarCodigo = async () => {
    const token = codigo.join('');
    if (token.length < 6) {
      Alert.alert('Codigo incompleto', 'Ingresa los 6 digitos del codigo.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'email',
    });
    setLoading(false);
    if (error) {
      Alert.alert('Codigo invalido', 'El codigo es incorrecto o ya expiro. Solicita uno nuevo.');
      setCodigo(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    }
    // Si es correcto, AuthContext detecta la sesion y redirige automaticamente
  };

  const handleDigito = (text: string, index: number) => {
    // Permite pegar los 6 digitos de una vez
    if (text.length === 6 && /^\d{6}$/.test(text)) {
      const digits = text.split('');
      setCodigo(digits);
      inputs.current[5]?.focus();
      return;
    }
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const nuevo = [...codigo];
    nuevo[index] = digit;
    setCodigo(nuevo);
    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleBackspace = (key: string, index: number) => {
    if (key === 'Backspace' && !codigo[index] && index > 0) {
      const nuevo = [...codigo];
      nuevo[index - 1] = '';
      setCodigo(nuevo);
      inputs.current[index - 1]?.focus();
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
              <Text style={styles.cardSub}>Te enviaremos un codigo de 6 digitos a tu correo</Text>

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
                  : <Text style={styles.btnTexto}>Enviar codigo</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.enviadoEmoji}>📧</Text>
              <Text style={styles.cardTitulo}>Revisa tu correo</Text>
              <Text style={styles.cardSub}>
                Abre el correo de Supabase y copia el codigo de 6 digitos que aparece en el enlace.
              </Text>

              <Text style={styles.labelCodigo}>Ingresa el codigo</Text>
              <View style={styles.codigoContainer}>
                {codigo.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(ref) => { inputs.current[i] = ref; }}
                    style={[styles.digitInput, digit ? styles.digitFilled : null]}
                    value={digit}
                    onChangeText={(text) => handleDigito(text, i)}
                    onKeyPress={({ nativeEvent }) => handleBackspace(nativeEvent.key, i)}
                    keyboardType="number-pad"
                    maxLength={6}
                    selectTextOnFocus
                    autoFocus={i === 0}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={verificarCodigo}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnTexto}>Verificar y entrar</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSecundario} onPress={enviarCodigo} disabled={loading}>
                <Text style={styles.btnSecundarioTexto}>Reenviar codigo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSecundario} onPress={() => { setStep('email'); setCodigo(['','','','','','']); }}>
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
  cardSub: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 20, marginTop: 6, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 5 },
  labelCodigo: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 12, textAlign: 'center' },
  input: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },
  codigoContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  digitInput: { width: 44, height: 54, borderWidth: 2, borderColor: '#ddd', borderRadius: 10, textAlign: 'center', fontSize: 22, fontWeight: 'bold', color: '#1a1a2e', backgroundColor: '#fafafa' },
  digitFilled: { borderColor: '#009ee3', backgroundColor: '#e8f4fd' },
  btn: { backgroundColor: '#009ee3', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  btnDisabled: { backgroundColor: '#90caf9' },
  btnTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnSecundario: { alignItems: 'center', marginTop: 14 },
  btnSecundarioTexto: { color: '#009ee3', fontSize: 14 },
  enviadoEmoji: { fontSize: 48, textAlign: 'center', marginBottom: 10 },
});
