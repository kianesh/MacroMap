import { FontAwesome } from '@expo/vector-icons';
import axios from 'axios';
import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { FATSECRET_CLIENT_KEY, FATSECRET_CLIENT_SECRET } from 'react-native-dotenv';

SplashScreen.preventAutoHideAsync();

const NLP_ENDPOINT = 'https://platform.fatsecret.com/rest/natural-language-processing/v1';
const TOKEN_ENDPOINT = 'https://oauth.fatsecret.com/connect/token';

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

export default function NLPScreen() {
  const [nlpQuery, setNlpQuery] = useState<string>('');
  const [results, setResults] = useState<NutritionInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([
    "chicken breast with rice and vegetables",
    "medium apple with peanut butter",
    "grilled salmon with asparagus",
    "protein smoothie with banana and milk",
  ]);

  const router = useRouter();

  const [loaded] = useFonts({
    'AfacadFlux': require('../assets/fonts/AfacadFlux-VariableFont_slnt,wght.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  const getAccessToken = async (): Promise<string> => {
    const response = await axios.post(
      TOKEN_ENDPOINT,
      new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'basic',
      }),
      {
        auth: {
          username: FATSECRET_CLIENT_KEY,
          password: FATSECRET_CLIENT_SECRET,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.access_token;
  };

  const processNaturalLanguageQuery = async (query: string) => {
    if (!query.trim()) {
      alert('Please enter a description of your meal');
      return;
    }

    if (!recentQueries.includes(query)) {
      const updatedQueries = [query, ...recentQueries.slice(0, 3)];
      setRecentQueries(updatedQueries);
    }

    setIsLoading(true);
    setResults([]);

    try {
      const token = await getAccessToken();

      const response = await axios.post(
        NLP_ENDPOINT,
        { meal_description: query },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const items = response.data.foods || [];

      const parsedResults: NutritionInfo[] = items.map((item: any) => ({
        food_name: item.food_name || 'Unknown',
        serving_qty: item.serving_quantity || 1,
        serving_unit: item.serving_unit || 'serving',
        nf_calories: item.calories || 0,
        nf_protein: item.protein || 0,
        nf_total_fat: item.fat || 0,
        nf_total_carbohydrate: item.carbohydrate || 0,
        brand_name: item.brand_name || '',
      }));

      setResults(parsedResults);
    } catch (error) {
      console.error('Error during NLP request:', error);
      alert('Failed to process your food description. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecentQueryPress = (query: string) => {
    setNlpQuery(query);
    processNaturalLanguageQuery(query);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Describe Your Meal</Text>
      <Text style={styles.subtitle}>
        Enter what you ate in plain language and we'll analyze it
      </Text>

      <TextInput
        style={styles.nlpInput}
        placeholder="e.g., Chicken breast with rice and vegetables"
        value={nlpQuery}
        onChangeText={setNlpQuery}
        multiline
      />

      <TouchableOpacity
        style={[styles.searchButton, isLoading && styles.disabledButton]}
        onPress={() => processNaturalLanguageQuery(nlpQuery)}
        disabled={isLoading}
      >
        <Text style={styles.searchButtonText}>Analyze</Text>
      </TouchableOpacity>

      {recentQueries.length > 0 && (
        <View style={styles.recentQueriesContainer}>
          <Text style={styles.recentQueriesTitle}>Recent</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recentQueries.map((query, index) => (
              <TouchableOpacity
                key={index}
                style={styles.recentQueryChip}
                onPress={() => handleRecentQueryPress(query)}
              >
                <Text style={styles.recentQueryText} numberOfLines={1}>{query}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView style={styles.resultsContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#31256C" />
            <Text style={styles.loadingText}>Analyzing your meal...</Text>
          </View>
        ) : results.length > 0 ? (
          <>
            <Text style={styles.resultsTitle}>Foods Found</Text>
            {results.map((item, index) => (
              <View key={index} style={styles.resultItem}>
                <FontAwesome name="cutlery" size={24} color="#31256C" style={{ marginRight: 10 }} />
                <View style={styles.resultContent}>
                  <Text style={styles.resultName}>{item.food_name}</Text>
                  <Text style={styles.resultMacros}>
                    {item.serving_qty} {item.serving_unit} — {item.nf_calories} kcal
                  </Text>
                  <Text style={styles.resultMacros}>
                    P: {item.nf_protein}g • F: {item.nf_total_fat}g • C: {item.nf_total_carbohydrate}g
                  </Text>
                </View>
              </View>
            ))}
          </>
        ) : nlpQuery && !isLoading ? (
          <View style={styles.emptyResultsContainer}>
            <FontAwesome name="search" size={50} color="#ccc" />
            <Text style={styles.noResultsText}>No foods found</Text>
            <Text style={styles.noResultsSubtext}>Try simplifying your description</Text>
          </View>
        ) : null}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#31256C',
    marginBottom: 8,
    fontFamily: 'AfacadFlux',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    fontFamily: 'AfacadFlux',
  },
  nlpInput: {
    height: 100,
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EAF6',
    borderWidth: 2,
    borderRadius: 15,
    padding: 15,
    fontSize: 16,
    color: '#3C4858',
    textAlignVertical: 'top',
    fontFamily: 'AfacadFlux',
    marginBottom: 15,
  },
  searchButton: {
    backgroundColor: '#31256C',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 20,
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
  recentQueriesContainer: {
    marginBottom: 20,
  },
  recentQueriesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#31256C',
    marginBottom: 10,
    fontFamily: 'AfacadFlux',
  },
  recentQueryChip: {
    backgroundColor: '#E8EAF6',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
    marginBottom: 10,
  },
  recentQueryText: {
    color: '#31256C',
    fontFamily: 'AfacadFlux',
    maxWidth: 150,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#31256C',
    fontFamily: 'AfacadFlux',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#31256C',
    marginBottom: 15,
    fontFamily: 'AfacadFlux',
  },
  resultItem: {
    flexDirection: 'row',
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resultContent: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'AfacadFlux',
  },
  resultMacros: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
    fontFamily: 'AfacadFlux',
  },
  emptyResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
    marginBottom: 8,
    fontFamily: 'AfacadFlux',
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    fontFamily: 'AfacadFlux',
  },
});
