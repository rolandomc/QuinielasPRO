import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

function TabIcon({ name, focused, activeColor }: { name: any; focused: boolean; activeColor: string }) {
  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: activeColor + '20' }]}>
      <Ionicons name={name} color={focused ? activeColor : '#777'} size={23} />
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
        tabBarInactiveTintColor: '#777',
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: 64 + bottomPad,
          paddingBottom: bottomPad + 4,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarIconStyle: { marginBottom: 0 },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="quiniela"   options={{ title: 'Quiniela',   tabBarIcon: ({ focused }) => <TabIcon name="football"  focused={focused} activeColor={colors.accent}/> }} />
      <Tabs.Screen name="resultados" options={{ title: 'Resultados', tabBarIcon: ({ focused }) => <TabIcon name="trophy"    focused={focused} activeColor={colors.accent}/> }} />
      <Tabs.Screen name="perfil"     options={{ title: 'Perfil',     tabBarIcon: ({ focused }) => <TabIcon name="person"    focused={focused} activeColor={colors.accent}/> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 38, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
});
