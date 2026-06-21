import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';

function TabIcon({ name, color, focused }: { name: any; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} color={focused ? '#00b4d8' : '#555'} size={22} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#00b4d8',
        tabBarInactiveTintColor: '#555',
        tabBarStyle: {
          backgroundColor: '#0d0d1a',
          borderTopColor: '#1e1e30',
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: '#0d0d1a', shadowColor: 'transparent', elevation: 0 },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold', fontSize: 17 },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="quiniela"
        options={{
          title: 'Quiniela',
          tabBarIcon: ({ color, focused }) => <TabIcon name="football" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="resultados"
        options={{
          title: 'Resultados',
          tabBarIcon: ({ color, focused }) => <TabIcon name="trophy" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => <TabIcon name="person" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 36, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  iconWrapActive: { backgroundColor: 'rgba(0,180,216,0.12)' },
});
