import React, { useState, useEffect } from "react";
import { View, Text, FlatList, ActivityIndicator, SafeAreaView, Pressable, StyleSheet, Switch } from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { dbPromise } from '../../../../utils/dbSetup'; // Adjust path: up three levels
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import SearchBar from "../../../../components/SearchBar"; // Adjust path
import "../../../../global.css"; // Adjust path

// --- Interfaces ---
interface Hadith {
    id: number; // Unique ID for the hadith row itself
    idInBook: number; // ID within the specific book/collection (e.g., Hadith #123)
    chapterId: number;
    bookId: number;
    arabic: string;
    english: { narrator: string; text: string; };
}

// For fetching chapter title
interface ChapterInfo {
    english_name: string;
    // Add collection_name if needed for more context in title
}

export default function HadithsListScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ collectionId: string; chapterId: string }>();
    const collectionId = params.collectionId;
    const chapterId = params.chapterId ? parseInt(params.chapterId, 10) : null; // Parse chapterId to number

    const [db, setDb] = useState<SQLiteDatabase | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hadithsList, setHadithsList] = useState<Hadith[]>([]);
    const [chapterName, setChapterName] = useState<string>(""); // For header title
    const [isAISearch, setIsAISearch] = useState(false); // Add AI Search state

    // --- Database Initialization Effect ---
    useEffect(() => {
        let isMounted = true;
        dbPromise.then((database: SQLiteDatabase) => {
            if (isMounted) {
                setDb(database);
            }
        }).catch((err: any) => {
            console.error(`HadithsListScreen [${collectionId}/${chapterId}]: Failed to open database:`, err);
            if (isMounted) {
                setError('Database failed to load. Please restart the app.');
                setLoading(false);
            }
        });
        return () => { isMounted = false; };
    }, []);

    // --- Data Fetching Effect (depends on db, collectionId, chapterId) ---
    useEffect(() => {
        if (db && collectionId && chapterId !== null) {
            fetchHadithsAndInfo(db, collectionId, chapterId);
        } else if (chapterId === null) {
            setError("Invalid Chapter ID.");
            setLoading(false);
        }
    }, [db, collectionId, chapterId]);

    // --- Data Fetching Function ---
    const fetchHadithsAndInfo = (database: SQLiteDatabase, collId: string, chapId: number) => {
        console.log(`HadithsListScreen [${collId}/${chapId}]: Fetching hadiths and info...`);
        setLoading(true);
        setHadithsList([]);
        try {
            // Fetch Hadiths
            const rawResults = database.getAllSync<any>(
                `SELECT id, id_in_book as idInBook, chapter_id as chapterId, book_id as bookId,\
                 english_narrator, english_text, arabic_text\n                 FROM hadiths\n                 WHERE collection_id = ? AND chapter_id = ? ORDER BY id_in_book;`,
                [collId, chapId]
            );
            const formattedHadiths = rawResults.map((item): Hadith => ({
                id: item.id,
                idInBook: item.idInBook,
                chapterId: item.chapterId,
                bookId: item.bookId,
                arabic: item.arabic_text || '',
                english: {
                    narrator: item.english_narrator || '',
                    text: item.english_text || ''
                }
            }));
            setHadithsList(formattedHadiths);

            // Fetch Chapter Name for Title
            const chapterInfo = database.getFirstSync<ChapterInfo>(
                'SELECT english_name FROM chapters WHERE collection_id = ? AND id = ?;', [collId, chapId]
            );
            setChapterName(chapterInfo?.english_name || `Chapter ${chapId}`); // Fallback

            setError(null);
        } catch (e: any) {
            console.error(`HadithsListScreen [${collId}/${chapId}]: Error fetching hadiths:`, e);
            setError(`Failed to load hadiths for chapter ${chapId}.`);
            setChapterName(`Chapter ${chapId}`); // Set fallback title on error
        } finally {
            setLoading(false);
        }
    };

    // --- Event Handlers ---
    const handleHadithSelect = (hadith: Hadith) => {
        if (!collectionId || chapterId === null) return;
        console.log(`Navigating to hadith: ${collectionId}/${chapterId}/${hadith.id}`);
        router.push({
            pathname: "/hadith/[collectionId]/[chapterId]/[hadithId]", // Target the detail screen
            params: { collectionId, chapterId: chapterId.toString(), hadithId: hadith.id.toString() }
        } as any); // Cast needed until target exists
    };

    const handleSearch = (query: string) => {
        if (!query?.trim()) return;
        if (chapterId === null) return; // Should not happen if rendered, but check

        // Add collectionId AND chapterId to the base params
        const params: {q: string, collectionId?: string, chapterId?: string, ai?: string} = { 
            q: query,
            collectionId: collectionId, // Add current collectionId
            chapterId: chapterId.toString() // Add current chapterId as string
        };

        if (isAISearch) {
            console.log(`Navigating to AI Search from ${collectionId}/${chapterId}:`, query);
            // Add ai flag
            params.ai = "true";
            router.push({
                pathname: "/hadith/search",
                params // Contains q, collectionId, chapterId, ai
            } as any);
        } else {
            console.log(`Navigating to Local Search from ${collectionId}/${chapterId}:`, query);
            // Navigate with q, collectionId, chapterId
            router.push({
                pathname: "/hadith/search",
                params // Contains q, collectionId, chapterId
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
            {/* Set the header title dynamically */}
            <Stack.Screen options={{ title: chapterName || "Hadiths" }} />

            {/* Search Bar */}
            <View className="px-4 pt-4 pb-2">
                {renderSearchBar(`Search in ${chapterName || 'chapter'}...`)}
            </View>

            {/* Loading State */}
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
            ) : error ? (
                // Error State
                <View className="flex-1 justify-center items-center p-6">
                    <Ionicons name="alert-circle-outline" size={60} color="#f87171" />
                    <Text className="text-red-400 text-lg text-center font-poppinsSemiBold mt-4 mb-6">{String(error)}</Text>
                    <Pressable
                        className="bg-teal-600 px-8 py-3 rounded-lg active:bg-teal-700"
                        onPress={() => { if (db && collectionId && chapterId !== null) fetchHadithsAndInfo(db, collectionId, chapterId); }}
                    >
                        <Text className="text-white text-center font-poppinsSemiBold text-base">Try Again</Text>
                    </Pressable>
                </View>
            ) : (
                // Hadiths List
                <FlatList
                    data={hadithsList}
                    keyExtractor={(item) => `${collectionId}-hadith-${item.id}`}
                    ItemSeparatorComponent={() => <View className="h-px bg-slate-700 mx-4" />}
                    contentContainerStyle={{ paddingBottom: 16 }}
                    renderItem={({ item }) => (
                        <Pressable
                            className="px-5 py-4 bg-slate-900 active:bg-slate-800"
                            onPress={() => handleHadithSelect(item)}
                        >
                            <Text className="text-sm text-slate-400 font-poppinsSemiBold mb-1"><Text>Hadith #{item.idInBook || 'N/A'}</Text></Text>
                            <Text className="text-base text-slate-300 font-poppinsSemiBold mb-1" numberOfLines={1} ellipsizeMode="tail">{item.english?.narrator || ''}</Text>
                            <Text className="text-white font-poppins text-base leading-snug" numberOfLines={3} ellipsizeMode="tail">{(item.english?.text || '').split('\n').map(line => line.trim()).join(' ')}</Text>
                        </Pressable>
                    )}
                    ListEmptyComponent={<View><Text className="text-center text-slate-400 py-10 font-poppins">No Hadiths found in this chapter.</Text></View>}
                />
            )}
        </SafeAreaView>
    );
}

// Styles (optional)
const styles = StyleSheet.create({});
