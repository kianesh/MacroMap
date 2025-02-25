import { auth, db } from '@/FirebaseConfig';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      const formattedData: { [key: string]: any } = {};
      Object.entries(userData).forEach(([key, value]) => {
        if (['age', 'height', 'weight'].includes(key)) {
          formattedData[key] = Number(value) || 0;
        } else {
          formattedData[key] = value;
        }
      });
      await updateDoc(userRef, formattedData);
      recalculateNutritionGoals(formattedData);
      setIsEditing(false);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    }
  };

  const recalculateNutritionGoals = async (userData: UserData) => {
    // Example logic to recalculate nutrition goals
    const { age, weight, height, gender, activityLevel, goal } = userData;
    const newCalorieGoal = calculateCalories(age, weight, height, gender, activityLevel, goal);
    const newProtein = calculateProtein(weight, goal);
    const newCarbs = calculateCarbs(newCalorieGoal);
    const newFats = calculateFats(newCalorieGoal);

    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        calorieGoal: newCalorieGoal,
        protein: newProtein,
        carbs: newCarbs,
        fats: newFats,
      });
    }
  };

  // Example calculation functions
  const calculateCalories = (age: number, weight: number, height: number, gender: string, activityLevel: string, goal: string) => {
    // Implement your logic here
    return 2000; // Placeholder value
  };

  const calculateProtein = (weight: number, goal: string) => {
    // Implement your logic here
    return 150; // Placeholder value
  };

  const calculateCarbs = (calorieGoal: number) => {
    // Implement your logic here
    return 200; // Placeholder value
  };

  const calculateFats = (calorieGoal: number) => {
    // Implement your logic here
    return 80; // Placeholder value
  };

  const renderField = (label: string, field: keyof UserData, unit?: string) => {
    return (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={userData[field]?.toString() || ''}
            onChangeText={(text) => setUserData(prev => ({ ...prev, [field]: text }))}
            placeholder={`Enter ${label.toLowerCase()}`}
          />
        ) : (
          <Text style={styles.infoValue}>
            {userData[field]}{unit}
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
});
