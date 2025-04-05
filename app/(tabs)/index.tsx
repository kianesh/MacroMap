import { FontAwesome } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFonts } from 'expo-font';
import { useFocusEffect, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { collection, doc, getDoc, getDocs, query, Timestamp, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { ProgressBar } from 'react-native-paper';
import { auth, db } from '../../FirebaseConfig';

SplashScreen.preventAutoHideAsync();

interface UserData {
  protein: number;
  fats: number;
  carbs: number;
  calorieGoal: number;
  name: string;
  profilePictureUrl?: string;
}

// Update your Meal interface to include these fields
interface Meal {
  id: string;
  name: string;
  brand_name?: string;
  protein: number;
  fats: number;
  carbs: number;
  calories: number;
  serving?: string;
  image_url?: string;
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
      if (!user) throw new Error('User not authenticated');

      // Fetch user data
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) throw new Error('User data not found');
      const fetchedUserData = userSnap.data() as UserData;
      setUserData(fetchedUserData);

      // Fetch meals for selected day
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
      setMeals(mealsData);

      // Calculate totals
      let cal = 0, prot = 0, carbs = 0, fats = 0;
      mealsData.forEach(meal => {
        cal += meal.calories || 0;
        prot += meal.protein || 0;
        carbs += meal.carbs || 0;
        fats += meal.fats || 0;
      });
      setTotalCalories(cal);
      setTotalProtein(prot);
      setTotalCarbs(carbs);
      setTotalFats(fats);

    } catch (error) {
      console.error('Error fetching meal data:', error);
    }
  };

  useFocusEffect(React.useCallback(() => {
    fetchDailyMealData(selectedDate);
  }, [selectedDate]));

  const onDateChange = (event: any, date?: Date) => {
    setShowCalendar(false);
    if (date) {
      setSelectedDate(date);
      fetchDailyMealData(date); // Immediately fetch data for the selected date
    }
  };

  const safeDivision = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : 0;

  const handleEditMeal = (meal: Meal) => {
    const nutritionInfo = {
      food_name: meal.name,
      brand_name: meal.brand_name || '',
      serving_qty: 1,
      serving_unit: 'serving',
      nf_calories: meal.calories,
      nf_protein: meal.protein,
      nf_total_fat: meal.fats,
      nf_total_carbohydrate: meal.carbs,
      mealId: meal.id,
      image_url: meal.image_url // Add this line
    };
    
    router.push(`/EditMealScreen?meal=${JSON.stringify(nutritionInfo)}`);
  };

  const handleDateButtonPress = () => {
    if (Platform.OS === 'ios') {
      // For iOS, show the DateTimePicker directly
      setShowCalendar(true);
    } else {
      // For Android, show the modal with DateTimePicker
      setShowCalendar(true);
    }
  };

  if (!loaded) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          {userData?.profilePictureUrl ? (
            <Image source={{ uri: userData.profilePictureUrl }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder} />
          )}
          <View style={styles.userTextInfo}>
            <Text style={styles.greeting}>{userData ? userData.name : 'Loading...'}</Text>
          </View>
          <TouchableOpacity onPress={handleDateButtonPress} style={styles.dateButton}>
            <Text style={styles.date}>{selectedDate.toDateString()}</Text>
            <FontAwesome name="calendar" size={20} color="#31256C" style={styles.calendarIcon} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Macros Section */}
      {userData && (
        <View style={styles.macroSection}>
          <Text style={styles.sectionTitle}>Macros</Text>
          <View style={styles.macroRow}>
            <View style={styles.macroColumn}>
              <Text style={styles.macroLabel}>Protein</Text>
              <View style={styles.progressBarContainer}>
                <ProgressBar 
                  progress={safeDivision(Math.round(totalProtein), Math.round(userData.protein))} 
                  color="#31256C"
                  style={styles.progressBarSmall}
                />
              </View>
              <Text style={styles.macroValue}>{Math.round(totalProtein)} / {Math.round(userData.protein)} g</Text>
            </View>
            <View style={styles.macroColumn}>
              <Text style={styles.macroLabel}>Fats</Text>
              <View style={styles.progressBarContainer}>
                <ProgressBar 
                  progress={safeDivision(Math.round(totalFats), Math.round(userData.fats))} 
                  color="#31256C"
                  style={styles.progressBarSmall}
                />
              </View>
              <Text style={styles.macroValue}>{Math.round(totalFats)} / {Math.round(userData.fats)} g</Text>
            </View>
            <View style={styles.macroColumn}>
              <Text style={styles.macroLabel}>Carbs</Text>
              <View style={styles.progressBarContainer}>
                <ProgressBar 
                  progress={safeDivision(Math.round(totalCarbs), Math.round(userData.carbs))} 
                  color="#31256C"
                  style={styles.progressBarSmall}
                />
              </View>
              <Text style={styles.macroValue}>{Math.round(totalCarbs)} / {Math.round(userData.carbs)} g</Text>
            </View>
          </View>
          <View style={styles.caloriesContainer}>
            <Text style={styles.macroLabel}>Calories</Text>
            <View style={styles.progressBarContainer}>
              <ProgressBar 
                progress={safeDivision(Math.round(totalCalories), Math.round(userData.calorieGoal))} 
                color="#31256C"
                style={styles.progressBar} 
              />
            </View>
            <Text style={styles.macroValue}>{Math.round(totalCalories)} / {Math.round(userData.calorieGoal)} kcal</Text>
          </View>
        </View>
      )}

        <View style={styles.buttonsRow}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => router.push('/MealSearchScreen')}
        >
          <FontAwesome name="plus" size={18} color="#fff" style={styles.actionIcon} />
          <Text style={styles.actionButtonText}>Add Meal</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => router.push('/LogWeightScreen')}
        >
          <FontAwesome name="balance-scale" size={18} color="#fff" style={styles.actionIcon} />
          <Text style={styles.actionButtonText}>Log Weight</Text>
        </TouchableOpacity>
      </View>

      {/* Meals Section */}
      <View style={styles.mealsSection}>
        <Text style={styles.sectionTitle}>Meals</Text>
        


        {/* Meals list */}
        {meals.length === 0 ? (
          <Text style={styles.noMealsText}>No meals logged for today.</Text>
        ) : (
          meals.map((meal) => (
            <TouchableOpacity 
              key={meal.id} 
              style={styles.mealItem}
              onPress={() => handleEditMeal(meal)}
            >
              <View style={styles.mealItemContent}>
                {meal.image_url ? (
                  <Image 
                    source={{ uri: meal.image_url }} 
                    style={styles.mealImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.mealImagePlaceholder}>
                    <FontAwesome name="cutlery" size={18} color="#ccc" />
                  </View>
                )}
                <View style={styles.mealDetails}>
                  <View style={styles.mealHeader}>
                    <Text style={styles.mealName}>{meal.name}</Text>
                    <Text style={styles.mealServing}>{meal.serving || '1 serving'}</Text>
                  </View>
                  <Text style={styles.mealMacros}>
                    Protein: {meal.protein}g, Fats: {meal.fats}g, Carbs: {meal.carbs}g, Calories: {meal.calories}kcal
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.editIconContainer}
                onPress={() => handleEditMeal(meal)}
              >
                <FontAwesome name="pencil" size={14} color="#31256C" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Calendar Modal */}
      {showCalendar && (
        <Modal 
          transparent={true} 
          animationType="fade" 
          visible={showCalendar} 
          onRequestClose={() => setShowCalendar(false)}
        >
          <TouchableOpacity 
            style={styles.overlay} 
            activeOpacity={1} 
            onPress={() => setShowCalendar(false)}
          >
            <TouchableWithoutFeedback>
              <View style={styles.calendarContainer}>
                <Text style={styles.calendarTitle}>Select Date</Text>
                <DateTimePicker
                  testID="dateTimePicker"
                  value={selectedDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                  style={styles.datePicker}
                />
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setShowCalendar(false)}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
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
  calendarIcon: {},
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
  // Macros: row with Protein, Fats, Carbs
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  macroColumn: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 5,
    width: '30%', // Add this
  },
  caloriesContainer: {
    alignItems: 'center',
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
  progressBar: {
    height: 7, // Increased height
    borderRadius: 8,
    width: '95%',
    backgroundColor: '#E0E0E0', // Light background for contrast
    marginVertical: 0, // Added vertical margin
  },
  progressBarSmall: {
    height: 5, // Increased height
    borderRadius: 6,
    width: '100%',
    backgroundColor: '#E0E0E0', // Light background for contrast
    marginVertical: 0, // Added vertical margin
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
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', // changed from space-around
    marginBottom: 20,
    paddingHorizontal: 0,
    gap:15,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#31256C',
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderRadius: 12,
    marginHorizontal: 0,
  },
  actionIcon: {
    marginRight: 8,
  },
  actionButtonText: {
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
    borderRadius: 15,
    alignItems: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  progressBarContainer: {
    width: '100%',
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
    padding: 2, // Add padding around the progress bar
    marginVertical: 8, // Add space above and below
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  mealServing: {
    fontSize: 14,
    color: '#666',
  },
  editIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  mealItemContent: {
    flexDirection: 'row',
    flex: 1,
  },
  mealImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  mealImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mealDetails: {
    flex: 1,
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5', // Light background for contrast
    borderRadius: 15, // Make it circular
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#31256C',
    marginBottom: 20,
    textAlign: 'center',
  },
  datePicker: {
    width: 300,
  },
  closeButton: {
    backgroundColor: '#31256C',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'AfacadFlux',
  },
});