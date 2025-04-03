import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../FirebaseConfig';

interface UserData {
  goal?: string;
  age?: number;
  height?: number;
  weight?: number;
  gender?: string;
  activityLevel?: string;
  protein?: number;
  carbs?: number;
  fats?: number;
  calorieGoal?: number;
}

export default function AboutScreen() {
  const [userData, setUserData] = useState<UserData>({});
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      setUserData(userSnap.data() as UserData);
    }
  };

  const handleSave = async () => {
    if (!userData) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser!.uid);

      // Calculate nutrition goals based on updated data
      const nutritionGoals = calculateNutritionGoals(userData);
      
      // Merge the updated user data with calculated nutrition goals
      await updateDoc(userRef, {
        ...userData,
        ...nutritionGoals
      });

      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };


  // Add this function to update goals when metrics change
  const calculateNutritionGoals = (userData: any) => {
    const { 
      weight = 70,  // kg
      height = 175, // cm 
      age = 30,
      gender = 'male', 
      activityLevel = 'moderate',
      goal = 'maintain weight'
    } = userData;
      
    // Calculate BMR using Mifflin-St Jeor Equation
    let bmr = 0;
    if (gender === 'male') {
      bmr = 10 * (weight || 70) + 6.25 * (height || 175) - 5 * (age || 30) + 5;
    } else {
      bmr = 10 * (weight || 70) + 6.25 * (height || 175) - 5 * (age || 30) - 161;
    }
      
    // Activity level multiplier
    const activityMultipliers = {
      'sedentary': 1.2,      // Little or no exercise
      'low active': 1.375,   // Light exercise 1-3 days/week
      'moderate': 1.55,      // Moderate exercise 3-5 days/week
      'active': 1.725,       // Hard exercise 6-7 days/week
      'very active': 1.9     // Very hard exercise & physical job
    };
      
    // Get multiplier based on activity level
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
      
    return {
      calorieGoal: Math.round(calorieGoal),
      protein,
      fats,
      carbs
    };
  };

  const renderField = (label: string, field: keyof UserData, unit?: string) => {
    if (field === 'activityLevel' && isEditing) {
      return (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{label}</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={userData[field]?.toString() || 'moderate'}
              style={styles.picker}
              onValueChange={(value) => setUserData(prev => ({ ...prev, [field]: value }))}
            >
              <Picker.Item label="Sedentary" value="sedentary" />
              <Picker.Item label="Low Active" value="low active" />
              <Picker.Item label="Moderate" value="moderate" />
              <Picker.Item label="Active" value="active" />
              <Picker.Item label="Very Active" value="very active" />
            </Picker>
          </View>
        </View>
      );
    } else if (field === 'goal' && isEditing) {
      return (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{label}</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={userData[field]?.toString() || 'maintain weight'}
              style={styles.picker}
              onValueChange={(value) => setUserData(prev => ({ ...prev, [field]: value }))}
            >
              <Picker.Item label="Lose Weight" value="lose weight" />
              <Picker.Item label="Maintain Weight" value="maintain weight" />
              <Picker.Item label="Gain Weight" value="gain weight" />
            </Picker>
          </View>
        </View>
      );
    } else if (field === 'gender' && isEditing) {
      return (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{label}</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={userData[field]?.toString() || 'male'}
              style={styles.picker}
              onValueChange={(value) => setUserData(prev => ({ ...prev, [field]: value }))}
            >
              <Picker.Item label="Male" value="male" />
              <Picker.Item label="Female" value="female" />
            </Picker>
          </View>
        </View>
      );
    } else {
      return (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{label}</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={userData[field]?.toString() || ''}
              onChangeText={(text) => setUserData(prev => ({ ...prev, [field]: text }))}
              placeholder={`Enter ${label.toLowerCase()}`}
              keyboardType={field === 'age' || field === 'height' || field === 'weight' ? 'numeric' : 'default'}
            />
          ) : (
            <Text style={styles.infoValue}>
              {userData[field]}{unit}
            </Text>
          )}
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Me</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.editButton}>
            <Text style={styles.editButtonText}>{isEditing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          {renderField('Goal', 'goal')}
          {renderField('Age', 'age', ' years')}
          {renderField('Height', 'height', ' cm')}
          {renderField('Weight', 'weight', ' kg')}
          {renderField('Gender', 'gender')}
          {renderField('Lifestyle', 'activityLevel')}
        </View>

        {isEditing && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        )}
        
        <View style={{height: 50}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    justifyContent: 'space-between',
  },
  backButton: {
    fontSize: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    flex: 1,
    marginLeft: 20,
  },
  editButton: {
    padding: 8,
  },
  editButtonText: {
    color: '#31256C',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    flex: 1,
    padding: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#000000',
  },
  infoValue: {
    fontSize: 16,
    color: '#31256C',
    fontWeight: '500',
  },
  input: {
    fontSize: 16,
    color: '#31256C',
    textAlign: 'right',
    minWidth: 100,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
  },
  saveButton: {
    backgroundColor: '#31256C',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#31256C',
    marginTop: 20,
    marginBottom: 10,
    fontFamily: 'AfacadFlux',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    width: 150,
  },
  picker: {
    height: 40,
    width: 150,
  },
});
