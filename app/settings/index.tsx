import React, { useState } from 'react';
import { View, Text, Switch, Pressable, SafeAreaView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import BottomNavBar from '../../components/BottomNavBar';

export default function SettingsScreen() {
    const router = useRouter();
    const [darkMode, setDarkMode] = useState(true);
    const [notifications, setNotifications] = useState(true);
    const [arabicText, setArabicText] = useState(true);

    return (
        <SafeAreaView className="flex-1 bg-slate-900">
            <View className="flex-1 px-4">
                <Text className="text-2xl font-poppinsBold text-white mt-6 mb-8">Settings</Text>
                
                {/* Theme Settings */}
                <View className="mb-6">
                    <Text className="text-lg font-poppinsSemiBold text-white mb-4">Appearance</Text>
                    <View className="bg-slate-800 rounded-lg p-4">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white font-poppins">Dark Mode</Text>
                            <Switch
                                value={darkMode}
                                onValueChange={setDarkMode}
                                trackColor={{ false: '#475569', true: '#5eead4' }}
                                thumbColor={darkMode ? '#f8fafc' : '#f8fafc'}
                            />
                        </View>
                    </View>
                </View>

                {/* Content Settings */}
                <View className="mb-6">
                    <Text className="text-lg font-poppinsSemiBold text-white mb-4">Content</Text>
                    <View className="bg-slate-800 rounded-lg p-4">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white font-poppins">Show Arabic Text</Text>
                            <Switch
                                value={arabicText}
                                onValueChange={setArabicText}
                                trackColor={{ false: '#475569', true: '#5eead4' }}
                                thumbColor={arabicText ? '#f8fafc' : '#f8fafc'}
                            />
                        </View>
                    </View>
                </View>

                {/* Notification Settings */}
                <View className="mb-6">
                    <Text className="text-lg font-poppinsSemiBold text-white mb-4">Notifications</Text>
                    <View className="bg-slate-800 rounded-lg p-4">
                        <View className="flex-row justify-between items-center">
                            <Text className="text-white font-poppins">Daily Reminders</Text>
                            <Switch
                                value={notifications}
                                onValueChange={setNotifications}
                                trackColor={{ false: '#475569', true: '#5eead4' }}
                                thumbColor={notifications ? '#f8fafc' : '#f8fafc'}
                            />
                        </View>
                    </View>
                </View>

                {/* About Section */}
                <View className="mb-6">
                    <Text className="text-lg font-poppinsSemiBold text-white mb-4">About</Text>
                    <View className="bg-slate-800 rounded-lg p-4">
                        <Pressable
                            className="py-3"
                            onPress={() => router.push('/settings/about')}
                        >
                            <Text className="text-white font-poppins">About the App</Text>
                        </Pressable>
                        <View className="h-px bg-slate-700 my-2" />
                        <Pressable
                            className="py-3"
                            onPress={() => router.push('/settings/privacy')}
                        >
                            <Text className="text-white font-poppins">Privacy Policy</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
            <BottomNavBar />
        </SafeAreaView>
    );
} 