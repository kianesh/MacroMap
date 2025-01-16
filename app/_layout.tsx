import { useColorScheme } from '@/components/useColorScheme';
import { Stack } from 'expo-router';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="RegisterScreen" options={{ title: 'Register' }} />
      <Stack.Screen name="ResetPasswordScreen" options={{ title: 'Reset Password' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="ProfileScreen" options={{ title: 'Profile' }} />
      <Stack.Screen name="onboarding/GoalScreen" options={{ title: 'Set Your Goal' }} />
      <Stack.Screen name="onboarding/GenderScreen" options={{ title: 'Select Gender' }} />
      <Stack.Screen name="onboarding/ActivityScreen" options={{ title: 'Select Activity Level' }} />
      <Stack.Screen name="onboarding/HeightScreen" options={{ title: 'Enter Height' }} />
      <Stack.Screen name="onboarding/WeightScreen" options={{ title: 'Enter Weight' }} />
      <Stack.Screen name="onboarding/AgeScreen" options={{ title: 'Enter Age' }} />
      <Stack.Screen name="onboarding/ResultsScreen" options={{ title: 'Results' }} />
    </Stack>
  );
}