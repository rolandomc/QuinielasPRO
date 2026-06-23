/**
 * app/(tabs)/perfil.tsx — Clean Architecture
 * Usa NeonCard, ScreenHeader, LoadingScreen de components/ui/
 *
 * FIX: mis-pronosticos ahora busca la jornada más reciente del usuario
 *      y navega pasando jornada_id + jornada_nombre como params.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { NeonCard, ScreenHeader, LoadingScreen } from '../../components/ui';

export default function PerfilScreen() {
  const { usuario, user, signOut, loading, refreshUsuario } = useAuth();
  const { colors: C, theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [loadingPronosticos, setLoadingPronosticos] = useState(false);

  useFocusEffect(useCallback(() => { refreshUsuario?.(); }, [refreshUsuario]));

  if (loading) return <LoadingScreen />;

  const inicial = (usuario?.nombre ?? usuario?.username ?? '?')[0].toUpperCase();

  /**
   * FIX: busca la jornada más reciente donde el usuario tiene quiniela,
   * luego navega a mis-pronosticos con los params necesarios.
   */
  const irAMisPronosticos = async () => {
    if (!user) return;
    setLoadingPronosticos(true);
    try {
      // Buscar la quiniela más reciente del usuario
      const { data: quinielaData } = await supabase
        .from('quinielas')
        .select('jornada_id')
        .eq('usuario_id', user.id)
        .order('creado_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!quinielaData?.jornada_id) {
        Alert.alert('Sin pronósticos', 'Aún no tienes ninguna quiniela registrada.');
        return;
      }

      // Obtener nombre de la jornada
      const { data: jornadaData } = await supabase
        .from('jornadas')
        .select('id,nombre')
        .eq('id', quinielaData.jornada_id)
        .maybeSingle();

      router.push({
        pathname: '/mis-pronosticos',
        params: {
          jornada_id:     jornadaData?.id     ?? quinielaData.jornada_id,
          jornada_nombre: jornadaData?.nombre ?? 'Mis pronósticos',
        },
      });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo cargar los pronósticos.');
    } finally {
      setLoadingPronosticos(false);
    }
  };

  const opciones = [
    {
      icon: 'trophy-outline',
      label: 'Mis pronósticos',
      onPress: irAMisPronosticos,
      loading: loadingPronosticos,
    },
    {
      icon: 'wallet-outline',
      label: 'Mi billetera',
      onPress: () => router.push('/(tabs)/billetera'),
    },
    ...(usuario?.es_admin
      ? [{ icon: 'shield-outline', label: 'Panel admin', onPress: () => router.push('/admin') }]
      : []
    ),
    {
      icon: theme === 'dark' ? 'sunny-outline' : 'moon-outline',
      label: theme === 'dark' ? 'Modo claro' : 'Modo oscuro',
      onPress: toggleTheme,
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => refreshUsuario?.()} tintColor={C.accent} colors={[C.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="👤 Mi Perfil" />

        {/* Avatar + nombre */}
        <NeonCard glow={C.accentGlow} glowRadius={16} style={s.marginH} cardStyle={s.avatarCard}>
          <View style={[s.avatar, { backgroundColor: C.accentDim, borderColor: C.accent }]}>
            <Text style={[s.avatarLetra, { color: C.accent }]}>{inicial}</Text>
          </View>
          <Text style={[s.nombre, { color: C.text }]}>{usuario?.nombre ?? '—'}</Text>
          <Text style={[s.username, { color: C.textSub }]}>@{usuario?.username ?? '—'}</Text>
          {usuario?.es_admin && (
            <View style={[s.adminBadge, { backgroundColor: C.accentDim, borderColor: C.accent }]}>
              <Ionicons name="shield-checkmark" size={12} color={C.accent} />
              <Text style={[s.adminTexto, { color: C.accent }]}>Administrador</Text>
            </View>
          )}
        </NeonCard>

        {/* Info de cuenta */}
        <NeonCard glow={C.accentGlow} glowRadius={12} style={s.marginH} cardStyle={s.infoCard}>
          <Text style={[s.seccionTitulo, { color: C.textSub }]}>CUENTA</Text>
          {[['mail-outline', 'Email', user?.email ?? '—'],
            ['person-outline', 'Usuario', `@${usuario?.username ?? '—'}`],
            ['calendar-outline', 'Miembro desde', usuario?.creado_en
              ? new Date(usuario.creado_en).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
              : '—'],
          ].map(([icon, label, value]) => (
            <View key={label as string} style={[s.infoRow, { borderBottomColor: C.cardBorder }]}>
              <Ionicons name={icon as any} size={16} color={C.textSub} />
              <View style={s.infoTextos}>
                <Text style={[s.infoLabel, { color: C.textSub }]}>{label}</Text>
                <Text style={[s.infoValue, { color: C.text }]}>{value}</Text>
              </View>
            </View>
          ))}
        </NeonCard>

        {/* Opciones */}
        <NeonCard glow={C.accentGlow} glowRadius={12} style={s.marginH} cardStyle={s.opcionesCard}>
          <Text style={[s.seccionTitulo, { color: C.textSub }]}>OPCIONES</Text>
          {opciones.map((op, i) => (
            <TouchableOpacity
              key={op.label}
              style={[s.opcionRow, { borderBottomColor: C.cardBorder }, i === opciones.length - 1 && { borderBottomWidth: 0 }]}
              onPress={op.onPress}
              activeOpacity={0.7}
              disabled={'loading' in op && op.loading}
            >
              <View style={[s.opcionIcon, { backgroundColor: C.accentDim }]}>
                {'loading' in op && op.loading
                  ? <ActivityIndicator size="small" color={C.accent} />
                  : <Ionicons name={op.icon as any} size={18} color={C.accent} />
                }
              </View>
              <Text style={[s.opcionLabel, { color: C.text }]}>{op.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.textSub} />
            </TouchableOpacity>
          ))}
        </NeonCard>

        {/* Cerrar sesión */}
        <NeonCard glow={C.redDim} glowRadius={10} style={[s.marginH, { marginBottom: 40 }]} cardStyle={{ padding: 0 }}>
          <TouchableOpacity
            style={s.cerrarBtn}
            onPress={() => Alert.alert('Cerrar sesión', '¿Seguro que deseas salir?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Salir', style: 'destructive', onPress: signOut },
            ])}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color={C.red} />
            <Text style={[s.cerrarTexto, { color: C.red }]}>Cerrar sesión</Text>
          </TouchableOpacity>
        </NeonCard>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  marginH:       { marginHorizontal: 16, marginBottom: 14 },
  avatarCard:    { alignItems: 'center', paddingVertical: 28 },
  avatar:        { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2, marginBottom: 12 },
  avatarLetra:   { fontSize: 34, fontWeight: '900' },
  nombre:        { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  username:      { fontSize: 14 },
  adminBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10 },
  adminTexto:    { fontSize: 12, fontWeight: '700' },
  infoCard:      { padding: 16 },
  seccionTitulo: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  infoTextos:    { flex: 1 },
  infoLabel:     { fontSize: 11, fontWeight: '600' },
  infoValue:     { fontSize: 14, fontWeight: '700', marginTop: 1 },
  opcionesCard:  { padding: 16 },
  opcionRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  opcionIcon:    { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  opcionLabel:   { flex: 1, fontSize: 15, fontWeight: '600' },
  cerrarBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  cerrarTexto:   { fontWeight: '800', fontSize: 15 },
});
