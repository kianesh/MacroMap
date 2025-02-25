import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

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

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();

  const commonScreenOptions = {
    headerLeft: () => (
      <TouchableOpacity onPress={() => router.push('/ProfileScreen')}>
        <FontAwesome name="user" size={24} color="#fff" style={{ marginLeft: 15 }} />
      </TouchableOpacity>
    ),
    headerRight: () => (
      <TouchableOpacity onPress={() => router.push('/notifications')}>
        <MaterialIcons name="notifications" size={24} color="#fff" style={{ marginRight: 15 }} />
      </TouchableOpacity>
    ),
    headerTitle: '', // Hide the title
  };

  return (
    <View style={{ flex: 1 }}>
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
            ...commonScreenOptions,
            title: 'Dashboard',
            tabBarIcon: ({ color, focused }) => <TabBarIcon name="dashboard" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="two"
          options={{
            ...commonScreenOptions,
            title: 'Map',
            tabBarIcon: ({ color, focused }) => <TabBarIcon name="map" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="addMeal"
          options={{
            tabBarButton: (props) => (
              <TouchableOpacity
                {...props}
                style={styles.addButton}
                onPress={() => router.push('/MealSearchScreen')}
              >
                <FontAwesome name="plus" size={24} color="#fff" />
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            ...commonScreenOptions,
            title: 'Reports',
            tabBarIcon: ({ color, focused }) => <TabBarIcon name="file-text" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            ...commonScreenOptions,
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => <TabBarIcon name="cog" color={color} focused={focused} />,
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
    backgroundColor: '#AA9BD2',
    borderRadius: 25,
    overflow: 'hidden',
    borderTopWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: -25,
  },
  iconContainerFocused: {
    backgroundColor: '#31256C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#31256C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
});