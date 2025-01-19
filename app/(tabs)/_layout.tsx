import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconContainer, props.focused && styles.iconContainerFocused]}>
      <FontAwesome
        size={28}
        style={{ marginBottom: -3 }}
        {...props}
        color={props.focused ? '#fff' : '#31256C'}
      />
    </View>
  );
}

function Background({ activeIndex }: { activeIndex: number }) {
  const { width } = Dimensions.get('window');
  const tabWidth = width / 3; // Assuming three tabs

  const curveWidth = tabWidth * 0.5; // Width of the curve
  const curveMidX = activeIndex * tabWidth + tabWidth / 2; // Center of the active tab

  return (
    <Svg
      width={width}
      height={100}
      style={{ position: 'absolute', bottom: 0, left: 0 }}
      viewBox={`0 0 ${width} 100`}
    >
      <Path
        d={`
          M0 0 
          L${curveMidX - curveWidth} 0 
          Q${curveMidX} 50, ${curveMidX + curveWidth} 0 
          L${width} 0 
          L${width} 100 
          L0 100 
          Z
        `}
        fill="#AA9BD2"
      />
    </Svg>
  );
}

export default function TabLayout() {
  const segments = useSegments();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const activeTab = segments[segments.length - 1];
    switch (activeTab) {
      case 'index':
        setActiveIndex(0);
        break;
      case 'two':
        setActiveIndex(1);
        break;
      case 'reports':
        setActiveIndex(2);
        break;
      default:
        setActiveIndex(0);
    }
  }, [segments]);

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      {/* Dynamic background */}
      <Background activeIndex={activeIndex} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#fff',
          tabBarInactiveTintColor: '#31256C',
          headerStyle: {
            backgroundColor: '#31256C',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          tabBarStyle: styles.tabBarStyle,
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, focused }) => <TabBarIcon name="dashboard" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="two"
          options={{
            title: 'Map',
            tabBarIcon: ({ color, focused }) => <TabBarIcon name="map" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ color, focused }) => <TabBarIcon name="file-text" color={color} focused={focused} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarStyle: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    height: 80,
    backgroundColor: '#AA9BD2', // Background is now consistent with your request
    borderRadius: 25,
    overflow: 'hidden',
    borderTopWidth: 0,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: -10,
  },
  iconContainerFocused: {
    backgroundColor: '#31256C',
    transform: [{ translateY: -10 }],
  },
});
