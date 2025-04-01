import { auth, db } from '@/FirebaseConfig';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

SplashScreen.preventAutoHideAsync();

interface WeightData {
  weight: number;
  date: Date;
}

interface MacroData {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  date: Date;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatsGoal: number;
}

export default function ReportsScreen() {
  const [weightData, setWeightData] = useState<WeightData[]>([]);
  const [macroData, setMacroData] = useState<MacroData[]>([]);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [loaded] = useFonts({
    'AfacadFlux': require('../../assets/fonts/AfacadFlux-VariableFont_slnt,wght.ttf'),
  });

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // Fetch weight data
      const weightRef = collection(db, 'weights');
      const weightQuery = query(
        weightRef,
        where('userId', '==', user.uid),
        orderBy('date', 'asc')
      );
      const weightSnapshot = await getDocs(weightQuery);
      const weights = weightSnapshot.docs
        .map(doc => ({
          weight: Number(doc.data().weight) || 0,
          date: doc.data().date.toDate(),
        }))
        .filter(data => !isNaN(data.weight)); // Filter out invalid data
      setWeightData(weights);

      // Fetch user data for goals
      const userRef = doc(db, 'users', user.uid);
      const userData = await getDoc(userRef);
      const userGoals = userData.data();

      // Fetch macro data and aggregate by date
      const mealsRef = collection(db, 'meals');
      const mealsQuery = query(
        mealsRef,
        where('userId', '==', user.uid),
        orderBy('timestamp', 'asc')
      );
      const mealsSnapshot = await getDocs(mealsQuery);
      
      // Group meals by date and calculate daily totals
      const mealsByDate = new Map();
      
      mealsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const date = data.timestamp.toDate();
        const dateString = date.toDateString();
        
        if (!mealsByDate.has(dateString)) {
          mealsByDate.set(dateString, {
            calories: 0,
            protein: 0,
            carbs: 0,
            fats: 0,
            date,
            calorieGoal: Number(userGoals?.calorieGoal) || 2000,
            proteinGoal: Number(userGoals?.protein) || 150,
            carbsGoal: Number(userGoals?.carbs) || 200,
            fatsGoal: Number(userGoals?.fats) || 80,
          });
        }

        const dailyTotal = mealsByDate.get(dateString);
        dailyTotal.calories += Number(data.calories) || 0;
        dailyTotal.protein += Number(data.protein) || 0;
        dailyTotal.carbs += Number(data.carbs) || 0;
        dailyTotal.fats += Number(data.fats) || 0;
      });

      const macros = Array.from(mealsByDate.values())
        .filter(data => !isNaN(data.calories) && data.calorieGoal > 0);
      
      setMacroData(macros);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  // Filter data based on selected time range
  const filterDataByTimeRange = (data: any[], timeRange: 'week' | 'month' | 'year') => {
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (timeRange) {
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return data.filter(item => item.date > cutoffDate);
  };

  const filteredWeightData = filterDataByTimeRange(weightData, timeRange);
  const filteredMacroData = filterDataByTimeRange(macroData, timeRange);

  // Format date labels based on time range
  const formatDate = (date: Date) => {
    switch (timeRange) {
      case 'week':
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      case 'month':
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      case 'year':
        return date.toLocaleDateString('en-US', { month: 'short' });
      default:
        return date.toLocaleDateString();
    }
  };

  if (!loaded) return null;

  const screenWidth = Dimensions.get('window').width;

  const chartConfig = {
    backgroundColor: '#FFFFFF',
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(49, 37, 108, ${opacity})`,
    style: {
      borderRadius: 16,
    },
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <View style={styles.timeRangeButtons}>
          <TouchableOpacity 
            style={[styles.timeButton, timeRange === 'week' && styles.activeTimeButton]}
            onPress={() => setTimeRange('week')}
          >
            <Text style={[styles.timeButtonText, timeRange === 'week' && styles.activeTimeButtonText]}>Week</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.timeButton, timeRange === 'month' && styles.activeTimeButton]}
            onPress={() => setTimeRange('month')}
          >
            <Text style={[styles.timeButtonText, timeRange === 'month' && styles.activeTimeButtonText]}>Month</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.timeButton, timeRange === 'year' && styles.activeTimeButton]}
            onPress={() => setTimeRange('year')}
          >
            <Text style={[styles.timeButtonText, timeRange === 'year' && styles.activeTimeButtonText]}>Year</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Weight Progress</Text>
        {filteredWeightData.length > 0 ? (
          <LineChart
            data={{
              labels: filteredWeightData.map(d => formatDate(d.date)),
              datasets: [{
                data: filteredWeightData.map(d => d.weight)
              }]
            }}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        ) : (
          <Text style={styles.noDataText}>No weight data available</Text>
        )}
      </View>

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Macro Goals Progress</Text>
        {filteredMacroData.length > 0 ? (
          <LineChart
            data={{
              labels: filteredMacroData.map(d => formatDate(d.date)),
              datasets: [{
                data: filteredMacroData.map(d => Math.min((d.calories / d.calorieGoal) * 100, 150))
              }]
            }}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              ...chartConfig,
              formatYLabel: (value) => `${Math.round(Number(value))}%`,
            }}
            bezier
            style={styles.chart}
          />
        ) : (
          <Text style={styles.noDataText}>No macro data available</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#31256C',
    fontFamily: 'AfacadFlux',
    marginBottom: 20,
  },
  timeRangeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  activeTimeButton: {
    backgroundColor: '#31256C',
  },
  timeButtonText: {
    color: '#31256C',
    fontFamily: 'AfacadFlux',
  },
  activeTimeButtonText: {
    color: '#FFFFFF',
  },
  chartContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#31256C',
    fontFamily: 'AfacadFlux',
    marginBottom: 10,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noDataText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 20,
    fontFamily: 'AfacadFlux',
  },
});