import { auth, db } from '@/FirebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ActivityScreen() {
  const router = useRouter();

  const saveActivityLevel = async (activityLevel: string) => {
    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, { activityLevel }, { merge: true });
      router.push('/onboarding/HeightScreen');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
      <Text style={styles.title}>How active are you?</Text>
      <Text style={styles.subtitle}>
        A sedentary person burns fewer calories than an active person.
      </Text>
      <TouchableOpacity style={styles.button} onPress={() => saveActivityLevel('sedentary')}>
        <Text style={styles.buttonText}>Sedentary</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => saveActivityLevel('low active')}>
        <Text style={styles.buttonText}>Low Active</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => saveActivityLevel('active')}>
        <Text style={styles.buttonText}>Active</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => saveActivityLevel('very active')}>
        <Text style={styles.buttonText}>Very Active</Text>
      </TouchableOpacity>
      <View style={styles.navigation}>
        <TouchableOpacity style={styles.navButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => router.push('/onboarding/HeightScreen')}>
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
  button: {
    backgroundColor: '#31256C',
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