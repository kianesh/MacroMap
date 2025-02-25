import { FontAwesome } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function NotificationsScreen() {
  const router = useRouter();
  const [loaded] = useFonts({
    'AfacadFlux': require('../assets/fonts/AfacadFlux-VariableFont_slnt,wght.ttf'),
  });

  if (!loaded) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={24} color="#31256C" />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.emptyState}>
          <FontAwesome name="bell-o" size={64} color="#CCCCCC" />
          <Text style={styles.emptyStateText}>No notifications yet</Text>
          <Text style={styles.emptyStateSubtext}>
            You'll see your notifications here when you receive them
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#31256C',
    fontFamily: 'AfacadFlux',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666666',
    marginTop: 20,
    fontFamily: 'AfacadFlux',
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginTop: 10,
    fontFamily: 'AfacadFlux',
  },
});