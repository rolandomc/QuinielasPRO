import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabIcon({ name, focused }: { name: any; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} color={focused ? '#00b4d8' : '#555'} size={23} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#00b4d8',
        tabBarInactiveTintColor: '#555',
        tabBarStyle: {
          backgroundColor: '#0d0d1a',
          borderTopColor: '#1e1e30',
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="quiniela" options={{ title: 'Quiniela', tabBarIcon: ({ focused }) => <TabIcon name="football" focused={focused} /> }} />
      <Tabs.Screen name="resultados" options={{ title: 'Resultados', tabBarIcon: ({ focused }) => <TabIcon name="trophy" focused={focused} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 38, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  iconWrapActive: { backgroundColor: 'rgba(0,180,216,0.13)' },
});
