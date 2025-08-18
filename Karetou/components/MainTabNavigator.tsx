import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, FontAwesome5, MaterialIcons, Feather } from '@expo/vector-icons';

// Import screens
import HomeScreen from '../screens/userScreens/HomeScreen';
import FeedScreen from '../screens/userScreens/FeedScreen';
import SavedScreen from '../screens/userScreens/SavedScreen';
import SettingsScreen from '../screens/userScreens/SettingsScreen';
import Navigate from '../screens/userScreens/Navigate';

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Home') {
            return <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />;
          } else if (route.name === 'Feed') {
            return <MaterialIcons name="feed" size={size} color={color} />;
          } else if (route.name === 'Navigate') {
            return (
              <View style={{
                backgroundColor: '#fff',
                width: 64,
                height: 64,
                borderRadius: 32,
                marginTop: -32,
                elevation: 8,
                shadowColor: '#000',
                shadowOpacity: 0.18,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: focused ? 2 : 0,
                borderColor: focused ? '#3B2FEA' : 'transparent',
              }}>
                <FontAwesome5 name="map" size={28} color={focused ? '#3B2FEA' : color} />
              </View>
            );
          } else if (route.name === 'Saved') {
            return <Feather name="bookmark" size={size} color={color} />;
          } else if (route.name === 'Settings') {
            return <Ionicons name="settings-outline" size={size} color={color} />;
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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Navigate" component={Navigate} />
      <Tab.Screen name="Saved" component={SavedScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

export default MainTabNavigator; 