import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function BottomNavBar() {
    const router = useRouter();
    const screenHeight = Dimensions.get('window').height;

    return (
        <View style={styles.container}>
            <Pressable 
                style={styles.button}
                onPress={() => router.push('/hadith')}
            >
                <Ionicons name="book-outline" size={24} color="#94a3b8" />
                <Text style={styles.buttonText}>Hadiths</Text>
            </Pressable>
            
            <Pressable 
                style={styles.button}
                onPress={() => router.push('/hadith/bookmarks')}
            >
                <Ionicons name="bookmark-outline" size={24} color="#94a3b8" />
                <Text style={styles.buttonText}>Bookmarks</Text>
            </Pressable>
            
            <Pressable 
                style={styles.button}
                onPress={() => router.push('/settings')}
            >
                <Ionicons name="settings-outline" size={24} color="#94a3b8" />
                <Text style={styles.buttonText}>Settings</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 110,
        backgroundColor: '#1e293b',
        borderTopWidth: 1,
        borderTopColor: '#334155',
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: 24,
        elevation: 8, // for Android
        shadowColor: '#000', // for iOS
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        zIndex: 999,
    },
    button: {
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    buttonText: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 4,
        fontFamily: 'PoppinsRegular',
    }
}); 