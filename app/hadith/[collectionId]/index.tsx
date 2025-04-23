import React, { useState, useEffect } from "react";
import { View, Text, FlatList, ActivityIndicator, SafeAreaView, Pressable, StyleSheet, Switch } from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { dbPromise } from '../../../utils/dbSetup';
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import SearchBar from "../../../components/SearchBar";
import "../../../global.css";
import BottomNavBar from "../../../components/BottomNavBar";

// --- Interface ---
interface Chapter {
    id: number;
    bookId?: number; 
    english: string;
    arabic: string;
}

interface CollectionInfo { // For setting title
    name: string;
}

export default function ChaptersScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ collectionId: string }>();
    const collectionId = params.collectionId;

    const [db, setDb] = useState<SQLiteDatabase | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [chaptersList, setChaptersList] = useState<Chapter[]>([]);
    const [collectionName, setCollectionName] = useState<string>("");
    const [isAISearch, setIsAISearch] = useState(false);

    // --- Database Initialization Effect ---
    useEffect(() => {
        let isMounted = true;
        dbPromise.then((database: SQLiteDatabase) => {
            if (isMounted) {
                setDb(database);
            }
        }).catch((err: any) => {
            console.error(`ChaptersScreen [${collectionId}]: Failed to open database:`, err);
            if (isMounted) {
                setError('Database failed to load. Please restart the app.');
                setLoading(false); // Set loading false on DB error
            }
        });
        return () => { isMounted = false; };
    }, []);

    // --- Data Fetching Effect (depends on db and collectionId) ---
    useEffect(() => {
        if (db && collectionId) {
            fetchChaptersAndInfo(db, collectionId);
        }
    }, [db, collectionId]);

    // --- Data Fetching Function ---
    const fetchChaptersAndInfo = (database: SQLiteDatabase, collId: string) => {
        if (!collId) return; // Don't fetch if collectionId is somehow missing
        console.log(`ChaptersScreen [${collId}]: Fetching chapters and info...`);
        setLoading(true);
        setChaptersList([]); 
        try {
            const chapterResults = database.getAllSync<Chapter>(
                'SELECT id, book_id as bookId, english_name as english, arabic_name as arabic FROM chapters WHERE collection_id = ? ORDER BY id;',
                [collId]
            );
            setChaptersList(chapterResults);

            const collectionInfo = database.getFirstSync<CollectionInfo>(
                'SELECT name FROM collections WHERE id = ?;', [collId]
            );
            setCollectionName(collectionInfo?.name || collId);

            setError(null);
        } catch (e: any) {
            console.error(`ChaptersScreen [${collId}]: Error fetching chapters:`, e);
            setError(`Failed to load chapters for ${collId}.`);
            setCollectionName(collId); 
        } finally {
            setLoading(false);
        }
    };

    // --- Event Handlers ---
    const handleChapterSelect = (chapter: Chapter) => {
        if (!collectionId) return;
        console.log(`Navigating to chapter: ${collectionId} / ${chapter.id}`);
        router.push({
            pathname: "/hadith/[collectionId]/[chapterId]", // Target the hadiths list screen
            params: { collectionId, chapterId: chapter.id.toString() }
        } as any); // Cast needed until target exists
    };

    const handleSearch = (query: string) => {
        if (!query?.trim()) return;

        // Add collectionId to the base params
        const params: {q: string, collectionId?: string, ai?: string} = { 
            q: query,
            collectionId: collectionId // Add current collectionId
        };

        if (isAISearch) {
            console.log(`Navigating to AI Search from ${collectionId}:`, query);
            // Add ai flag
            params.ai = "true";
            router.push({
                pathname: "/hadith/search",
                params
            } as any);
        } else {
            console.log(`Navigating to Local Search from ${collectionId}:`, query);
            // Navigate with q and collectionId
            router.push({
                pathname: "/hadith/search",
                params // Contains q and collectionId
            } as any);
        }
    };

    const handleCancelSearch = () => {
        console.log("Cancel search");
    };

    // --- UI Rendering ---
    const renderSearchBar = (placeholder: string) => (
        <View className="mb-3 px-4">
            <SearchBar
                onSearch={handleSearch}
                placeholder={placeholder}
                onCancel={handleCancelSearch}
                showCancel={false}
                isLoading={false}
            />
            <View className="flex-row items-center justify-end mt-2 mr-2">
                <Text className="text-slate-300 mr-2 font-poppins text-sm">AI Search</Text>
                <Switch
                    value={isAISearch}
                    onValueChange={setIsAISearch}
                    trackColor={{ false: '#475569', true: '#5eead4' }}
                    thumbColor={isAISearch ? '#f8fafc' : '#f8fafc'}
                    ios_backgroundColor="#475569"
                />
            </View>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-slate-900">
            <Stack.Screen 
                options={{ 
                    title: collectionName || "Loading..." 
                }} 
            />
                    
            {/* Wrap content in a flex-1 view */}
            <View className="flex-1">
                {/* Search Bar / Header Area */}
                <View className="px-4 pt-4 pb-2">
                    {renderSearchBar(`Search in ${collectionName || 'collection'}...`)}
                </View>

                {/* Conditional Loading/Error/List Area - Stays within the flex-1 view */} 
                {loading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#FFFFFF" />
                    </View>
                ) : error ? (
                    <View className="flex-1 justify-center items-center p-6">
                        <Ionicons name="alert-circle-outline" size={60} color="#f87171" />
                        <Text className="text-red-400 text-lg text-center font-poppinsSemiBold mt-4 mb-6">{String(error)}</Text>
                        <Pressable
                            className="bg-teal-600 px-8 py-3 rounded-lg active:bg-teal-700"
                            onPress={() => { if (db && collectionId) fetchChaptersAndInfo(db, collectionId); }}
                        >
                            <Text className="text-white text-center font-poppinsSemiBold text-base">Try Again</Text>
                        </Pressable>
                    </View>
                ) : (
                    <FlatList
                        // Remove flex-1 from FlatList itself
                        data={chaptersList}
                        keyExtractor={(item) => `${collectionId}-chapter-${item.id}`}
                        ItemSeparatorComponent={() => <View className="h-px bg-slate-700 mx-4" />}
                        // Add paddingBottom to avoid overlap
                        contentContainerStyle={{ paddingBottom: 80 }}
                        renderItem={({ item }) => {
                            // Determine the chapter number to display based on collectionId
                            const displayChapterNumber = [
                                'muslim', 'ibnmajah', 'darimi'
                            ].includes(collectionId || '') 
                                ? item.id + 1 // Add 1 for 0-indexed collections
                                : item.id;    // Display ID directly for 1-indexed collections

                            return (
                                <Pressable
                                    className="px-5 py-4 bg-slate-900 active:bg-slate-800 flex-row items-center justify-between"
                                    onPress={() => handleChapterSelect(item)}
                                >
                                    <View className="flex-1 mr-3">
                                        <Text className="text-white font-poppinsSemiBold text-lg">
                                            {/* Use the calculated display number */}
                                            <Text className="text-slate-400">{displayChapterNumber}: </Text>
                                            <Text>{item.english || ''}</Text>
                                        </Text>
                                        {item.arabic && (
                                            <Text className="text-slate-300 font-poppins text-right mt-1" style={{ writingDirection: 'rtl' }}>
                                                {item.arabic}
                                            </Text>
                                        )}
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color="#64748b" />
                                </Pressable>
                            );
                        }}
                        ListEmptyComponent={<View><Text className="text-center text-slate-400 py-10 font-poppins">No chapters found for this collection.</Text></View>}
                    />
                )}
            </View>
            <BottomNavBar />
        </SafeAreaView>
    );
}

// Styles (optional)
const styles = StyleSheet.create({}); 