import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Keyboard, Linking, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { auth, db } from '../FirebaseConfig';

interface NutritionInfo {
  food_name: string;
  brand_name?: string;
  serving_qty: number;
  serving_unit: string;
  nf_calories: number;
  nf_total_fat: number;
  nf_protein: number;
  nf_total_carbohydrate: number;
  image_url?: string;
}

export default function AdjustServingScreen() {
  const { meal } = useLocalSearchParams();
  const mealData: NutritionInfo = JSON.parse(meal as string);
  const [servingQty, setServingQty] = useState<number>(1);
  const [grams, setGrams] = useState<string>("100");
  const router = useRouter();

  // Check if it's a branded food (has brand name) or generic food
  const isBranded = !!mealData.brand_name;
  
  // Calculate adjusted macros based on serving
  const [adjustedMacros, setAdjustedMacros] = useState({
    calories: mealData.nf_calories,
    protein: mealData.nf_protein,
    fat: mealData.nf_total_fat,
    carbs: mealData.nf_total_carbohydrate
  });

  useEffect(() => {
    updateMacros();
  }, [servingQty, grams]);

  const updateMacros = () => {
    if (isBranded) {
      // For branded foods, we multiply by the number of servings
      setAdjustedMacros({
        calories: Math.round(mealData.nf_calories * servingQty * 10) / 10,
        protein: Math.round(mealData.nf_protein * servingQty * 10) / 10,
        fat: Math.round(mealData.nf_total_fat * servingQty * 10) / 10,
        carbs: Math.round(mealData.nf_total_carbohydrate * servingQty * 10) / 10
      });
    } else {
      // For generic foods, we calculate based on grams
      const gramsNum = parseFloat(grams) || 0;
      const ratio = gramsNum / 100; // Assuming base serving is 100g
      
      setAdjustedMacros({
        calories: Math.round(mealData.nf_calories * ratio * 10) / 10,
        protein: Math.round(mealData.nf_protein * ratio * 10) / 10,
        fat: Math.round(mealData.nf_total_fat * ratio * 10) / 10,
        carbs: Math.round(mealData.nf_total_carbohydrate * ratio * 10) / 10
      });
    }
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      const mealsRef = collection(db, 'meals');
      await addDoc(mealsRef, {
        userId: user.uid,
        name: mealData.food_name,
        brand_name: mealData.brand_name || '',
        protein: adjustedMacros.protein,
        fats: adjustedMacros.fat,
        carbs: adjustedMacros.carbs,
        calories: adjustedMacros.calories,
        serving: isBranded ? `${servingQty} ${mealData.serving_unit}` : `${grams}g`,
        image_url: mealData.image_url, // Add this line
        timestamp: Timestamp.now(),
      });

      Alert.alert('Success', 'Meal logged successfully');
      router.push('/(tabs)');
    } catch (error) {
      console.error('Error logging meal:', error);
      Alert.alert('Error', 'Failed to log meal');
    }
  };

  const incrementServing = () => {
    setServingQty(prev => prev + 1);
  };

  const decrementServing = () => {
    if (servingQty > 1) {
      setServingQty(prev => prev - 1);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="chevron-left" size={24} color="#31256C" />
          </TouchableOpacity>
          <Text style={styles.title}>Adjust Serving</Text>
          <View style={{width: 24}}></View>
        </View>
        
        <View style={styles.foodInfoContainer}>
          {mealData.image_url ? (
            <Image 
              source={{ uri: mealData.image_url }} 
              style={styles.foodImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.foodImage, styles.placeholderImage]}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
          <Text style={styles.foodName}>{mealData.food_name}</Text>
          {mealData.brand_name && <Text style={styles.brandName}>{mealData.brand_name}</Text>}
        </View>

        <View style={styles.servingContainer}>
          {isBranded ? (
            /* For branded foods - numeric stepper */
            <View style={styles.servingSelectorContainer}>
              <Text style={styles.servingLabel}>
                Number of {mealData.serving_unit}s
              </Text>
              <View style={styles.stepperContainer}>
                <TouchableOpacity onPress={decrementServing} style={styles.stepperButton}>
                  <Text style={styles.stepperButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.servingValue}>{servingQty}</Text>
                <TouchableOpacity onPress={incrementServing} style={styles.stepperButton}>
                  <Text style={styles.stepperButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* For generic foods - gram input */
            <View style={styles.servingSelectorContainer}>
              <Text style={styles.servingLabel}>
                Amount (grams)
              </Text>
              <TextInput
                style={styles.gramsInput}
                keyboardType="numeric"
                value={grams}
                onChangeText={setGrams}
              />
            </View>
          )}
        </View>

        <View style={styles.macrosContainer}>
          <Text style={styles.macrosTitle}>Macros</Text>
          <View style={styles.macroRow}>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>Calories</Text>
              <Text style={styles.macroValue}>{adjustedMacros.calories} kcal</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>Protein</Text>
              <Text style={styles.macroValue}>{adjustedMacros.protein}g</Text>
            </View>
          </View>
          <View style={styles.macroRow}>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>Carbs</Text>
              <Text style={styles.macroValue}>{adjustedMacros.carbs}g</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>Fat</Text>
              <Text style={styles.macroValue}>{adjustedMacros.fat}g</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Add to Meals</Text>
        </TouchableOpacity>

        <View style={styles.deliveryButtonsContainer}>
          <TouchableOpacity 
            style={styles.deliveryButton}
            onPress={() => Linking.openURL(`https://www.ubereats.com/search?q=${encodeURIComponent(mealData.food_name)}`)}
          >
            <Image 
              source={require('../assets/images/uber-eats-logo.jpg')} 
              style={styles.deliveryLogo}
              resizeMode="contain"
            />
            <Text style={styles.deliveryButtonText}>Order on Uber Eats</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.deliveryButton}
            onPress={() => Linking.openURL(`https://www.doordash.com/search/store/${encodeURIComponent(mealData.food_name)}`)}
          >
            <Image 
              source={require('../assets/images/doordash-logo.png')} 
              style={styles.deliveryLogo}
              resizeMode="contain"
            />
            <Text style={styles.deliveryButtonText}>Order on DoorDash</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#31256C',
    textAlign: 'center',
  },
  foodInfoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  foodImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    fontSize: 14,
  },
  foodName: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 5,
  },
  brandName: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  servingContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  servingSelectorContainer: {
    alignItems: 'center',
  },
  servingLabel: {
    fontSize: 18,
    marginBottom: 15,
    color: '#31256C',
    fontWeight: '500',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperButton: {
    width: 40,
    height: 40,
    backgroundColor: '#31256C',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  servingValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginHorizontal: 20,
    minWidth: 40,
    textAlign: 'center',
  },
  gramsInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    fontSize: 18,
    width: '50%',
    textAlign: 'center',
  },
  macrosContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  macrosTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#31256C',
    textAlign: 'center',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
  },
  macroLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#31256C',
  },
  saveButton: {
    backgroundColor: '#31256C',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  deliveryButtonsContainer: {
    marginTop: 15,
  },
  deliveryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#31256C',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  deliveryLogo: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  deliveryButtonText: {
    color: '#31256C',
    fontSize: 16,
    fontWeight: '500',
  },
});