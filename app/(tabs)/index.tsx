import { auth, db } from '@/FirebaseConfig';
import { FontAwesome } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFonts } from 'expo-font';
import { useFocusEffect, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { collection, doc, getDoc, getDocs, query, Timestamp, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Button, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProgressBar } from 'react-native-paper';

SplashScreen.preventAutoHideAsync();

interface UserData {
  protein: number;
  fats: number;
  carbs: number;
  calorieGoal: number;
  name: string;
  profilePictureUrl?: string;
}

interface Meal {
  id: string;
  name: string;
  protein: number;
  fats: number;
  carbs: number;
  calories: number;
  timestamp: Timestamp;
}

export default function DashboardScreen() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [totalCalories, setTotalCalories] = useState(0);
  const [totalProtein, setTotalProtein] = useState(0);
  const [totalCarbs, setTotalCarbs] = useState(0);
  const [totalFats, setTotalFats] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const router = useRouter();
  const [loaded, error] = useFonts({
    'AfacadFlux': require('../../assets/fonts/AfacadFlux-VariableFont_slnt,wght.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  const fetchDailyMealData = async (date: Date) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }
      console.log('User authenticated:', user.uid);

      // Fetch user data
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        console.error('User document does not exist in Firestore');
        throw new Error('User data not found');
      }
      const userData = userSnap.data() as UserData;
      console.log('Fetched user data:', userData);
      setUserData(userData);

      // Fetch meals
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

      const mealsRef = collection(db, 'meals');
      const q = query(
        mealsRef,
        where('userId', '==', user.uid),
        where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
        where('timestamp', '<', Timestamp.fromDate(endOfDay))
      );
      const querySnapshot = await getDocs(q);
      const mealsData: Meal[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Meal[];
      console.log('Fetched meals:', mealsData); // Debugging log
      setMeals(mealsData);

      // Calculate totals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFats = 0;

      mealsData.forEach(meal => {
        totalCalories += meal.calories || 0;
        totalProtein += meal.protein || 0;
        totalCarbs += meal.carbs || 0;
        totalFats += meal.fats || 0;
      });

      setTotalCalories(totalCalories);
      setTotalProtein(totalProtein);
      setTotalCarbs(totalCarbs);
      setTotalFats(totalFats);

    } catch (error) {
      console.error('Error fetching meal data:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchDailyMealData(selectedDate);
    }, [selectedDate])
  );

  const onDateChange = (event: any, date?: Date) => {
    setShowCalendar(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const safeDivision = (numerator: number, denominator: number) => {
    return denominator > 0 ? numerator / denominator : 0;
  };

  if (!loaded) {
    return null; // or a loading spinner
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          {userData?.profilePictureUrl ? (
            <Image 
              source={{ uri: userData.profilePictureUrl }} 
              style={styles.profileImage} 
            />
          ) : (
            <View style={styles.profileImagePlaceholder} />
          )}
          <View style={styles.userTextInfo}>
            <Text style={styles.greeting}>
              {userData ? userData.name : 'Loading...'}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => setShowCalendar(true)}
            style={styles.dateButton}
          >
            <Text style={styles.date}>{selectedDate.toDateString()}</Text>
            <FontAwesome name="calendar" size={20} color="#31256C" style={styles.calendarIcon} />
          </TouchableOpacity>
        </View>
      </View>
      {userData && (
        <View style={styles.macroSection}>
          <Text style={styles.sectionTitle}>Macros</Text>
          <View style={styles.macroItem}>
            <Text style={styles.macroLabel}>Calories</Text>
            <ProgressBar progress={safeDivision(Math.round(totalCalories), Math.round(userData.calorieGoal))} color="#31256C" style={styles.progressBar} />
            <Text style={styles.macroValue}>{Math.round(totalCalories)} / {Math.round(userData.calorieGoal)} kcal</Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={styles.macroLabel}>Protein</Text>
            <ProgressBar progress={safeDivision(Math.round(totalProtein), Math.round(userData.protein))} color="#31256C" style={styles.progressBar} />
            <Text style={styles.macroValue}>{Math.round(totalProtein)} / {Math.round(userData.protein)} g</Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={styles.macroLabel}>Fats</Text>
            <ProgressBar progress={safeDivision(Math.round(totalFats), Math.round(userData.fats))} color="#31256C" style={styles.progressBar} />
            <Text style={styles.macroValue}>{Math.round(totalFats)} / {Math.round(userData.fats)} g</Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={styles.macroLabel}>Carbs</Text>
            <ProgressBar progress={safeDivision(Math.round(totalCarbs), Math.round(userData.carbs))} color="#31256C" style={styles.progressBar} />
            <Text style={styles.macroValue}>{Math.round(totalCarbs)} / {Math.round(userData.carbs)} g</Text>
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
        <TouchableOpacity style={styles.addMealButton} onPress={() => router.push('/MealSearchScreen')}>
          <Text style={styles.addMealButtonText}>Add Meal</Text>
        </TouchableOpacity>
      </View>
      {showCalendar && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={showCalendar}
          onRequestClose={() => setShowCalendar(false)}
        >
          <View style={styles.overlay}>
            <View style={styles.calendarContainer}>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={onDateChange}
              />
              <Button title="Close" onPress={() => setShowCalendar(false)} />
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FAFAFA',
    fontFamily: 'AfacadFlux',
  },
  header: {
    marginBottom: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  userTextInfo: {
    flex: 1,
    marginLeft: 15,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  profileImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  date: {
    fontSize: 18,
    color: '#31256C',
    fontFamily: 'AfacadFlux',
    marginRight: 8,
  },
  calendarIcon: {
    marginLeft: 0,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#31256C',
    fontFamily: 'AfacadFlux',
  },
  macroSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    color: '#31256C',
    fontFamily: 'AfacadFlux',
  },
  macroItem: {
    marginBottom: 15,
  },
  macroLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
    color: '#31256C',
    fontFamily: 'AfacadFlux',
  },
  macroValue: {
    fontSize: 16,
    color: '#31256C',
    marginTop: 5,
    fontFamily: 'AfacadFlux',
  },
  mealsSection: {
    marginBottom: 30,
  },
  noMealsText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    fontFamily: 'AfacadFlux',
  },
  mealItem: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
  },
  mealName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#31256C',
    fontFamily: 'AfacadFlux',
  },
  mealMacros: {
    fontSize: 16,
    color: '#31256C',
    fontFamily: 'AfacadFlux',
  },
  addMealButton: {
    backgroundColor: '#31256C',
    padding: 15,
    borderRadius: 25,
    marginTop: 30,
    alignItems: 'center',
    fontFamily: 'AfacadFlux',
  },
  addMealButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'AfacadFlux',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
  },
});