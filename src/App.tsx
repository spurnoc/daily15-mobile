import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { AuthProvider, AuthContext } from './context/AuthContext';
import LoginScreen from './screens/LoginScreen';
import SurveyScreen from './screens/SurveyScreen';
import DashboardScreen from './screens/DashboardScreen';
import CheckInScreen from './screens/CheckInScreen';
import SettingsScreen from './screens/SettingsScreen';
import { COLORS } from './config';

const Tab = createBottomTabNavigator();

const appTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: COLORS.text,
    background: COLORS.bg,
    card: COLORS.card,
    text: COLORS.text,
    border: COLORS.border,
    notification: COLORS.danger,
  },
};

// Haptic feedback helper
export function haptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  if (Platform.OS === 'web') return;
  try {
    const style = Haptics.ImpactFeedbackStyle[type.charAt(0).toUpperCase() + type.slice(1) as 'Light' | 'Medium' | 'Heavy'];
    Haptics.impactAsync(style);
  } catch (e) {}
}

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 4,
          height: 64,
        },
        tabBarActiveTintColor: COLORS.text,
        tabBarInactiveTintColor: COLORS.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
      screenListeners={{
        tabPress: () => haptic('light'),
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="Survey" component={SurveyScreen} options={{ tabBarLabel: 'Survey' }} />
      <Tab.Screen name="CheckIn" component={CheckInScreen} options={{ tabBarLabel: 'Check In' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { token, loading } = React.useContext(AuthContext);

  if (loading) return null;

  if (!token) return <LoginScreen />;

  return (
    <NavigationContainer theme={appTheme}>
      <AppTabs />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
