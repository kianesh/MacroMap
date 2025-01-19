import axios from 'axios';
import { auth, db } from '@/FirebaseConfig';
import { useRouter } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const NUTRITIONIX_API_URL = 'https://trackapi.nutritionix.com/v2/search/instant';
const NUTRITIONIX_APP_ID = '2669dd01';
const NUTRITIONIX_API_KEY = 'fd960d561e6cbf69af473581dcf31b1f';

interface NutritionInfo {
  food_name: string;
  brand_name?: string;
  serving_qty: number;
  serving_unit: string;
  nf_calories: number;
  nf_total_fat: number;
  nf_protein: number;
  nf_total_carbohydrate: number;
}

export default function MealSearchScreen() {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<NutritionInfo[]>([]);
  const router = useRouter();

  const searchMeals = async () => {
    if (!query.trim()) {
      console.error('Search query is empty.');
      return;
    }

    try {
      const response = await axios.get(NUTRITIONIX_API_URL, {
        params: { query },
        headers: {
          'x-app-id': NUTRITIONIX_APP_ID,
          'x-app-key': NUTRITIONIX_API_KEY,
        },
      });

      const brandedFoods = response.data.branded.map((food: any) => ({
        food_name: food.food_name,
        brand_name: food.brand_name,
        serving_qty: food.serving_qty,
        serving_unit: food.serving_unit,
        nf_calories: food.nf_calories,
        nf_total_fat: food.nf_total_fat,
        nf_protein: food.nf_protein,
        nf_total_carbohydrate: food.nf_total_carbohydrate,
      }));

      setResults(brandedFoods);
    } catch (error) {
      console.error('Error fetching meals:', error);
    }
  };

  const logMeal = async (meal: NutritionInfo) => {
    const user = auth.currentUser;
    if (user) {
      const mealData = {
        userId: user.uid,
        name: meal.food_name,
        brand_name: meal.brand_name || 'N/A',
        protein: meal.nf_protein || 0,
        fats: meal.nf_total_fat || 0,
        carbs: meal.nf_total_carbohydrate || 0,
        calories: meal.nf_calories || 0,
        timestamp: new Date(),
      };

      try {
        await addDoc(collection(db, 'meals'), mealData);
        console.log('Meal logged:', mealData);
        router.push('/(tabs)/index'); // Navigates to index screen
      } catch (error) {
        console.error('Error logging meal:', error);
      }
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search for meals"
        value={query}
        onChangeText={setQuery}
      />
      <TouchableOpacity style={styles.searchButton} onPress={searchMeals}>
        <Text style={styles.searchButtonText}>Search</Text>
      </TouchableOpacity>
      <ScrollView>
        {results.length > 0 ? (
          results.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              <Text style={styles.resultName}>{result.food_name}</Text>
              <Text style={styles.resultBrand}>{result.brand_name}</Text>
              <Text style={styles.resultMacros}>
                Serving: {result.serving_qty} {result.serving_unit}
              </Text>
              <Text style={styles.resultMacros}>
                Calories: {result.nf_calories} kcal
              </Text>
              <Text style={styles.resultMacros}>
                Protein: {result.nf_protein} g, Fats: {result.nf_total_fat} g, Carbs: {result.nf_total_carbohydrate} g
              </Text>
              <TouchableOpacity style={styles.logButton} onPress={() => logMeal(result)}>
                <Text style={styles.logButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.noResultsText}>No results found.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FAFAFA',
  },
  searchInput: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EAF6',
    borderWidth: 2,
    borderRadius: 15,
    marginVertical: 15,
    paddingHorizontal: 25,
    fontSize: 16,
    color: '#3C4858',
  },
  searchButton: {
    backgroundColor: '#31256C',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 20,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultItem: {
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resultName: {
    fontSize: 18,
    fontWeight: '600',
  },
  resultBrand: {
    fontSize: 16,
    color: '#888',
  },
  resultMacros: {
    fontSize: 16,
    marginVertical: 5,
  },
  logButton: {
    backgroundColor: '#31256C',
    padding: 10,
    borderRadius: 15,
    alignItems: 'center',
  },
  logButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noResultsText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
});
