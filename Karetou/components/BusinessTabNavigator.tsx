import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

// Import business screens
import BusinessHomeScreen from '../screens/userScreens/businessOwnerScreens/BusinessHomeScreen';
import BusinessReviewsScreen from '../screens/userScreens/businessOwnerScreens/BusinessReviewsScreen';
import BusinessCreatePostScreen from '../screens/userScreens/businessOwnerScreens/BusinessCreatePostScreen';
import BusinessSettingsScreen from '../screens/userScreens/businessOwnerScreens/BusinessSettingsScreen';

const Tab = createBottomTabNavigator();

const BusinessTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Home') {
            return <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />;
          } else if (route.name === 'Reviews') {
            return <MaterialIcons name="rate-review" size={size} color={color} />;
          } else if (route.name === 'Create Post') {
            return <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={size} color={color} />;
          } else if (route.name === 'Settings') {
            return <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />;
          }
          return null;
        },
        tabBarActiveTintColor: '#3B2FEA',
        tabBarInactiveTintColor: '#222',
        headerShown: false,
        tabBarStyle: {
          height: 80,
          backgroundColor: '#fff',
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 8,
          elevation: 10,
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingBottom: 10,
          position: 'relative',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: 'bold',
          marginTop: 2,
        },
      })}
    >
      <Tab.Screen name="Home" component={BusinessHomeScreen} />
      <Tab.Screen name="Reviews" component={BusinessReviewsScreen} />
      <Tab.Screen name="Create Post" component={BusinessCreatePostScreen} />
      <Tab.Screen name="Settings" component={BusinessSettingsScreen} />
    </Tab.Navigator>
  );
};

export default BusinessTabNavigator; 