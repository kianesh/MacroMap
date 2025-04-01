import { auth, db } from '@/FirebaseConfig';
import {
  FATSECRET_CLIENT_KEY,
  FATSECRET_CLIENT_SECRET,
} from '@env';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { addDoc, collection, getDocs, limit, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const FATSECRET_API_URL = 'https://platform.fatsecret.com/rest/server.api';

SplashScreen.preventAutoHideAsync();

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

export default function MealSearchScreen() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [results, setResults] = useState<NutritionInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();
  const [loaded, error] = useFonts({
    'AfacadFlux': require('../assets/fonts/AfacadFlux-VariableFont_slnt,wght.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  const generateOAuthSignature = (method: string, url: string, params: any) => {
    const oauthParams = {
      oauth_consumer_key: FATSECRET_CLIENT_KEY,
      oauth_nonce: Math.random().toString(36).substring(2),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0'
    };

    const allParams = { ...params, ...oauthParams };
    const paramString = Object.keys(allParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
      .join('&');

    const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(FATSECRET_CLIENT_SECRET)}&`;
    const signature = CryptoJS.HmacSHA1(baseString, signingKey).toString(CryptoJS.enc.Base64);

    return {
      ...oauthParams,
      oauth_signature: signature
    };
  };

  const searchFoods = async () => {
    if (!searchQuery.trim()) {
      alert('Please enter a search term');
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Check Firestore for cached food IDs
      const foodsRef = collection(db, 'foods');
      const q = query(
        foodsRef,
        where('name', '>=', searchQuery.toLowerCase()),
        where('name', '<=', searchQuery.toLowerCase() + '\uf8ff'),
        limit(50) // im gonna write a
      );

      const snapshot = await getDocs(q);
      const cachedResults = snapshot.docs.map(doc => ({
        food_id: doc.data().food_id,
        timestamp: doc.data().timestamp.toDate(),
      }));

      // Filter out expired cache entries (older than 24 hours)
      const validCache = cachedResults.filter(
        item => Date.now() - item.timestamp.getTime() < 24 * 60 * 60 * 1000
      );

      if (validCache.length > 0) {
        // Step 2: Fetch fresh details for cached food IDs
        const foodDetails = await Promise.all(
          validCache.map(async (item) => {
            const detailParams = {
              method: 'food.get.v4',
              food_id: item.food_id,
              format: 'json',
            };

            const detailHeaders = generateOAuthSignature('GET', FATSECRET_API_URL, detailParams);
            const detailResponse = await axios.get(FATSECRET_API_URL, {
              params: {
                ...detailParams,
                ...detailHeaders
              }
            });

            const food = detailResponse.data.food;
            const servings = food.servings.serving;
            const firstServing = Array.isArray(servings) ? servings[0] : servings;

            return {
              food_name: food.food_name || 'Unnamed Food',
              brand_name: food.brand_name || '',
              serving_qty: Number(firstServing.number_of_units) || 1,
              serving_unit: firstServing.measurement_description || 'serving',
              nf_calories: Number(firstServing.calories) || 0,
              nf_protein: Number(firstServing.protein) || 0,
              nf_total_fat: Number(firstServing.fat) || 0,
              nf_total_carbohydrate: Number(firstServing.carbohydrate) || 0,
              image_url: food.food_images?.food_image?.[0]?.image_url || null,
            };
          })
        );

        setResults(foodDetails);
        return;
      }

      // Step 3: If no valid cache, perform a fresh search
      const searchParams = {
        method: 'foods.search.v4',
        search_expression: searchQuery,
        format: 'json',
        max_results: '50',
      };

      const searchHeaders = generateOAuthSignature('GET', FATSECRET_API_URL, searchParams);
      const searchResponse = await axios.get(FATSECRET_API_URL, {
        params: {
          ...searchParams,
          ...searchHeaders
        }
      });

      const foods = searchResponse.data?.foods?.food || [];
      const foodIds = Array.isArray(foods)
        ? foods.map(item => item.food_id)
        : [foods.food_id];

      // Step 4: Cache new food IDs 
      await Promise.all(
        foodIds.map(async (foodId) => {
          await addDoc(collection(db, 'foods'), {
            food_id: foodId,
            name: searchQuery.toLowerCase(),
            timestamp: new Date(),
          });
        })
      );

      // Step 5: Fetch details for new food IDs
      const foodDetails = await Promise.all(
        foodIds.map(async (foodId) => {
          const detailParams = {
            method: 'food.get.v4',
            food_id: foodId,
            format: 'json',
          };

          const detailHeaders = generateOAuthSignature('GET', FATSECRET_API_URL, detailParams);
          const detailResponse = await axios.get(FATSECRET_API_URL, {
            params: {
              ...detailParams,
              ...detailHeaders
            }
          });

          const food = detailResponse.data.food;
          const servings = food.servings.serving;
          const firstServing = Array.isArray(servings) ? servings[0] : servings;

          return {
            food_name: food.food_name || 'Unnamed Food',
            brand_name: food.brand_name || '',
            serving_qty: Number(firstServing.number_of_units) || 1,
            serving_unit: firstServing.measurement_description || 'serving',
            nf_calories: Number(firstServing.calories) || 0,
            nf_protein: Number(firstServing.protein) || 0,
            nf_total_fat: Number(firstServing.fat) || 0,
            nf_total_carbohydrate: Number(firstServing.carbohydrate) || 0,
            image_url: food.food_images?.food_image?.[0]?.image_url || null,
          };
        })
      );

      setResults(foodDetails);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error searching foods:', error.response?.data || error.message);
      } else {
        console.error('Error searching foods:', error);
      }
      alert('Failed to search for foods. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const logMeal = async (meal: NutritionInfo) => {
    const user = auth.currentUser;
    if (!user) {
      alert('Please sign in to log meals');
      return;
    }

    try {
      await addDoc(collection(db, 'meals'), {
        userId: user.uid,
        name: meal.food_name,
        brand_name: meal.brand_name || 'N/A',
        protein: Number(meal.nf_protein) || 0,
        fats: Number(meal.nf_total_fat) || 0,
        carbs: Number(meal.nf_total_carbohydrate) || 0,
        calories: Number(meal.nf_calories) || 0,
        timestamp: new Date(),
      });
      router.push('/(tabs)');
    } catch (error) {
      console.error('Error logging meal:', error);
      alert('Failed to log meal. Please try again.');
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Error opening link:', err));
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search for meals"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <TouchableOpacity
        style={[styles.searchButton, isLoading && styles.disabledButton]}
        onPress={searchFoods}
        disabled={isLoading}
      >
        <Text style={styles.searchButtonText}>
          {isLoading ? 'Searching...' : 'Search'}
        </Text>
      </TouchableOpacity>

      <ScrollView>
        {results.length > 0 ? (
          results.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              {result.image_url ? (
                <Image
                  source={{ uri: result.image_url }}
                  style={styles.foodImage}
                  resizeMode="cover"
                  onError={() => console.log('Error loading image')}
                />
              ) : (
                <View style={[styles.foodImage, styles.placeholderImage]}>
                  <Text style={styles.placeholderText}>No Image</Text>
                </View>
              )}
              <View style={styles.resultContent}>
                <Text style={styles.resultName}>{result.food_name}</Text>
                <Text style={styles.resultBrand}>{result.brand_name}</Text>
                <Text style={styles.resultMacros}>
                  Serving: {result.serving_qty} {result.serving_unit}
                </Text>
                <Text style={styles.resultMacros}>
                  Calories: {result.nf_calories} kcal
                </Text>
                <Text style={styles.resultMacros}>
                  Protein: {result.nf_protein}g • Fat: {result.nf_total_fat}g • Carbs: {result.nf_total_carbohydrate}g
                </Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.logButton}
                    onPress={() => logMeal(result)}
                  >
                    <Text style={styles.logButtonText}>Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.linkButton, !result.brand_name && styles.disabledButton]}
                    onPress={() => result.brand_name && openLink(`https://www.ubereats.com/search?q=${result.brand_name}`)}
                    disabled={!result.brand_name}
                  >
                    <Text style={styles.linkButtonText}>Uber Eats</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.linkButton, !result.brand_name && styles.disabledButton]}
                    onPress={() => result.brand_name && openLink(`https://www.doordash.com/search/store/${result.brand_name}`)}
                    disabled={!result.brand_name}
                  >
                    <Text style={styles.linkButtonText}>DoorDash</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noResultsText}>
            {isLoading ? 'Loading...' : 'No results found.'}
          </Text>
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
    fontFamily: 'AfacadFlux',
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
    fontFamily: 'AfacadFlux',
  },
  searchButton: {
    backgroundColor: '#31256C',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 20,
    fontFamily: 'AfacadFlux',
  },
  disabledButton: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'AfacadFlux',
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
    flexDirection: 'row',
  },
  foodImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
  },
  resultContent: {
    flex: 1,
  },
  resultName: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'AfacadFlux',
  },
  resultBrand: {
    fontSize: 16,
    color: '#888',
    fontFamily: 'AfacadFlux',
  },
  resultMacros: {
    fontSize: 16,
    marginVertical: 5,
    fontFamily: 'AfacadFlux',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  logButton: {
    backgroundColor: '#31256C',
    padding: 10,
    borderRadius: 15,
    alignItems: 'center',
    fontFamily: 'AfacadFlux',
  },
  logButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'AfacadFlux',
  },
  linkButton: {
    backgroundColor: '#31256C',
    padding: 10,
    borderRadius: 15,
    alignItems: 'center',
    fontFamily: 'AfacadFlux',
  },
  linkButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'AfacadFlux',
  },
  noResultsText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
    fontFamily: 'AfacadFlux',
  },
  placeholderImage: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    fontSize: 12,
  },
});