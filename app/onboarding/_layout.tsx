import { Stack } from 'expo-router';
import React from 'react';

export default function OnboardingLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="GoalScreen" options={{ title: 'Set Your Goal' }} />
      <Stack.Screen name="GenderScreen" options={{ title: 'Select Gender' }} />
      <Stack.Screen name="ActivityScreen" options={{ title: 'Select Activity Level' }} />
      <Stack.Screen name="HeightScreen" options={{ title: 'Enter Height' }} />
      <Stack.Screen name="WeightScreen" options={{ title: 'Enter Weight' }} />
      <Stack.Screen name="AgeScreen" options={{ title: 'Enter Age' }} />
      <Stack.Screen name="ResultsScreen" options={{ title: 'Results' }} />
      <Stack.Screen name="PFCScreen" options={{ title: 'Recommended Intake' }} />
    </Stack>
  );
}