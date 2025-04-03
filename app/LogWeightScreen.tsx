import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { auth, db } from '../FirebaseConfig';

export default function LogWeightScreen() {
  const [weight, setWeight] = useState(70);
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const router = useRouter();

  const handleWeightChange = (newValue: number) => {
    setWeight(newValue);
    Vibration.vibrate(50);
  };

  const saveWeight = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save weight');
      return;
    }

    try {
      // Convert weight to kg if needed
      const weightInKg = unit === 'lb' ? weight * 0.453592 : weight;
      
      // 1. Save to weight tracking collection
      await addDoc(collection(db, 'weights'), {
        userId: user.uid,
        weight: weightInKg,
        date: Timestamp.now()
      });
      
      // 2. Update user profile with current weight
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { weight: weightInKg }, { merge: true });

      // 3. Recalculate and update user's calorie and macro goals
      await updateUserNutritionGoals(user.uid, weightInKg);
      
      Alert.alert(
        'Success', 
        'Weight logged successfully',
        [{ text: 'OK', onPress: () => router.push('/(tabs)') }]
      );
    } catch (error) {
      console.error('Error logging weight:', error);
      Alert.alert('Error', 'Failed to log weight');
    }
  };

  const updateUserNutritionGoals = async (userId: string, newWeight: number) => {
    // Get current user data
    const userRef = doc(db, 'users', userId);
    const userData = (await getDoc(userRef)).data();
    
    if (!userData) return;
    
    // Extract user metrics
    const { 
      height = 175, // cm 
      age = 30,
      gender = 'male', 
      activityLevel = 'moderate',
      goal = 'maintain weight'
    } = userData;
    
    // Calculate BMR using Mifflin-St Jeor Equation
    let bmr = 0;
    if (gender === 'male') {
      bmr = 10 * newWeight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * newWeight + 6.25 * height - 5 * age - 161;
    }
    
    // Activity level multiplier
    const activityMultipliers = {
      'sedentary': 1.2, // Little or no exercise
      'low active': 1.375, // Light exercise 1-3 days/week
      'moderate': 1.55, // Moderate exercise 3-5 days/week
      'active': 1.725, // Hard exercise 6-7 days/week
      'very active': 1.9 // Very hard exercise & physical job
    };
    
    // Get multiplier or default to moderate
    const multiplier = activityMultipliers[activityLevel] || 1.55;
    
    // Calculate TDEE (Total Daily Energy Expenditure)
    let tdee = bmr * multiplier;
    
    // Adjust based on goal
    let calorieGoal = tdee;
    if (goal === 'lose weight') {
      calorieGoal = tdee * 0.8; // 20% deficit
    } else if (goal === 'gain weight') {
      calorieGoal = tdee * 1.15; // 15% surplus
    }
    
    // Calculate macros (standard distribution)
    // Protein: 30%, Fat: 30%, Carbs: 40%
    const proteinPercentage = 0.3;
    const fatPercentage = 0.3;
    const carbsPercentage = 0.4;
    
    const proteinCalories = calorieGoal * proteinPercentage;
    const fatCalories = calorieGoal * fatPercentage;
    const carbsCalories = calorieGoal * carbsPercentage;
    
    // Convert to grams
    const protein = Math.round(proteinCalories / 4); // 4 calories per gram of protein
    const fats = Math.round(fatCalories / 9);       // 9 calories per gram of fat
    const carbs = Math.round(carbsCalories / 4);    // 4 calories per gram of carbs
    
    // Save updated goals to user profile
    await setDoc(userRef, {
      calorieGoal: Math.round(calorieGoal),
      protein,
      fats,
      carbs
    }, { merge: true });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log Your Weight</Text>
      
      {/* Your existing UI components */}
      <View style={styles.rulerContainer}>
        <Text style={styles.rulerLabel}>Selected Weight: {weight} {unit}</Text>
        <TouchableOpacity onPress={() => handleWeightChange(weight - 0.5)} style={styles.adjustButton}>
          <Text style={styles.adjustButtonText}>-</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleWeightChange(weight + 0.5)} style={styles.adjustButton}>
          <Text style={styles.adjustButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.unitToggle}>
        <TouchableOpacity onPress={() => setUnit('kg')} style={[styles.unitButton, unit === 'kg' && styles.activeUnit]}>
          <Text style={[styles.unitText, unit === 'kg' && styles.activeUnitText]}>kg</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setUnit('lb')} style={[styles.unitButton, unit === 'lb' && styles.activeUnit]}>
          <Text style={[styles.unitText, unit === 'lb' && styles.activeUnitText]}>lb</Text>
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity onPress={saveWeight} style={styles.saveButton}>
        <Text style={styles.saveButtonText}>Save Weight</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  rulerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  rulerLabel: { fontSize: 18, marginRight: 10 },
  adjustButton: { backgroundColor: '#31256C', padding: 10, borderRadius: 10, marginHorizontal: 5 },
  adjustButtonText: { color: '#FFF', fontSize: 20 },
  unitToggle: { flexDirection: 'row', marginVertical: 20 },
  unitButton: { padding: 10, backgroundColor: '#E0E0E0', borderRadius: 10, marginHorizontal: 5 },
  activeUnit: { backgroundColor: '#31256C' },
  unitText: { color: '#FFF' },
  saveButton: { backgroundColor: '#31256C', padding: 15, borderRadius: 15, marginTop: 30 },
  saveButtonText: { color: '#FFF', fontSize: 18 },
  activeUnitText: { color: '#FFFFFF' },
});