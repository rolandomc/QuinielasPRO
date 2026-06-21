import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

// ⚠️ Reemplaza con tu Access Token de Mercado Pago (sandbox para pruebas)
const MP_ACCESS_TOKEN = 'APP_USR-XXXXXXXXXXXXXXXX'; // <-- tu token aquí
const PRECIO_QUINIELA = 50; // precio en MXN

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'QUI-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function CheckoutScreen() {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const params   = useLocalSearchParams<{ jornada_id: string; jornada_nombre: string; predicciones: string }>();

  const [mpUrl, setMpUrl]       = useState<string|null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const guardado = useRef(false);

  useEffect(() => { crearPreferencia(); }, []);

  const crearPreferencia = async () => {
    try {
      const codigo = generarCodigo();
      // Guardar codigo en memoria para usarlo al confirmar
      (crearPreferencia as any)._codigo = codigo;

      const body = {
        items: [{
          title: `Quiniela — ${params.jornada_nombre}`,
          quantity: 1,
          unit_price: PRECIO_QUINIELA,
          currency_id: 'MXN',
        }],
        external_reference: codigo,
        back_urls: {
          success: `${SUPABASE_URL}/functions/v1/mp-webhook?status=success`,
          failure: `${SUPABASE_URL}/functions/v1/mp-webhook?status=failure`,
          pending: `${SUPABASE_URL}/functions/v1/mp-webhook?status=pending`,
        },
        auto_return: 'approved',
        statement_descriptor: 'QuinielasPRO',
      };

      const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.sandbox_init_point && !data.init_point) {
        throw new Error(data.message || 'No se pudo crear la preferencia de pago');
      }
      // sandbox_init_point para pruebas, init_point para producción
      setMpUrl(data.sandbox_init_point || data.init_point);
    } catch (e) {
      Alert.alert('Error al iniciar pago', String(e));
      router.back();
    }
    setLoading(false);
  };

  // Se llama cuando MP redirige a la back_url de éxito dentro del WebView
  const onNavigationChange = async (navState: { url: string }) => {
    const { url } = navState;
    if (!url.includes('status=success') && !url.includes('collection_status=approved')) return;
    if (guardado.current) return; // evitar doble guardado
    guardado.current = true;
    setSaving(true);
    await guardarQuiniela();
    setSaving(false);
  };

  const guardarQuiniela = async () => {
    if (!user) return;
    const codigo = (crearPreferencia as any)._codigo || generarCodigo();
    const predicciones: Record<string,'1'|'X'|'2'> = JSON.parse(params.predicciones || '{}');
    const jornada_id = params.jornada_id;

    // Insertar quiniela con estado pagado
    const { data: nQ, error: eQ } = await supabase
      .from('quinielas')
      .insert({ usuario_id: user.id, jornada_id, jornada: 0, estado_pago: 'pagado', aciertos: 0, codigo })
      .select().single();

    if (eQ || !nQ) {
      Alert.alert('Error al guardar quiniela', eQ?.message || 'Error desconocido');
      return;
    }

    // Insertar predicciones
    const inserts = Object.entries(predicciones).map(([partido_id, resultado]) => ({
      usuario_id: user.id, partido_id, resultado, quiniela_id: nQ.id,
    }));
    await supabase.from('predicciones').insert(inserts);

    router.replace({
      pathname: '/pago/exito',
      params: { codigo },
    });
  };

  if (loading || saving) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#009ee3"/>
        <Text style={styles.loadingText}>{saving ? 'Guardando quiniela...' : 'Preparando pago...'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff"/>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#333"/>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Mercado Pago</Text>
        <View style={{width:40}}/>
      </View>
      {mpUrl && (
        <WebView
          source={{ uri: mpUrl }}
          onNavigationStateChange={onNavigationChange}
          startInLoadingState
          renderLoading={() => <View style={styles.center}><ActivityIndicator size="large" color="#009ee3"/></View>}
          style={{flex:1}}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#fff'},
  center:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#fff',gap:14},
  loadingText:{fontSize:15,color:'#555'},
  topBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#eee',backgroundColor:'#fff'},
  closeBtn:{padding:6,borderRadius:8,backgroundColor:'#f4f4f4'},
  topBarTitle:{fontSize:15,fontWeight:'bold',color:'#333'},
});
