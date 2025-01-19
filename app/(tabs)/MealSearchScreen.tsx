import { auth, db } from '@/FirebaseConfig';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const BASE_API_URL = 'https://food-nutrition.canada.ca/api/canadian-nutrient-file/';
const FOOD_API_URL = `${BASE_API_URL}food/`;

interface NutritionInfo {
  food_code: string;
  food_description: string;
  serving_qty?: number;
  serving_unit?: string;
  nf_calories: number;
  nf_total_fat: number;
  nf_protein: number;
  nf_total_carbohydrate: number;
  nutrient_groups?: any[];
  nutrient_sources?: any[];
  yield_amount?: number;
}

export default function MealSearchScreen() {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<NutritionInfo[]>([]);
  const [nutrientGroups, setNutrientGroups] = useState<any[]>([]);
  const [nutrientSources, setNutrientSources] = useState<any[]>([]);
  const router = useRouter();

  // Fetch Supporting Data on Initialization
  useEffect(() => {
    const fetchNutrientGroups = async () => {
      try {
        const response = await axios.get(`${BASE_API_URL}nutrientgroup/?lang=en&type=json`);
        setNutrientGroups(response.data);
      } catch (error) {
        console.error('Error fetching nutrient groups:', error);
      }
    };

    const fetchNutrientSources = async () => {
      try {
        const response = await axios.get(`${BASE_API_URL}nutrientsource/?lang=en&type=json`);
        setNutrientSources(response.data);
      } catch (error) {
        console.error('Error fetching nutrient sources:', error);
      }
    };

    fetchNutrientGroups();
    fetchNutrientSources();
  }, []);

  const searchMeals = async () => {
    try {
      if (!query.trim()) {
        console.error('Search query is empty.');
        return;
      }
      console.log(`Searching for: ${query}`);
      const url = `${FOOD_API_URL}?lang=en&type=json&search=${encodeURIComponent(query)}`;
      const response = await axios.get(url);

      if (!response.data || !Array.isArray(response.data)) {
        console.error('Unexpected API response format:', response.data);
        setResults([]);
        return;
      }

      const filteredFoods = response.data.filter((food: any) =>
        food.food_description.toLowerCase().includes(query.toLowerCase())
      );

      const enrichedFoods = await Promise.all(
        filteredFoods.slice(0, 10).map(async (food: any) => {
          try {
            const [nutrientResponse, servingResponse, yieldResponse] = await Promise.all([
              axios.get(`${BASE_API_URL}nutrientamount/?id=${food.food_code}`),
              axios.get(`${BASE_API_URL}servingsize/?type=json&lang=en&foodcode=${food.food_code}`),
              axios.get(`${BASE_API_URL}yieldamount/?lang=en&type=json&foodcode=${food.food_code}`),
            ]);

            const defaultServing = servingResponse.data?.[0];
            const yieldAmount = yieldResponse.data?.[0]?.yield || 1;

            return {
              food_code: food.food_code,
              food_description: food.food_description,
              serving_qty: defaultServing?.serving_size || 1,
              serving_unit: defaultServing?.serving_description || 'unit',
              nf_calories: nutrientResponse.data?.find((n: any) => n.nutrient_name === 'Energy (kcal)')?.value || 0,
              nf_protein: nutrientResponse.data?.find((n: any) => n.nutrient_name === 'Protein')?.value || 0,
              nf_total_fat: nutrientResponse.data?.find((n: any) => n.nutrient_name === 'Total fat')?.value || 0,
              nf_total_carbohydrate: nutrientResponse.data?.find((n: any) => n.nutrient_name === 'Carbohydrate, by difference')?.value || 0,
              nutrient_groups: nutrientGroups,
              nutrient_sources: nutrientSources,
              yield_amount: yieldAmount,
            };
          } catch (error) {
            console.error(`Failed to fetch nutrient data for food_code ${food.food_code}:`, error);
            return {
              food_code: food.food_code,
              food_description: food.food_description,
              serving_qty: 1,
              serving_unit: 'unit',
              nf_calories: 0,
              nf_protein: 0,
              nf_total_fat: 0,
              nf_total_carbohydrate: 0,
            };
          }
        })
      );

      setResults(enrichedFoods);
    } catch (error) {
      console.error('Error fetching meals:', error);
    }
  };

  const logMeal = async (meal: NutritionInfo) => {
    const user = auth.currentUser;
    if (user) {
      const mealData = {
        userId: user.uid,
        name: meal.food_description,
        protein: meal.nf_protein || 0,
        fats: meal.nf_total_fat || 0,
        carbs: meal.nf_total_carbohydrate || 0,
        calories: meal.nf_calories || 0,
        yield_amount: meal.yield_amount || 1,
      };

      try {
        await addDoc(collection(db, 'meals'), mealData);
        router.back();
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
              <Text style={styles.resultName}>{result.food_description}</Text>
              <Text style={styles.resultMacros}>
                Protein: {result.nf_protein}g, Fats: {result.nf_total_fat}g, Carbs: {result.nf_total_carbohydrate}g, Calories: {result.nf_calories}kcal
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
    width: '100%',
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
