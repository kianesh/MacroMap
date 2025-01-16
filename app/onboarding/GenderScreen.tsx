import { auth, db } from '@/FirebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function GenderScreen() {
  const router = useRouter();

  const saveGender = async (gender) => {
    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, { gender }, { merge: true });
      router.push('/onboarding/ActivityScreen');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
      <Text style={styles.title}>What's your gender?</Text>
      <TouchableOpacity style={styles.button} onPress={() => saveGender('male')}>
        <Text style={styles.buttonText}>Male</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => saveGender('female')}>
        <Text style={styles.buttonText}>Female</Text>
      </TouchableOpacity>
      <View style={styles.navigation}>
        <TouchableOpacity style={styles.navButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => router.push('/onboarding/ActivityScreen')}>
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
  button: {
    backgroundColor: '#6200ee',
    padding: 15,
    borderRadius: 25,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
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