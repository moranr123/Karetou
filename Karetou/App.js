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

const AuthStack = ({ lastUserType }) => {
  let initialRoute = 'Login'; // Default to regular user login
  
  if (lastUserType === 'business') {
    initialRoute = 'BusinessLogin';
  } else if (lastUserType === 'user') {
    initialRoute = 'Login';
  }
  // If lastUserType is null or undefined, default to 'Login'
  
  console.log('🔐 AuthStack - lastUserType:', lastUserType, 'initialRoute:', initialRoute);
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName={initialRoute}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="SMSOTP" component={SMSOTPScreen} />
      <Stack.Screen name="BusinessLogin" component={BusinessLogin} />
      <Stack.Screen name="BusinessSignUp" component={BusinessSignUp} />
    </Stack.Navigator>
  );
};

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
  const { user, userType, lastUserType, theme } = useAuth();
  
  console.log('🧭 Navigation state - user:', !!user, 'userType:', userType, 'lastUserType:', lastUserType);
  
  if (!user) {
    console.log('📱 No user - showing AuthStack with lastUserType:', lastUserType);
    return <AuthStack lastUserType={lastUserType} />;
  }
  
  // If user is logged in but userType is not set, show auth stack
  if (!userType) {
    console.log('📱 User exists but no userType - showing AuthStack with lastUserType:', lastUserType);
    return <AuthStack lastUserType={lastUserType} />;
  }
  
  // Show appropriate 
  if (userType === 'business') {
    console.log('📱 Business user - showing BusinessAppStack');
    return <BusinessAppStack />;
  }
  
  console.log('📱 Regular user - showing UserAppStack');
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
