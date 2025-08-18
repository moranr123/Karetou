import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginScreen from './screens/userScreens/Login';
import SignupScreen from './screens/userScreens/SignupScreen';
import SMSOTPScreen from './screens/userScreens/SMSOTPScreen';
import MainTabNavigator from './components/MainTabNavigator';
import { SearchBarScreen } from './screens/userScreens/SearchBarScreen';
import BusinessLogin from './screens/userScreens/businessOwnerScreens/BusinessLogin';
import BusinessSignUp from './screens/userScreens/businessOwnerScreens/BusinessSignUp';
import BusinessHomeScreen from './screens/userScreens/businessOwnerScreens/BusinessHomeScreen';
import BusinessTabNavigator from './components/BusinessTabNavigator';
import RegisterBusinessScreen from './screens/userScreens/businessOwnerScreens/RegisterBusinessScreen';
import EditBusinessScreen from './screens/userScreens/businessOwnerScreens/EditBusinessScreen';
import BusinessIDVerification from './screens/userScreens/businessOwnerScreens/BusinessIDVerification';
import BusinessLocation from './screens/userScreens/businessOwnerScreens/BusinessLocation';
import MyPostsScreen from './screens/userScreens/businessOwnerScreens/MyPostsScreen';
import MyBusinessScreen from './screens/userScreens/businessOwnerScreens/MyBusinessScreen';
import PromotionsScreen from './screens/userScreens/businessOwnerScreens/PromotionsScreen';
import NotificationScreen from './screens/userScreens/NotificationScreen';


const Stack = createStackNavigator();

const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      initialRouteName: 'Login',
    }}
  >
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Signup" component={SignupScreen} />
    <Stack.Screen name="SMSOTP" component={SMSOTPScreen} />
    <Stack.Screen name="BusinessLogin" component={BusinessLogin} />
    <Stack.Screen name="BusinessSignUp" component={BusinessSignUp} />
  </Stack.Navigator>
);

const UserAppStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="Main" component={MainTabNavigator} />
    <Stack.Screen name="SearchBarScreen" component={SearchBarScreen} />
    <Stack.Screen name="NotificationScreen" component={NotificationScreen} />
  </Stack.Navigator>
);

const BusinessAppStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="BusinessMain" component={BusinessTabNavigator} />
    <Stack.Screen name="RegisterBusiness" component={RegisterBusinessScreen} />
    <Stack.Screen name="EditBusiness" component={EditBusinessScreen} />
    <Stack.Screen name="BusinessIDVerification" component={BusinessIDVerification} />
    <Stack.Screen name="BusinessLocation" component={BusinessLocation} />
    <Stack.Screen name="MyPosts" component={MyPostsScreen} />
    <Stack.Screen name="MyBusiness" component={MyBusinessScreen} />
    <Stack.Screen name="Promotions" component={PromotionsScreen} />
    <Stack.Screen name="NotificationScreen" component={NotificationScreen} />
  </Stack.Navigator>
);

const Navigation = () => {
  const { user, userType, theme } = useAuth();
  
  if (!user) {
    return <AuthStack />;
  }
  
  // If user is logged in but userType is not set, show auth stack
  if (!userType) {
    return <AuthStack />;
  }
  
  // Show appropriate app based on user type
  if (userType === 'business') {
    return <BusinessAppStack />;
  }
  
  return <UserAppStack />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const AppContent = () => {
  const { theme } = useAuth();
  const navigationTheme = theme === 'light' ? DefaultTheme : DarkTheme;

  return (
    <NavigationContainer theme={navigationTheme}>
      <Navigation />
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
    </NavigationContainer>
  );
};
