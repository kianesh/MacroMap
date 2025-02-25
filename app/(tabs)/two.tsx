import axios from 'axios';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const GOOGLE_MAPS_API_KEY = 'AIzaSyCKtCGcYIWy2tGlvN8E2MADnEj1bxJ3Hp8';
const NUTRITIONIX_API_KEY = 'fd960d561e6cbf69af473581dcf31b1f';
const NUTRITIONIX_APP_ID = '2669dd01';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface Restaurant {
  place_id: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  name: string;
  vicinity: string;
}

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

export default function MapScreen() {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [query, setQuery] = useState<string>('');
  const [popupData, setPopupData] = useState<NutritionInfo[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [loaded, error] = useFonts({
    'AfacadFlux': require('../../assets/fonts/AfacadFlux-VariableFont_slnt,wght.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location.coords);
    })();
  }, [loaded, error]);

  const fetchNearbyRestaurants = async (query: string) => {
    if (!location) return;
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&location=${location.latitude},${location.longitude}&radius=1500&key=${GOOGLE_MAPS_API_KEY}`
      );
      setRestaurants(response.data.results);
    } catch (error) {
      console.error('Error fetching nearby restaurants:', error);
    }
  };

  const fetchMenuItems = async (restaurantName: string) => {
    try {
      const response = await axios.get(
        `https://trackapi.nutritionix.com/v2/search/instant?query=${restaurantName}`,
        {
          headers: {
            'x-app-id': NUTRITIONIX_APP_ID,
            'x-app-key': NUTRITIONIX_API_KEY,
          },
        }
      );
      setPopupData(response.data.branded || []);
    } catch (error) {
      console.error('Error fetching menu items:', error);
    }
  };

  const handleSearch = async () => {
    if (!query) return;
    await fetchNearbyRestaurants(query);
    await fetchMenuItems(query);
  };

  const handleMarkerPress = async (restaurantName: string) => {
    setSelectedRestaurant(restaurantName);
    await fetchMenuItems(restaurantName);
  };

  const handleMapPress = () => {
    setSelectedRestaurant(null);
    setPopupData([]);
  };

  const renderPopup = () => (
    <View style={styles.popup}>
      <ScrollView>
        {popupData.map((item, index) => (
          <View key={index} style={styles.menuItem}>
            <Text style={styles.menuText}>Food: {item.food_name}</Text>
            <Text style={styles.menuText}>Calories: {item.nf_calories}</Text>
            <Text style={styles.menuText}>
              Protein: {item.nf_protein}g, Fats: {item.nf_total_fat}g, Carbs: {item.nf_total_carbohydrate}g
            </Text>
            <TouchableOpacity style={styles.addButton}>
              <Text style={styles.addButtonText}>Add to Log</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  if (!loaded) {
    return null; // or a loading spinner
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search for restaurants or food items"
        value={query}
        onChangeText={setQuery}
      />
      <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
        <Text style={styles.searchButtonText}>Search</Text>
      </TouchableOpacity>
      {location && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          onPress={handleMapPress}
        >
          {restaurants.map((restaurant) => (
            <Marker
              key={restaurant.place_id}
              coordinate={{
                latitude: restaurant.geometry.location.lat,
                longitude: restaurant.geometry.location.lng,
              }}
              title={restaurant.name}
              description={restaurant.vicinity}
              onPress={() => handleMarkerPress(restaurant.name)}
            />
          ))}
        </MapView>
      )}
      {popupData.length > 0 && renderPopup()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    fontFamily: 'AfacadFlux',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  searchInput: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 1,
    backgroundColor: 'white',
    borderRadius: 5,
    padding: 10,
    fontFamily: 'AfacadFlux',
  },
  searchButton: {
    position: 'absolute',
    top: 60,
    left: 10,
    right: 10,
    zIndex: 1,
    backgroundColor: '#31256C',
    borderRadius: 5,
    padding: 10,
    alignItems: 'center',
    fontFamily: 'AfacadFlux',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontFamily: 'AfacadFlux',
  },
  popup: {
    position: 'absolute',
    left: 10,
    top: 120,
    bottom: 10,
    width: '40%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    zIndex: 1,
    fontFamily: 'AfacadFlux',
  },
  menuItem: {
    marginBottom: 10,
  },
  menuText: {
    fontSize: 14,
    marginBottom: 5,
    fontFamily: 'AfacadFlux',
  },
  addButton: {
    backgroundColor: '#31256C',
    borderRadius: 5,
    padding: 5,
    alignItems: 'center',
    fontFamily: 'AfacadFlux',
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontFamily: 'AfacadFlux',
  },
});