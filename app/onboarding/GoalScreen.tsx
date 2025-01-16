import { auth, db } from '@/FirebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function GoalScreen() {
  const router = useRouter();
  const [goal, setGoal] = useState('');

  const saveGoal = async () => {
    if (auth.currentUser && goal) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, { goal }, { merge: true });
      router.push('/onboarding/GenderScreen');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Set Your Goal</Text>
      <TouchableOpacity onPress={() => setGoal('lose weight')} style={styles.option}>
        <Text style={{ color: goal === 'lose weight' ? 'blue' : 'black' }}>Lose Weight</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setGoal('maintain weight')} style={styles.option}>
        <Text style={{ color: goal === 'maintain weight' ? 'blue' : 'black' }}>Maintain Weight</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setGoal('gain weight')} style={styles.option}>
        <Text style={{ color: goal === 'gain weight' ? 'blue' : 'black' }}>Gain Weight</Text>
      </TouchableOpacity>
      <View style={styles.navigation}>
        <TouchableOpacity style={styles.navButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={saveGoal}>
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
    marginBottom: 20,
  },
  option: {
    margin: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
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