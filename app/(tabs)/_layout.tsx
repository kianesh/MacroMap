import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Href, Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconContainer, props.focused && styles.iconContainerFocused]}>
      <FontAwesome size={28} {...props} color={props.focused ? '#fff' : '#31256C'} />
    </View>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);

  const handleOptionPress = (screen: Href) => {
      setModalVisible(false);
      router.push(screen);
    };

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
    headerTitle: '',
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Four tab screens */}
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#fff',
          tabBarInactiveTintColor: '#31256C',
          headerStyle: { backgroundColor: '#31256C' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          tabBarShowLabel: false,
          tabBarStyle: styles.tabBarStyle,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            ...commonScreenOptions,
            title: 'Diary',
            tabBarItemStyle: { marginLeft: 15 },
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="book" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="two"
          options={{
            ...commonScreenOptions,
            title: 'Map',
            tabBarItemStyle: { marginLeft: 35 },
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="map" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            ...commonScreenOptions,
            title: 'Reports',
            tabBarItemStyle: { marginLeft: 140 },
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="bar-chart" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            ...commonScreenOptions,
            title: 'Settings',
            tabBarItemStyle: { marginLeft: 35 },
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="cog" color={color} focused={focused} />
            ),
          }}
        />
      </Tabs>

      {/* Center Floating Plus Button */}
      <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
        <FontAwesome name="plus" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Small Popup Modal positioned above the Plus Button */}
      <Modal transparent animationType="none" visible={modalVisible}>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContainer}>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => handleOptionPress('/MealSearchScreen' as Href)}
                >
                  <FontAwesome name="search" size={20} color="#31256C" style={styles.modalIcon} />
                  <Text style={styles.modalOptionText}>Food Search</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => handleOptionPress('/nlp' as Href)}
                >
                  <FontAwesome name="language" size={20} color="#31256C" style={styles.modalIcon} />
                  <Text style={styles.modalOptionText}>Natural Language</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => handleOptionPress('/ai' as Href)}
                >
                  <FontAwesome5 name="robot" size={20} color="#31256C" style={styles.modalIcon} />
                  <Text style={styles.modalOptionText}>AI Assistant</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    top:10,
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  iconContainerFocused: {
    backgroundColor: '#rgba(0,0,0,0)',
  },
  addButton: {
    position: 'absolute',
    bottom: 25, // Bring the button lower (adjust as needed)
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#31256C',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 90, // Position the popup just above the plus button
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    flexDirection: 'column',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalIcon: {
    marginRight: 8,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#31256C',
  },
});
