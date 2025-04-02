import axios from 'axios';
import CryptoJS from 'crypto-js';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const FATSECRET_API_URL = 'https://platform.fatsecret.com/rest/server.api';
const FATSECRET_CLIENT_KEY = '2e3df77a4d7a4481a05a9d79152e64ad';
const FATSECRET_CLIENT_SECRET = '8591547e4ea24556a46a8005398fb5ba';

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

export default function NLPPage() {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<NutritionInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const generateOAuthSignature = (method: string, url: string, params: any) => {
    const oauthParams = {
      oauth_consumer_key: FATSECRET_CLIENT_KEY,
      oauth_nonce: Math.random().toString(36).substring(2),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0',
    };

    const allParams = { ...params, ...oauthParams };
    const paramString = Object.keys(allParams)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
      .join('&');

    const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(
      paramString
    )}`;
    const signingKey = `${encodeURIComponent(FATSECRET_CLIENT_SECRET)}&`;
    const signature = CryptoJS.HmacSHA1(baseString, signingKey).toString(CryptoJS.enc.Base64);

    return {
      ...oauthParams,
      oauth_signature: signature,
    };
  };

  const searchFoods = async () => {
    if (!query.trim()) {
      Alert.alert('Error', 'Please enter a search term.');
      return;
    }

    setIsLoading(true);
    try {
      const method = 'POST';
      const params = {
        method: 'foods.search.natural',
        search_expression: query,
        format: 'json',
      };

      const oauthHeaders = generateOAuthSignature(method, FATSECRET_API_URL, params);

      const response = await axios.post(FATSECRET_API_URL, null, {
        params: {
          ...params,
          ...oauthHeaders,
        },
      });

      if (response.data.foods?.food) {
        const foods = Array.isArray(response.data.foods.food)
          ? response.data.foods.food
          : [response.data.foods.food];

        const foodDetails = foods.map((food: any) => ({
          food_name: food.food_name || 'Unknown Food',
          brand_name: food.brand_name || '',
          serving_qty: food.serving_qty || 1,
          serving_unit: food.serving_unit || 'serving',
          nf_calories: food.nf_calories || 0,
          nf_protein: food.nf_protein || 0,
          nf_total_fat: food.nf_total_fat || 0,
          nf_total_carbohydrate: food.nf_total_carbohydrate || 0,
          image_url: food.food_images?.food_image?.[0]?.image_url || null,
        }));

        setResults(foodDetails);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Error searching foods:', error);
      Alert.alert('Error', 'Failed to search for foods. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Natural Language Food Search</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter a food description (e.g., 2 eggs and toast)"
        value={query}
        onChangeText={setQuery}
      />
      <TouchableOpacity style={styles.searchButton} onPress={searchFoods} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.searchButtonText}>Search</Text>
        )}
      </TouchableOpacity>
      <FlatList
        data={results}
        keyExtractor={(item, index) => `${item.food_name}-${index}`}
        renderItem={({ item }) => (
          <View style={styles.resultItem}>
            <Text style={styles.resultName}>{item.food_name}</Text>
            {item.brand_name ? <Text style={styles.resultBrand}>{item.brand_name}</Text> : null}
            <Text style={styles.resultMacros}>
              {item.serving_qty} {item.serving_unit} - {item.nf_calories} kcal
            </Text>
            <Text style={styles.resultMacros}>
              Protein: {item.nf_protein}g | Carbs: {item.nf_total_carbohydrate}g | Fat: {item.nf_total_fat}g
            </Text>
          </View>
        )}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.noResultsText}>No results found.</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FAFAFA',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#31256C',
    textAlign: 'center',
  },
  input: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EAF6',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#31256C',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultItem: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resultName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  resultBrand: {
    fontSize: 14,
    color: '#888',
    marginBottom: 5,
  },
  resultMacros: {
    fontSize: 14,
    color: '#555',
  },
  noResultsText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
});