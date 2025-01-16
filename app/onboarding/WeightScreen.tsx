import { auth, db } from '@/FirebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WeightScreen() {
  const [weight, setWeight] = useState<number>(70);
  const router = useRouter();

  const saveWeight = async () => {
    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, { weight }, { merge: true });
      router.push('/onboarding/AgeScreen');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
      <Text style={styles.title}>What's your weight?</Text>
      <Text style={styles.subtitle}>
        The more you weigh, the more calories your body burns.
      </Text>
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.adjustButton} onPress={() => setWeight((prev) => prev - 1)}>
          <Text style={styles.adjustButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.inputText}>{weight} kg</Text>
        <TouchableOpacity style={styles.adjustButton} onPress={() => setWeight((prev) => prev + 1)}>
          <Text style={styles.adjustButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.navigation}>
        <TouchableOpacity style={styles.navButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={saveWeight}>
          <Ionicons name="arrow-forward" size={24} color="black" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  skipButton: {
    position: 'absolute',
    top: 40,
    right: 20,
  },
  skipText: {
    fontSize: 16,
    color: 'blue',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  adjustButton: {
    backgroundColor: '#6200ee',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  adjustButtonText: {
    color: '#fff',
    fontSize: 20,
  },
  inputText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    position: 'absolute',
    bottom: 40,
    paddingHorizontal: 20,
  },
  navButton: {
    padding: 10,
  },
});