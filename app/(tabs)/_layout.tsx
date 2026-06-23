import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import NeonWrapper from '../../components/NeonWrapper';

function TabIcon({ name, focused, activeColor }: { name: any; focused: boolean; activeColor: string }) {
  if (focused) {
    return (
      <NeonWrapper
        color={activeColor + '55'}
        borderRadius={10}
        shadowRadius={10}
        opacity={1}
      >
        <View style={[styles.iconWrap, { backgroundColor: activeColor + '22' }]}>
          <Ionicons name={name} color={activeColor} size={23} />
        </View>
      </NeonWrapper>
    );
  }
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} color="#666" size={22} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const extraBottom = Platform.OS === 'web' ? 16 : 0;
  const bottomPad = insets.bottom + extraBottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.accent + '33',
          borderTopWidth: 1.5,
          height: 64 + bottomPad,
          paddingBottom: bottomPad + 4,
          paddingTop: 6,
          // Sombra superior neón
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 16,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        tabBarIconStyle: { marginBottom: 0 },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="quiniela"   options={{ title: 'Quiniela',   tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'football'       : 'football-outline'}  focused={focused} activeColor={colors.accent} /> }} />
      <Tabs.Screen name="resultados" options={{ title: 'Resultados', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'trophy'         : 'trophy-outline'}    focused={focused} activeColor={colors.accent} /> }} />
      <Tabs.Screen name="billetera"  options={{ title: 'Billetera',  tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'wallet'         : 'wallet-outline'}    focused={focused} activeColor={colors.accent} /> }} />
      <Tabs.Screen name="perfil"     options={{ title: 'Perfil',     tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person-circle' : 'person-outline'}    focused={focused} activeColor={colors.accent} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 40, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
});
