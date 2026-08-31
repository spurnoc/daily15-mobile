import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, AuthContext } from './context/AuthContext';
import LoginScreen from './screens/LoginScreen';
import SurveyScreen from './screens/SurveyScreen';
import DashboardScreen from './screens/DashboardScreen';
import CheckInScreen from './screens/CheckInScreen';
import SettingsScreen from './screens/SettingsScreen';
import { COLORS } from './config';
import { haptic } from './utils/haptics';

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
