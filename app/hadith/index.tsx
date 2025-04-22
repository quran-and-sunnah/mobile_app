    import React, { useState, useEffect } from "react";
    import { View, Text, FlatList, ActivityIndicator, SafeAreaView, Pressable, StyleSheet, Switch } from "react-native";
    import { useRouter } from "expo-router";
    import { Ionicons } from '@expo/vector-icons';
    import { dbPromise } from '../../utils/dbSetup'; // Adjust path: up one level from hadith dir
    import type { SQLiteDatabase } from 'expo-sqlite';
    import SearchBar from "../../components/SearchBar"; // Adjust path
    import "../../global.css"; // Adjust path

    // --- Interface ---
    interface HadithCollectionInfo {
        id: string;
        name: string;
        author: string;
        initial: string; // Keep for potential future use even if not displayed
    }

    // --- Custom Sort Order ---
    const desiredCollectionOrder: string[] = [
        'bukhari', 'muslim', 'nasai', 'abudawud', 'tirmidhi', 'ibnmajah',
        'malik', 'ahmed', 'darimi'
    ];

    export default function HadithCollectionsScreen() {
        const router = useRouter();
        const [db, setDb] = useState<SQLiteDatabase | null>(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const [collectionsList, setCollectionsList] = useState<HadithCollectionInfo[]>([]);
        const [isAISearch, setIsAISearch] = useState(false);

        // --- Database Initialization Effect ---
        useEffect(() => {
            let isMounted = true;
            console.log("HadithCollectionsScreen: Initializing DB...");
            setLoading(true);
            dbPromise.then((database: SQLiteDatabase) => {
                if (isMounted) {
                    console.log("HadithCollectionsScreen: Database connection established.");
                    setDb(database);
                    fetchCollections(database);
                }
            }).catch((err: any) => {
                console.error("HadithCollectionsScreen: Failed to open database:", err);
                if (isMounted) {
                    setError('Database failed to load. Please restart the app.');
                    setLoading(false);
                }
            });
            return () => { isMounted = false; };
        }, []);

        // --- Data Fetching Function ---
        const fetchCollections = (database: SQLiteDatabase) => {
            console.log("HadithCollectionsScreen: Fetching collections...");
            try {
                const results = database.getAllSync<HadithCollectionInfo>(
                    'SELECT id, name, author, initial FROM collections;'
                );
                const sortedResults = results.sort((a, b) => {
                    const indexA = desiredCollectionOrder.indexOf(a.id);
                    const indexB = desiredCollectionOrder.indexOf(b.id);
                    const sortA = indexA === -1 ? desiredCollectionOrder.length : indexA;
                    const sortB = indexB === -1 ? desiredCollectionOrder.length : indexB;
                    return sortA - sortB;
                });
                setCollectionsList(sortedResults);
                setError(null);
            } catch (e: any) {
                console.error('HadithCollectionsScreen: Error fetching collections:', e);
                setError('Failed to load collections list.');
            } finally {
                setLoading(false);
            }
        };

        // --- Event Handlers ---
        const handleCollectionSelect = (collection: HadithCollectionInfo) => {
            router.push({
                pathname: "/hadith/[collectionId]",
                params: { collectionId: collection.id }
            } as any);
        };

        const handleSearch = (query: string) => {
            if (!query?.trim()) return;

            const params = { q: query };

            if (isAISearch) {
                router.push({ 
                    pathname: "/hadith/search", 
                    params: { ...params, ai: "true" } 
                } as any);
            } else {
                router.push({ 
                    pathname: "/hadith/search", 
                    params 
                } as any);
            }
        };

        const handleCancelSearch = () => {
            // Placeholder if SearchBar needs it, might not be used here
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
                    isLoading={false} // Search loading state would need to be added if search happens here
                />
                {/* Add AI Search Switch back */}
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

        // --- Loading and Error States ---
        if (!db || (loading && collectionsList.length === 0)) {
            return (
                <View className="flex-1 justify-center items-center bg-slate-900">
                    <ActivityIndicator size="large" color="#FFFFFF" />
                    <Text className="mt-4 text-white font-poppinsSemiBold">Loading Database...</Text>
                </View>
            );
        }

        if (error) {
            return (
                <SafeAreaView className="flex-1 bg-slate-900">
                    <View className="flex-1 justify-center items-center p-6">
                        <Ionicons name="alert-circle-outline" size={60} color="#f87171" />
                        <Text className="text-red-400 text-lg text-center font-poppinsSemiBold mt-4 mb-6">{String(error)}</Text>
                        <Pressable
                            className="bg-teal-600 px-8 py-3 rounded-lg w-full active:bg-teal-700"
                            onPress={() => {
                                setError(null);
                                if (db) fetchCollections(db); else console.error("DB missing on retry");
                            }}
                        >
                            <Text className="text-white text-center font-poppinsSemiBold text-base">Try Again</Text>
                        </Pressable>
                    </View>
                </SafeAreaView>
            );
        }

        // Render Collections List View
        return (
            <SafeAreaView className="flex-1 bg-slate-900">
                <View className="px-4 pt-6 pb-3">
                    {/* Header might be handled by layout, or add title here if needed */}
                    {/* <Text className="text-3xl font-poppinsBold text-white text-center mb-6">Hadith Collections</Text> */}
                    {renderSearchBar("Search all hadiths...")}
                </View>
                <FlatList
                    data={collectionsList}
                    keyExtractor={(item) => item.id}
                    ItemSeparatorComponent={() => <View className="h-2" />}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
                    renderItem={({ item: collection }) => (
                        <Pressable
                            key={collection.id}
                            className="bg-slate-800 rounded-lg flex-row items-center overflow-hidden active:bg-slate-700"
                            onPress={() => handleCollectionSelect(collection)}
                        >
                            <View className="flex-1 px-4 py-3">
                                <Text className="text-lg font-poppinsSemiBold text-white mb-1">{collection.name || ''}</Text>
                                <Text className="text-sm font-poppins text-slate-400">{collection.author || ''}</Text>
                            </View>
                            <>{/* Explicit empty fragment */}</>
                        </Pressable>
                    )}
                    ListEmptyComponent={<View><Text className="text-center text-slate-400 py-10 font-poppins">No collections loaded.</Text></View>}
                />
            </SafeAreaView>
        );
    }

    // Styles (optional, if needed for this specific screen)
    const styles = StyleSheet.create({});
