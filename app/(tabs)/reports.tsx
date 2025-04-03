import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { auth, db } from '../../FirebaseConfig';

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
  const [weightTimeRange, setWeightTimeRange] = useState<'30days' | '90days' | '6months' | 'all'>('30days');
  const [macroTimeRange, setMacroTimeRange] = useState<'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'>('thisWeek');
  const [loaded] = useFonts({
    'AfacadFlux': require('../../assets/fonts/AfacadFlux-VariableFont_slnt,wght.ttf'),
  });

  useEffect(() => {
    fetchData();
  }, [timeRange, weightTimeRange, macroTimeRange]);

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

  // Filter weight data based on selected time range
  const filterWeightData = (data: WeightData[]) => {
    const now = new Date();
    let cutoffDate = new Date();
    
    switch (weightTimeRange) {
      case '30days':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '90days':
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case '6months':
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case 'all':
        cutoffDate = new Date(0); // Beginning of time
        break;
    }
    
    return data.filter(item => item.date > cutoffDate);
  };

  // Filter macro data based on selected time range
  const filterMacroData = (data: MacroData[]) => {
    const now = new Date();
    let startOfPeriod = new Date();
    let endOfPeriod = new Date();
    
    switch (macroTimeRange) {
      case 'thisWeek':
        // Start of current week (Sunday)
        startOfPeriod.setDate(now.getDate() - now.getDay());
        startOfPeriod.setHours(0, 0, 0, 0);
        endOfPeriod = now;
        break;
      case 'lastWeek':
        // Start of last week (Sunday)
        startOfPeriod.setDate(now.getDate() - now.getDay() - 7);
        startOfPeriod.setHours(0, 0, 0, 0);
        // End of last week (Saturday)
        endOfPeriod = new Date(startOfPeriod);
        endOfPeriod.setDate(startOfPeriod.getDate() + 6);
        endOfPeriod.setHours(23, 59, 59, 999);
        break;
      case 'thisMonth':
        // Start of current month
        startOfPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
        endOfPeriod = now;
        break;
      case 'lastMonth':
        // Start of last month
        startOfPeriod = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        // End of last month
        endOfPeriod = new Date(now.getFullYear(), now.getMonth(), 0);
        endOfPeriod.setHours(23, 59, 59, 999);
        break;
    }
    
    return data.filter(item => item.date >= startOfPeriod && item.date <= endOfPeriod);
  };

  const filteredWeightData = filterWeightData(weightData);
  const filteredMacroData = filterMacroData(macroData);

  // Format date labels based on time range for weight chart
  const formatWeightDate = (date: Date) => {
    switch (weightTimeRange) {
      case '30days':
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      case '90days':
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      case '6months':
        return date.toLocaleDateString('en-US', { month: 'short' });
      case 'all':
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      default:
        return date.toLocaleDateString();
    }
  };

  // Format date labels based on time range for macro chart
  const formatMacroDate = (date: Date) => {
    switch (macroTimeRange) {
      case 'thisWeek':
      case 'lastWeek':
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      case 'thisMonth':
      case 'lastMonth':
        return date.toLocaleDateString('en-US', { day: 'numeric' });
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
        <View style={styles.timeRangeButtons}>
          <TouchableOpacity 
            style={[styles.timeButton, weightTimeRange === '30days' && styles.activeTimeButton]}
            onPress={() => setWeightTimeRange('30days')}
          >
            <Text style={[styles.timeButtonText, weightTimeRange === '30days' && styles.activeTimeButtonText]}>30 Days</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.timeButton, weightTimeRange === '90days' && styles.activeTimeButton]}
            onPress={() => setWeightTimeRange('90days')}
          >
            <Text style={[styles.timeButtonText, weightTimeRange === '90days' && styles.activeTimeButtonText]}>90 Days</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.timeButton, weightTimeRange === '6months' && styles.activeTimeButton]}
            onPress={() => setWeightTimeRange('6months')}
          >
            <Text style={[styles.timeButtonText, weightTimeRange === '6months' && styles.activeTimeButtonText]}>6 Months</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.timeButton, weightTimeRange === 'all' && styles.activeTimeButton]}
            onPress={() => setWeightTimeRange('all')}
          >
            <Text style={[styles.timeButtonText, weightTimeRange === 'all' && styles.activeTimeButtonText]}>All Time</Text>
          </TouchableOpacity>
        </View>
        
        {filteredWeightData.length > 0 ? (
          <LineChart
            data={{
              labels: filteredWeightData.map(d => formatWeightDate(d.date)),
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
        <View style={styles.timeRangeButtons}>
          <TouchableOpacity 
            style={[styles.timeButton, macroTimeRange === 'thisWeek' && styles.activeTimeButton]}
            onPress={() => setMacroTimeRange('thisWeek')}
          >
            <Text style={[styles.timeButtonText, macroTimeRange === 'thisWeek' && styles.activeTimeButtonText]}>This Week</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.timeButton, macroTimeRange === 'lastWeek' && styles.activeTimeButton]}
            onPress={() => setMacroTimeRange('lastWeek')}
          >
            <Text style={[styles.timeButtonText, macroTimeRange === 'lastWeek' && styles.activeTimeButtonText]}>Last Week</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.timeButton, macroTimeRange === 'thisMonth' && styles.activeTimeButton]}
            onPress={() => setMacroTimeRange('thisMonth')}
          >
            <Text style={[styles.timeButtonText, macroTimeRange === 'thisMonth' && styles.activeTimeButtonText]}>This Month</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.timeButton, macroTimeRange === 'lastMonth' && styles.activeTimeButton]}
            onPress={() => setMacroTimeRange('lastMonth')}
          >
            <Text style={[styles.timeButtonText, macroTimeRange === 'lastMonth' && styles.activeTimeButtonText]}>Last Month</Text>
          </TouchableOpacity>
        </View>
        
        {filteredMacroData.length > 0 ? (
          <LineChart
            data={{
              labels: filteredMacroData.map(d => formatMacroDate(d.date)),
              datasets: [
                {
                  data: filteredMacroData.map(d => Math.min((d.calories / d.calorieGoal) * 100, 150)),
                  color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`, // Red for calories
                  strokeWidth: 2,
                },
                {
                  data: filteredMacroData.map(d => Math.min((d.protein / d.proteinGoal) * 100, 150)),
                  color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`, // Blue for protein
                  strokeWidth: 2,
                },
                {
                  data: filteredMacroData.map(d => Math.min((d.carbs / d.carbsGoal) * 100, 150)),
                  color: (opacity = 1) => `rgba(255, 206, 86, ${opacity})`, // Yellow for carbs
                  strokeWidth: 2,
                },
                {
                  data: filteredMacroData.map(d => Math.min((d.fats / d.fatsGoal) * 100, 150)),
                  color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})`, // Green for fats
                  strokeWidth: 2,
                },
              ],
            }}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              ...chartConfig,
              formatYLabel: value => `${Math.round(Number(value))}%`,
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  timeButton: {
    paddingVertical: 6, // Make smaller
    paddingHorizontal: 8, // Make smaller
    borderRadius: 12,
    marginBottom: 5,
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