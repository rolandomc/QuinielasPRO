import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

const C = { bg:'#0d0d1a', card:'#161625', cardBorder:'#1e1e35', accent:'#00b4d8', accentDim:'rgba(0,180,216,0.12)', text:'#f0f0ff', textSub:'#8888aa', green:'#00c897' };

export default function PagoExitoScreen() {
  const router = useRouter();
  const { codigo } = useLocalSearchParams<{ codigo: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🎉</Text>
      <Text style={styles.titulo}>¡Pago exitoso!</Text>
      <Text style={styles.subtitulo}>Tu quiniela ha sido registrada y confirmada.</Text>

      {codigo && (
        <View style={styles.codigoCard}>
          <Text style={styles.codigoLabel}>Tu código de quiniela</Text>
          <Text style={styles.codigoValor}>{codigo}</Text>
          <Text style={styles.codigoSub}>Guárdalo como comprobante</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>¿Qué sigue?</Text>
        <Text style={styles.paso}>✅  Tu quiniela ya está registrada</Text>
        <Text style={styles.paso}>📊  Revisa tus pronósticos en "Mi Quiniela"</Text>
        <Text style={styles.paso}>🏆  Consulta los resultados cuando terminen los partidos</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)/quiniela')}>
        <Text style={styles.btnTexto}>⚽ Ver mi quiniela</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',padding:25},
  icon:{fontSize:72,marginBottom:8},
  titulo:{fontSize:26,fontWeight:'bold',color:C.text,marginBottom:6},
  subtitulo:{fontSize:14,color:C.textSub,textAlign:'center',marginBottom:20},
  codigoCard:{backgroundColor:C.card,borderWidth:2,borderColor:C.accent,borderRadius:16,paddingHorizontal:32,paddingVertical:18,alignItems:'center',marginBottom:20},
  codigoLabel:{color:C.textSub,fontSize:12,fontWeight:'600',marginBottom:4},
  codigoValor:{color:C.accent,fontSize:30,fontWeight:'bold',letterSpacing:3},
  codigoSub:{color:C.textSub,fontSize:11,marginTop:4},
  card:{backgroundColor:C.card,borderRadius:14,padding:20,width:'100%',marginBottom:20,borderWidth:1,borderColor:C.cardBorder},
  cardTitulo:{fontWeight:'bold',fontSize:15,marginBottom:12,color:C.text},
  paso:{fontSize:13,color:C.textSub,marginBottom:8,lineHeight:20},
  btn:{backgroundColor:C.accent,width:'100%',padding:16,borderRadius:12,alignItems:'center'},
  btnTexto:{color:'#fff',fontWeight:'bold',fontSize:16},
});
