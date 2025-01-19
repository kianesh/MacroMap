import { auth, db } from '@/FirebaseConfig';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ProgressBarAndroid, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface UserData {
  protein: number;
  fats: number;
  carbs: number;
  calorieGoal: number;
}

interface Meal {
  id: string;
  name: string;
  protein: number;
  fats: number;
  carbs: number;
  calories: number;
}

export default function DashboardScreen() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
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

    const fetchMeals = async () => {
      const user = auth.currentUser;
      if (user) {
        const mealsRef = collection(db, 'meals');
        const q = query(mealsRef, where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const mealsData: Meal[] = [];
        querySnapshot.forEach((doc) => {
          mealsData.push({ id: doc.id, ...doc.data() } as Meal);
        });
        setMeals(mealsData);
      }
    };

    fetchUserData();
    fetchMeals();
  }, []);

  const calculateTotal = (key: keyof Meal) => {
    return meals.reduce((total, meal) => total + meal[key], 0);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      {userData && (
        <View style={styles.macroSection}>
          <Text style={styles.sectionTitle}>Macros</Text>
          <View style={styles.macroItem}>
            <Text style={styles.macroLabel}>Calories</Text>
            <ProgressBarAndroid
              styleAttr="Horizontal"
              indeterminate={false}
              progress={calculateTotal('calories') / userData.calorieGoal}
              color="#31256C"
            />
            <Text style={styles.macroValue}>{calculateTotal('calories')} / {userData.calorieGoal} kcal</Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={styles.macroLabel}>Protein</Text>
            <ProgressBarAndroid
              styleAttr="Horizontal"
              indeterminate={false}
              progress={calculateTotal('protein') / userData.protein}
              color="#31256C"
            />
            <Text style={styles.macroValue}>{calculateTotal('protein')} / {userData.protein} g</Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={styles.macroLabel}>Fats</Text>
            <ProgressBarAndroid
              styleAttr="Horizontal"
              indeterminate={false}
              progress={calculateTotal('fats') / userData.fats}
              color="#31256C"
            />
            <Text style={styles.macroValue}>{calculateTotal('fats')} / {userData.fats} g</Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={styles.macroLabel}>Carbs</Text>
            <ProgressBarAndroid
              styleAttr="Horizontal"
              indeterminate={false}
              progress={calculateTotal('carbs') / userData.carbs}
              color="#31256C"
            />
            <Text style={styles.macroValue}>{calculateTotal('carbs')} / {userData.carbs} g</Text>
          </View>
        </View>
      )}
      <View style={styles.mealsSection}>
        <Text style={styles.sectionTitle}>Meals</Text>
        {meals.length === 0 ? (
          <Text style={styles.noMealsText}>No meals logged for today.</Text>
        ) : (
          meals.map((meal) => (
            <View key={meal.id} style={styles.mealItem}>
              <Text style={styles.mealName}>{meal.name}</Text>
              <Text style={styles.mealMacros}>Protein: {meal.protein}g, Fats: {meal.fats}g, Carbs: {meal.carbs}g, Calories: {meal.calories}kcal</Text>
            </View>
          ))
        )}
        <TouchableOpacity style={styles.addMealButton} onPress={() => router.push('/(tabs)/MealSearchScreen')}>
          <Text style={styles.addMealButtonText}>Add Meal</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FAFAFA',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
    color: '#31256C',
    textAlign: 'center',
  },
  macroSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    color: '#31256C',
  },
  macroItem: {
    marginBottom: 15,
  },
  macroLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
    color: '#31256C',
  },
  macroValue: {
    fontSize: 16,
    color: '#31256C',
    marginTop: 5,
  },
  mealsSection: {
    marginBottom: 30,
  },
  noMealsText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  mealItem: {
    marginBottom: 15,
  },
  mealName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#31256C',
  },
  mealMacros: {
    fontSize: 16,
    color: '#31256C',
  },
  addMealButton: {
    backgroundColor: '#31256C',
    padding: 15,
    borderRadius: 25,
    marginTop: 30,
    alignItems: 'center',
  },
  addMealButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});