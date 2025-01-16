import { auth, db } from '@/FirebaseConfig';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface UserData {
  name: string;
  email: string;
  age?: number;
  weight?: number;
  height?: number;
  gender?: string;
  activityLevel?: string;
  goal?: string;
  protein?: number;
  fats?: number;
  carbs?: number;
}

export default function ProfileScreen() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userData = (await getDoc(userRef)).data() as UserData | undefined;
        if (userData) {
          setUserData(userData);
        }
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) router.replace('/');
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/'); // Redirect to login page
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      {userData && (
        <View style={styles.userInfo}>
          <Text style={styles.infoText}>Name: {userData.name}</Text>
          <Text style={styles.infoText}>Email: {userData.email}</Text>
          {userData.age && <Text style={styles.infoText}>Age: {userData.age}</Text>}
          {userData.weight && <Text style={styles.infoText}>Weight: {userData.weight} kg</Text>}
          {userData.height && <Text style={styles.infoText}>Height: {userData.height} cm</Text>}
          {userData.gender && <Text style={styles.infoText}>Gender: {userData.gender}</Text>}
          {userData.activityLevel && <Text style={styles.infoText}>Activity Level: {userData.activityLevel}</Text>}
          {userData.goal && <Text style={styles.infoText}>Goal: {userData.goal}</Text>}
          {userData.protein && <Text style={styles.infoText}>Protein: {userData.protein.toFixed(2)}g</Text>}
          {userData.fats && <Text style={styles.infoText}>Fats: {userData.fats.toFixed(2)}g</Text>}
          {userData.carbs && <Text style={styles.infoText}>Carbs: {userData.carbs.toFixed(2)}g</Text>}
        </View>
      )}
      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 40,
    color: '#1A237E',
  },
  userInfo: {
    marginBottom: 20,
  },
  infoText: {
    fontSize: 18,
    marginVertical: 5,
  },
  button: {
    width: '90%',
    marginVertical: 15,
    backgroundColor: '#6200ee',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6200ee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});