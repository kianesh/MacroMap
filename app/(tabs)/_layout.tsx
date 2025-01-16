import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
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
        color={props.focused ? '#fff' : '#6200ee'}
      />
      {props.focused && <Text style={styles.iconLabel}>{props.name}</Text>}
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#6200ee',
        headerStyle: {
          backgroundColor: '#6200ee',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          height: 80,
          marginHorizontal: 20,
          marginBottom: 20,
          borderRadius: 15,
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 5,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="dashboard" color={color} focused={focused} />,
          tabBarLabel: 'Dashboard',
          headerRight: () => (
            <Link href="/ProfileScreen" asChild>
              <Pressable>
                {({ pressed }) => (
                  <FontAwesome
                    name="user-circle"
                    size={25}
                    color={Colors[colorScheme ?? 'light'].text}
                    style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="map" color={color} focused={focused} />,
          tabBarLabel: 'Map',
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="file-text" color={color} focused={focused} />,
          tabBarLabel: 'Reports',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: -10,
  },
  iconContainerFocused: {
    backgroundColor: '#6200ee',
    transform: [{ translateY: -10 }],
  },
  iconLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
});