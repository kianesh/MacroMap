import axios from 'axios';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { Button, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

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
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [nutritionInfo, setNutritionInfo] = useState<NutritionInfo[]>([]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location.coords);

      fetchNearbyRestaurants(location.coords);
    })();
  }, []);

  const fetchNearbyRestaurants = async (coords: LocationCoords) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coords.latitude},${coords.longitude}&radius=1500&type=restaurant&key=${GOOGLE_MAPS_API_KEY}`
      );
      const places = response.data.results;
      setRestaurants(places);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchNutritionInfo = async (restaurantName: string) => {
    try {
      const response = await axios.get(
        `https://trackapi.nutritionix.com/v2/search/instant?query=${restaurantName} restaurant`,
        {
          headers: {
            'x-app-id': NUTRITIONIX_APP_ID,
            'x-app-key': NUTRITIONIX_API_KEY,
          },
        }
      );
      setNutritionInfo(response.data.common);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = async () => {
    if (location && query) {
      try {
        const response = await axios.get(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&location=${location.latitude},${location.longitude}&radius=1500&type=restaurant&key=${GOOGLE_MAPS_API_KEY}`
        );
        const places = response.data.results;
        setRestaurants(places);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleMarkerPress = async (restaurantName: string) => {
    setSelectedRestaurant(restaurantName);
    await fetchNutritionInfo(restaurantName);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search for restaurants"
        value={query}
        onChangeText={setQuery}
      />
      <Button title="Search" onPress={handleSearch} />
      {location && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="Your Location"
            pinColor="blue"
          />
          <Circle
            center={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            radius={1500}
            strokeColor="rgba(0, 0, 255, 0.5)"
            fillColor="rgba(0, 0, 255, 0.1)"
          />
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
      {selectedRestaurant && (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>{selectedRestaurant}</Text>
          <ScrollView>
            {nutritionInfo.map((item, index) => (
              <View key={index} style={styles.nutritionItem}>
                <Text style={styles.nutritionText}>Food: {item.food_name}</Text>
                <Text style={styles.nutritionText}>Serving: {item.serving_qty} {item.serving_unit}</Text>
                <Text style={styles.nutritionText}>Calories: {item.nf_calories}</Text>
                <Text style={styles.nutritionText}>Fat: {item.nf_total_fat}g</Text>
                <Text style={styles.nutritionText}>Protein: {item.nf_protein}g</Text>
                <Text style={styles.nutritionText}>Carbs: {item.nf_total_carbohydrate}g</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedRestaurant(null)}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  searchInput: {
    position: 'absolute',
    top: 10,
    width: '90%',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    zIndex: 1,
    alignSelf: 'center',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: '#fff',
    padding: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  nutritionItem: {
    marginBottom: 10,
  },
  nutritionText: {
    fontSize: 16,
  },
  closeButton: {
    marginTop: 10,
    backgroundColor: '#6200ee',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});