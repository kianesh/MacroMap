import { FontAwesome } from '@expo/vector-icons';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { addDoc, collection } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../FirebaseConfig';

const FATSECRET_CLIENT_KEY = '2e3df77a4d7a4481a05a9d79152e64ad';
const FATSECRET_CLIENT_SECRET = '8591547e4ea24556a46a8005398fb5ba';
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
  const [query, setQuery] = useState<string>('');
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
    if (!query.trim()) {
      alert('Please enter a search term');
      return;
    }

    setIsLoading(true);
    try {
      const method = 'GET';
      const params = {
        method: 'foods.search',
        search_expression: query,
        format: 'json',
        max_results: 50,
        page_number: 0
      };

      const oauthHeaders = generateOAuthSignature(method, FATSECRET_API_URL, params);

      const response = await axios.get(FATSECRET_API_URL, {
        params: {
          ...params,
          ...oauthHeaders
        }
      });

      console.log('API Response:', response.data);

      if (response.data.foods?.food) {
        const foods = Array.isArray(response.data.foods.food) 
          ? response.data.foods.food 
          : [response.data.foods.food];

        const foodDetails = await Promise.all(
          foods.map(async (food: any) => {
            const detailParams = {
              method: 'food.get.v4',
              food_id: food.food_id,
              format: 'json',
              include_food_images: true,
            };

            const detailHeaders = generateOAuthSignature(method, FATSECRET_API_URL, detailParams);
            const detailResponse = await axios.get(FATSECRET_API_URL, {
              params: {
                ...detailParams,
                ...detailHeaders
              }
            });

            console.log('Detail Response:', detailResponse.data);

            const foodDetail = detailResponse.data.food;
            const primaryServing = Array.isArray(foodDetail.servings.serving) 
              ? foodDetail.servings.serving[0] 
              : foodDetail.servings.serving;

            // Updated image URL handling
            const imageUrl = foodDetail.images?.image?.[0]?.image_url || 
                            foodDetail.food_images?.food_image?.[0]?.image_url || 
                            null;

            return {
              food_name: foodDetail.food_name || 'Unknown Food',
              brand_name: foodDetail.brand_name || '',
              serving_qty: parseFloat(primaryServing.number_of_units) || 1,
              serving_unit: primaryServing.measurement_description || 'serving',
              nf_calories: parseFloat(primaryServing.calories) || 0,
              nf_protein: parseFloat(primaryServing.protein) || 0,
              nf_total_fat: parseFloat(primaryServing.fat) || 0,
              nf_total_carbohydrate: parseFloat(primaryServing.carbohydrate) || 0,
              image_url: imageUrl,
            };
          })
        );

        setResults(foodDetails);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Error searching foods:', error);
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
        value={query}
        onChangeText={setQuery}
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
            <TouchableOpacity 
              key={index} 
              style={styles.resultItem}
              onPress={() => router.push(`/AdjustServingScreen?meal=${JSON.stringify(result)}`)}
            >
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
              </View>
              <View style={styles.chevronContainer}>
                <FontAwesome name="chevron-right" size={20} color="#31256C" />
              </View>
            </TouchableOpacity>
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
  chevronContainer: {
    justifyContent: 'center',
    paddingLeft: 10,
  },
});