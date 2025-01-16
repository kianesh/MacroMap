import { auth, db } from '@/FirebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ResultsScreen() {
  const router = useRouter();
  const [protein, setProtein] = useState(0);
  const [fats, setFats] = useState(0);
  const [carbs, setCarbs] = useState(0);

  useEffect(() => {
    // Fetch user data from Firebase
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userData = (await getDoc(userRef)).data();

        if (userData) {
          const { age, weight, height, gender, activityLevel, goal } = userData;
          calculatePFC(age, weight, height, gender, activityLevel, goal);
        }
      }
    };

    fetchUserData();
  }, []);

  const calculatePFC = (
    age: number,
    weight: number,
    height: number,
    gender: string,
    activityLevel: string,
    goal: string
  ) => {
    // Example calculation logic
    let bmr;
    if (gender === 'male') {
      bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
    } else {
      bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
    }

    let activityMultiplier;
    switch (activityLevel) {
      case 'sedentary':
        activityMultiplier = 1.2;
        break;
      case 'low active':
        activityMultiplier = 1.375;
        break;
      case 'active':
        activityMultiplier = 1.55;
        break;
      case 'very active':
        activityMultiplier = 1.725;
        break;
      default:
        activityMultiplier = 1.2;
    }

    const tdee = bmr * activityMultiplier;

    let calorieGoal;
    switch (goal) {
      case 'lose weight':
        calorieGoal = tdee - 500;
        break;
      case 'maintain weight':
        calorieGoal = tdee;
        break;
      case 'gain weight':
        calorieGoal = tdee + 500;
        break;
      default:
        calorieGoal = tdee;
    }

    const proteinIntake = weight * 2.2; // Example: 1g per pound of body weight
    const fatsIntake = (calorieGoal * 0.25) / 9; // Example: 25% of calories from fats
    const carbsIntake = (calorieGoal - (proteinIntake * 4) - (fatsIntake * 9)) / 4; // Remaining calories from carbs

    setProtein(proteinIntake);
    setFats(fatsIntake);
    setCarbs(carbsIntake);

    // Save PFC to Firebase
    savePFCToFirebase(proteinIntake, fatsIntake, carbsIntake);
  };

  const savePFCToFirebase = async (protein: number, fats: number, carbs: number) => {
    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { protein, fats, carbs }, { merge: true });
    }
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('hasOnboarded', 'true');
    router.replace('/(tabs)');  // Redirect to tabs after onboarding
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
      <Text style={styles.title}>You're All Set!</Text>
      <Text style={styles.recommendation}>Protein: {protein.toFixed(2)}g</Text>
      <Text style={styles.recommendation}>Fats: {fats.toFixed(2)}g</Text>
      <Text style={styles.recommendation}>Carbs: {carbs.toFixed(2)}g</Text>
      <TouchableOpacity style={styles.button} onPress={completeOnboarding}>
        <Text style={styles.buttonText}>Go to App</Text>
      </TouchableOpacity>
      <View style={styles.navigation}>
        <TouchableOpacity style={styles.navButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="black" />
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
  recommendation: {
    fontSize: 18,
    marginVertical: 5,
  },
  button: {
    backgroundColor: '#6200ee',
    padding: 15,
    borderRadius: 25,
    marginTop: 30,
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