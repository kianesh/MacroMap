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
        headerBackTitle: '',
        headerTitle: '', // Remove file names from headers
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="RegisterScreen" options={{ title: 'Register' }} />
      <Stack.Screen name="ResetScreen" options={{ title: 'Reset Password' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="ProfileScreen" options={{ title: 'Profile' }} />
      <Stack.Screen name="MealSearchScreen" options={{ title: 'Search Foods' }} />
      <Stack.Screen name="EditMealScreen" options={{ title: 'Edit Meal' }} />
      <Stack.Screen name="AdjustServingScreen" options={{ title: 'Adjust Serving' }} />
      <Stack.Screen name="LogWeightScreen" options={{ title: 'Log Weight' }} />
      <Stack.Screen name="about" options={{ title: 'My Profile' }} />
      <Stack.Screen name="nlp" options={{ title: 'Describe Meal' }} />
      <Stack.Screen 
        name="onboarding" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right'
        }} 
      />
      <Stack.Screen name="CreateFoodScreen" options={{ title: 'Create Food' }} />
      <Stack.Screen name="CustomMealsScreen" options={{ title: 'Custom Meal' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    marginRight: 15,
  }
});