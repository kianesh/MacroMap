import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#31256C',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="RegisterScreen" options={{ title: 'Register' }} />
      <Stack.Screen name="ResetPasswordScreen" options={{ title: 'Reset Password' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="ProfileScreen" options={{ title: 'Profile' }} />
      <Stack.Screen name="MealSearchScreen" options={{ title: 'Meal Search' }} />
      <Stack.Screen 
        name="onboarding" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right'
        }} 
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    marginRight: 15,
  }
});