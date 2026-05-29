import { FontAwesome } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';

SplashScreen.preventAutoHideAsync();

// ---- Types mirroring the ML API response shape ----
type Metric = 'calories' | 'protein' | 'carbs' | 'fats' | 'weight';

interface HistoricalPoint { date: string; value: number; }
interface ForecastPoint { date: string; value: number; lower: number; upper: number; }
interface AnomalyPoint { date: string; value: number; z_score: number; }
interface Summary { trend: 'up' | 'down' | 'flat'; weekly_avg: number; vs_goal: number; }
interface ForecastResponse {
  status: 'ok' | 'insufficient_data';
  metric: Metric;
  message?: string;
  model?: string;
  historical: HistoricalPoint[];
  forecast: ForecastPoint[];
  anomalies: AnomalyPoint[];
  summary?: Summary;
}

const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fats', label: 'Fats', unit: 'g' },
  { key: 'weight', label: 'Weight', unit: '' },
];

const PRIMARY = '#31256C';
const screenWidth = Dimensions.get('window').width;

export default function TrendsScreen() {
  const [metric, setMetric] = useState<Metric>('calories');
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [loaded] = useFonts({
    'AfacadFlux': require('../../assets/fonts/AfacadFlux-VariableFont_slnt,wght.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  const fetchForecast = useCallback(async (selected: Metric) => {
    setIsLoading(true);
    setError(null);
    try {
      const functions = getFunctions();
      const forecastNutrition = httpsCallable(functions, 'forecastNutrition');
      const result = await forecastNutrition({ metric: selected });
      setData(result.data as ForecastResponse);
    } catch (err) {
      console.error('Error fetching forecast:', err);
      setError('Could not load trends. Please try again.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecast(metric);
  }, [metric, fetchForecast]);

  if (!loaded) return null;

  const unit = METRICS.find((m) => m.key === metric)?.unit ?? '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Trends & Forecast</Text>

      {/* Metric selector chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        {METRICS.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.chip, metric === m.key && styles.chipActive]}
            onPress={() => setMetric(m.key)}
          >
            <Text
              style={[styles.chipText, metric === m.key && styles.chipTextActive]}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <View style={styles.card}>
          <FontAwesome name="exclamation-circle" size={28} color="#B00020" />
          <Text style={styles.messageText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchForecast(metric)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : data?.status === 'insufficient_data' ? (
        <View style={styles.card}>
          <FontAwesome name="line-chart" size={32} color={PRIMARY} />
          <Text style={styles.messageTitle}>Not enough data yet</Text>
          <Text style={styles.messageText}>{data.message}</Text>
        </View>
      ) : data ? (
        <>
          <KpiRow data={data} unit={unit} />
          <TrendChart data={data} unit={unit} />
          <Legend modelName={data.model} />
        </>
      ) : null}
    </ScrollView>
  );
}

// ---- KPI cards ----
function KpiRow({ data, unit }: { data: ForecastResponse; unit: string }) {
  const forecastSum = data.forecast.reduce((acc, p) => acc + p.value, 0);
  const isWeight = data.metric === 'weight';
  // For weight, "next 7 days" is better expressed as the projected end value.
  const nextLabel = isWeight ? 'Projected (7d)' : 'Next 7 days';
  const nextValue = isWeight
    ? (data.forecast.length ? data.forecast[data.forecast.length - 1].value : 0)
    : forecastSum;

  const vsGoal = data.summary?.vs_goal ?? 0;
  const trend = data.summary?.trend ?? 'flat';

  const trendIcon =
    trend === 'up' ? 'arrow-up' : trend === 'down' ? 'arrow-down' : 'arrows-h';
  const trendColor =
    trend === 'up' ? '#2E7D32' : trend === 'down' ? '#C62828' : '#666';

  return (
    <View style={styles.kpiRow}>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>{nextLabel}</Text>
        <Text style={styles.kpiValue}>
          {Math.round(nextValue)}
          {unit ? <Text style={styles.kpiUnit}> {unit}</Text> : null}
        </Text>
      </View>

      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>7-day avg vs goal</Text>
        {isWeight ? (
          <Text style={styles.kpiValueMuted}>—</Text>
        ) : (
          <Text
            style={[
              styles.kpiValue,
              { color: vsGoal > 0 ? '#C62828' : '#2E7D32' },
            ]}
          >
            {vsGoal > 0 ? '+' : ''}
            {vsGoal.toFixed(0)}%
          </Text>
        )}
      </View>

      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Trend</Text>
        <View style={styles.trendValue}>
          <FontAwesome name={trendIcon as any} size={20} color={trendColor} />
          <Text style={[styles.trendText, { color: trendColor }]}>
            {trend}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ---- Chart ----
function TrendChart({ data, unit }: { data: ForecastResponse; unit: string }) {
  const histDates = data.historical.map((h) => h.date);
  const histVals = data.historical.map((h) => h.value);
  const fcVals = data.forecast.map((f) => f.value);
  const fcDates = data.forecast.map((f) => f.date);

  const histLen = histVals.length;
  const allDates = [...histDates, ...fcDates];

  // Build full-length, index-aligned datasets. chart-kit plots every dataset
  // from x=0, so all series must share the same length. The CI band collapses
  // onto the actual line over the observed region and widens over the forecast
  // region — a correct depiction of growing uncertainty.
  const mainData = [...histVals, ...fcVals];
  const upperData = [...histVals, ...data.forecast.map((f) => f.upper)];
  const lowerData = [...histVals, ...data.forecast.map((f) => f.lower)];

  const anomalyDates = new Set(data.anomalies.map((a) => a.date));

  // Thin x labels so they don't overlap (~6 across the axis).
  const step = Math.max(1, Math.ceil(allDates.length / 6));
  const labels = allDates.map((d, i) =>
    i % step === 0 ? formatShort(d) : ''
  );

  const chartConfig = {
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(49, 37, 108, ${opacity})`,
    labelColor: () => '#666',
    propsForBackgroundLines: { stroke: '#EEE' },
  };

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>
        History & 7-day forecast{unit ? ` (${unit})` : ''}
      </Text>
      <LineChart
        data={{
          labels,
          datasets: [
            // Upper / lower CI bounds, faint and dotless.
            {
              data: upperData,
              color: (o = 1) => `rgba(170, 155, 210, ${o * 0.5})`,
              strokeWidth: 1,
              withDots: false,
            },
            {
              data: lowerData,
              color: (o = 1) => `rgba(170, 155, 210, ${o * 0.5})`,
              strokeWidth: 1,
              withDots: false,
            },
            // Main line: solid over history, continues into forecast. Dots are
            // recoloured red at anomalies and orange over the forecast region.
            {
              data: mainData,
              color: (o = 1) => `rgba(49, 37, 108, ${o})`,
              strokeWidth: 2,
            },
          ],
        }}
        width={screenWidth - 40}
        height={240}
        chartConfig={chartConfig}
        bezier
        withShadow={false}
        fromZero={false}
        getDotColor={(_dataPoint, dataPointIndex) => {
          const date = allDates[dataPointIndex];
          if (anomalyDates.has(date)) return '#E53935'; // anomaly = red
          if (dataPointIndex >= histLen) return '#F39C12'; // forecast = orange
          return PRIMARY;
        }}
        style={styles.chart}
      />
    </View>
  );
}

function Legend({ modelName }: { modelName?: string }) {
  return (
    <View style={styles.legend}>
      <LegendItem color={PRIMARY} label="History" />
      <LegendItem color="#F39C12" label="Forecast" />
      <LegendItem color="#E53935" label="Anomaly" />
      <LegendItem color="rgba(170,155,210,0.6)" label="95% CI" />
      {modelName ? (
        <Text style={styles.modelTag}>model: {modelName}</Text>
      ) : null}
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <View>
      <View style={styles.kpiRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.kpiCard, styles.skeleton]} />
        ))}
      </View>
      <View style={[styles.chartCard, styles.skeletonChart]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Crunching your numbers…</Text>
      </View>
    </View>
  );
}

function formatShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { padding: 20, paddingBottom: 120 },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY,
    fontFamily: 'AfacadFlux',
    marginBottom: 16,
  },
  chipRow: { marginBottom: 20 },
  chipRowContent: { paddingRight: 20 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  chipActive: { backgroundColor: PRIMARY },
  chipText: { color: PRIMARY, fontFamily: 'AfacadFlux', fontSize: 14 },
  chipTextActive: { color: '#FFFFFF' },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 84,
    justifyContent: 'center',
  },
  kpiLabel: { fontSize: 12, color: '#888', fontFamily: 'AfacadFlux', marginBottom: 6 },
  kpiValue: { fontSize: 22, fontWeight: 'bold', color: PRIMARY, fontFamily: 'AfacadFlux' },
  kpiValueMuted: { fontSize: 22, fontWeight: 'bold', color: '#BBB', fontFamily: 'AfacadFlux' },
  kpiUnit: { fontSize: 13, fontWeight: 'normal', color: '#888' },
  trendValue: { flexDirection: 'row', alignItems: 'center' },
  trendText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 6,
    fontFamily: 'AfacadFlux',
    textTransform: 'capitalize',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY,
    fontFamily: 'AfacadFlux',
    marginBottom: 8,
  },
  chart: { marginVertical: 8, marginLeft: -10, borderRadius: 16 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 12, color: '#666', fontFamily: 'AfacadFlux' },
  modelTag: { fontSize: 11, color: '#AAA', fontFamily: 'AfacadFlux', fontStyle: 'italic' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: PRIMARY,
    fontFamily: 'AfacadFlux',
    marginTop: 12,
    marginBottom: 6,
  },
  messageText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'AfacadFlux',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  retryText: { color: '#FFF', fontWeight: '600', fontFamily: 'AfacadFlux' },
  skeleton: { backgroundColor: '#EFEFEF', minHeight: 84 },
  skeletonChart: { height: 240, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#888', fontFamily: 'AfacadFlux' },
});
