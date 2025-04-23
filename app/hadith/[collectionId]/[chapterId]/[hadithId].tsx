import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator, SafeAreaView, Pressable, StyleSheet, Share, Modal, Alert, TextInput, FlatList } from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { dbPromise } from '../../../../utils/dbSetup';
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import "../../../../global.css";
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavBar from "../../../../components/BottomNavBar";

// --- Interface for the detailed hadith data ---
interface HadithDetail {
    id: number;
    idInBook: number;
    chapterId: number;
    bookId: number;
    arabic: string;
    english_narrator: string;
    english_text: string;
    collectionName: string;
    chapterName: string;
}

interface Folder {
    id: string;
    name: string;
    count: number;
}

interface Bookmark {
    id: string;
    folderId: string;
    collectionId: string;
    hadithNumber: number;
    text: string;
}

const STORAGE_KEYS = {
    FOLDERS: 'bookmark_folders',
    BOOKMARKS: 'bookmark_items'
};

export default function HadithDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ collectionId: string; chapterId: string; hadithId: string }>();
    const { collectionId, chapterId, hadithId: hadithIdStr } = params;
    const hadithId = hadithIdStr ? parseInt(hadithIdStr, 10) : null;

    const [db, setDb] = useState<SQLiteDatabase | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hadithDetail, setHadithDetail] = useState<HadithDetail | null>(null);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [bookmarkModalVisible, setBookmarkModalVisible] = useState(false);
    const [newFolderModalVisible, setNewFolderModalVisible] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isBookmarked, setIsBookmarked] = useState(false);

    const renderBookmarkModal = () => (
        <Modal
            animationType="slide"
            transparent={true}
            visible={bookmarkModalVisible}
            onRequestClose={() => setBookmarkModalVisible(false)}
        >
            <View className="flex-1 justify-center items-center bg-black/50">
                <View className="bg-slate-800 p-5 rounded-lg w-4/5">
                    <Text className="text-white font-poppinsSemiBold text-lg mb-4">Choose Folder</Text>
                    
                    {folders.length > 0 ? (
                        <FlatList
                            data={folders}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <Pressable
                                    className="bg-slate-700 p-4 rounded-lg mb-2 active:bg-slate-600"
                                    onPress={() => addBookmark(item.id)}
                                >
                                    <Text className="text-white font-poppinsSemiBold">{item.name}</Text>
                                    <Text className="text-slate-400 font-poppins text-sm">{item.count} hadiths</Text>
                                </Pressable>
                            )}
                        />
                    ) : (
                        <View className="items-center p-4">
                            <Text className="text-slate-400 font-poppins text-center mb-4">
                                No folders available. Create a new folder to bookmark this hadith.
                            </Text>
                        </View>
                    )}

                    <View className="flex-row justify-end mt-4">
                        <Pressable 
                            className="px-4 py-2 mr-2"
                            onPress={() => setBookmarkModalVisible(false)}
                        >
                            <Text className="text-slate-400 font-poppins">Cancel</Text>
                        </Pressable>
                        <Pressable 
                            className="bg-teal-600 px-4 py-2 rounded-lg"
                            onPress={() => {
                                setBookmarkModalVisible(false);
                                setNewFolderModalVisible(true);
                            }}
                        >
                            <Text className="text-white font-poppinsSemiBold">New Folder</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );

    const renderNewFolderModal = () => (
        <Modal
            animationType="slide"
            transparent={true}
            visible={newFolderModalVisible}
            onRequestClose={() => setNewFolderModalVisible(false)}
        >
            <View className="flex-1 justify-center items-center bg-black/50">
                <View className="bg-slate-800 p-5 rounded-lg w-4/5">
                    <Text className="text-white font-poppinsSemiBold text-lg mb-4">Create New Folder</Text>
                    <TextInput
                        className="bg-slate-700 text-white px-4 py-2 rounded-lg mb-4 font-poppins"
                        placeholder="Folder Name"
                        placeholderTextColor="#94a3b8"
                        value={newFolderName}
                        onChangeText={setNewFolderName}
                    />
                    <View className="flex-row justify-end">
                        <Pressable 
                            className="px-4 py-2 mr-2"
                            onPress={() => setNewFolderModalVisible(false)}
                        >
                            <Text className="text-slate-400 font-poppins">Cancel</Text>
                        </Pressable>
                        <Pressable 
                            className="bg-teal-600 px-4 py-2 rounded-lg"
                            onPress={createNewFolder}
                        >
                            <Text className="text-white font-poppinsSemiBold">Create</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );

    // Load folders from storage
    useEffect(() => {
        const loadFolders = async () => {
            try {
                const storedFolders = await AsyncStorage.getItem(STORAGE_KEYS.FOLDERS);
                setFolders(storedFolders ? JSON.parse(storedFolders) : []);
            } catch (error) {
                console.error('Error loading folders:', error);
                setFolders([]);
            }
        };
        loadFolders();
    }, []);

    // Check bookmark status when folders or hadith detail changes
    useEffect(() => {
        const checkIfBookmarked = async () => {
            if (!hadithDetail || !collectionId) return;
            
            try {
                const storedBookmarks = await AsyncStorage.getItem(STORAGE_KEYS.BOOKMARKS);
                const bookmarks: Bookmark[] = storedBookmarks ? JSON.parse(storedBookmarks) : [];
                
                // Get all folder IDs
                const folderIds = folders.map(folder => folder.id);
                
                // Check if the hadith is bookmarked in any existing folder
                const isBookmarked = bookmarks.some(
                    bookmark => 
                        bookmark.collectionId === collectionId && 
                        bookmark.hadithNumber === hadithDetail.idInBook &&
                        folderIds.includes(bookmark.folderId) // Only consider bookmarks in existing folders
                );
                
                setIsBookmarked(isBookmarked);
            } catch (error) {
                console.error('Error checking bookmark status:', error);
            }
        };
        
        checkIfBookmarked();
    }, [hadithDetail, collectionId, folders]); // Add folders to dependencies

    // Save folders whenever they change
    useEffect(() => {
        const saveFolders = async () => {
            try {
                await AsyncStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
            } catch (error) {
                console.error('Error saving folders:', error);
            }
        };
        saveFolders();
    }, [folders]);

    // --- Database Initialization Effect ---
    useEffect(() => {
        let isMounted = true;
        dbPromise.then((database: SQLiteDatabase) => {
            if (isMounted) {
                setDb(database);
            }
        }).catch((err: any) => {
            console.error(`HadithDetailScreen [${collectionId}/${chapterId}/${hadithId}]: Failed to open database:`, err);
            if (isMounted) {
                setError('Database failed to load. Please restart the app.');
                setLoading(false);
            }
        });
        return () => { isMounted = false; };
    }, []);

    // --- Data Fetching Effect (depends on db and IDs) ---
    useEffect(() => {
        if (db && collectionId && chapterId && hadithId !== null) {
            fetchSingleHadithDetails(db, collectionId, hadithId);
        } else if (hadithId === null) {
            setError("Invalid Hadith ID.");
            setLoading(false);
        }
    }, [db, collectionId, chapterId, hadithId]);

    // --- Data Fetching Function ---
    const fetchSingleHadithDetails = (database: SQLiteDatabase, collId: string, hId: number) => {
        console.log(`HadithDetailScreen: Fetching hadith ${hId} from ${collId}...`);
        setLoading(true);
        try {
            const sql = `
                SELECT
                    h.id, h.id_in_book as idInBook, h.chapter_id as chapterId, h.book_id as bookId,
                    h.arabic_text as arabic, h.english_narrator, h.english_text,
                    co.name as collectionName,
                    ch.english_name as chapterName
                FROM hadiths h
                JOIN collections co ON h.collection_id = co.id
                LEFT JOIN chapters ch ON h.collection_id = ch.collection_id AND h.chapter_id = ch.id
                WHERE h.collection_id = ? AND h.id = ?;`;
            const result = database.getFirstSync<HadithDetail>(sql, [collId, hId]);

            if (result) {
                setHadithDetail({
                    ...result,
                    // Ensure fallbacks for potentially null values from DB
                    arabic: result.arabic || '',
                    english_narrator: result.english_narrator || '',
                    english_text: result.english_text || '',
                    collectionName: result.collectionName || collId,
                    chapterName: result.chapterName || "N/A"
                });
                setError(null);
            } else {
                setError('Hadith details not found.');
            }
        } catch (e: any) {
            console.error(`HadithDetailScreen: Error fetching hadith detail ${hId}:`, e);
            setError('Failed to load hadith details.');
        } finally {
            setLoading(false);
        }
    };

    const createNewFolder = () => {
        if (newFolderName.trim() === '') {
            Alert.alert('Error', 'Please enter a folder name');
            return;
        }
        
        const newFolder: Folder = {
            id: `f${new Date().getTime()}`,
            name: newFolderName,
            count: 0
        };
        
        setFolders([...folders, newFolder]);
        setNewFolderName('');
        setNewFolderModalVisible(false);
    };

    const addBookmark = async (folderId: string) => {
        if (!hadithDetail || !collectionId || chapterId === null) return;

        try {
            const storedBookmarks = await AsyncStorage.getItem(STORAGE_KEYS.BOOKMARKS);
            const bookmarks = storedBookmarks ? JSON.parse(storedBookmarks) : [];
            
            const newBookmark = {
                id: `b${new Date().getTime()}`,
                folderId,
                collectionId,
                hadithNumber: hadithDetail.idInBook,
                text: hadithDetail.english_text
            };

            const updatedBookmarks = [...bookmarks, newBookmark];
            await AsyncStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(updatedBookmarks));

            // Update folder count
            const updatedFolders = folders.map(f => 
                f.id === folderId ? {...f, count: f.count + 1} : f
            );
            setFolders(updatedFolders);

            setIsBookmarked(true);
            setBookmarkModalVisible(false);
            Alert.alert('Success', 'Hadith bookmarked successfully');
        } catch (error) {
            console.error('Error adding bookmark:', error);
            Alert.alert('Error', 'Failed to bookmark hadith');
        }
    };

    // --- Event Handlers ---
    const handleShare = () => {
        if (!hadithDetail) return;
        const message = `
${hadithDetail.english_narrator}

${hadithDetail.english_text}

- Reference: ${hadithDetail.collectionName} #${hadithDetail.idInBook}
(Chapter: ${hadithDetail.chapterName})
`;
        Share.share({
            message,
            title: `Hadith from ${hadithDetail.collectionName}`
        }).catch(err => console.error("Share error:", err));
    };

    // --- UI Rendering ---

    // Loading State
    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-slate-900">
                <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
        );
    }

    // Error State
    if (error) {
        return (
            <SafeAreaView className="flex-1 bg-slate-900">
                {/* Set title even on error */}
                <Stack.Screen options={{ title: "Error" }} />
                <View className="flex-1 justify-center items-center p-6">
                    <Ionicons name="alert-circle-outline" size={60} color="#f87171" />
                    <Text className="text-red-400 text-lg text-center font-poppinsSemiBold mt-4 mb-6">{String(error)}</Text>
                    <Pressable
                        className="bg-teal-600 px-8 py-3 rounded-lg active:bg-teal-700"
                        onPress={() => { if (db && collectionId && chapterId !== null && hadithId !== null) fetchSingleHadithDetails(db, collectionId, hadithId); }}
                    >
                        <Text className="text-white text-center font-poppinsSemiBold text-base">Try Again</Text>
                    </Pressable>
                    {/* Maybe add a back button here? router.back() */}
                </View>
            </SafeAreaView>
        );
    }

    // Hadith Detail Found
    if (!hadithDetail) {
        // Should ideally be covered by error state, but as a fallback
        return (
             <SafeAreaView className="flex-1 bg-slate-900">
                <Stack.Screen options={{ title: "Not Found" }} />
                <View className="flex-1 justify-center items-center"><Text className="text-white">Hadith not found.</Text></View>
            </SafeAreaView>
        );
    }

    // Main Content
    return (
        <SafeAreaView className="flex-1 bg-slate-900">
            {/* Set the header title dynamically */}
            <Stack.Screen 
                options={{
                    title: hadithDetail 
                        ? `${collectionId?.charAt(0).toUpperCase() + collectionId?.slice(1)} #${hadithDetail.idInBook}`
                        : "Loading...",
                    headerRight: () => (
                        <Pressable 
                            className="mr-4"
                            onPress={() => setBookmarkModalVisible(true)}
                        >
                            <Ionicons 
                                name={isBookmarked ? "bookmark" : "bookmark-outline"} 
                                size={24} 
                                color="#5eead4" 
                            />
                        </Pressable>
                    )
                }}
            />

            <View className="flex-1">
                <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}>
                    {/* Chapter Title Sub-header */}
                    <Text className="text-lg font-poppins text-slate-400 text-center mt-2 mb-4 px-4">{hadithDetail.chapterName || ''}</Text>

                    <View className="bg-slate-800 rounded-lg p-5 shadow-md">
                        {/* Arabic Text */}
                        <View className="mb-5 items-end">
                            <Text selectable={true} style={styles.arabicHadithText}>
                                {'\u200F' + (hadithDetail.arabic || '').split('\n').map(line => line.trim()).join(' ').replace(/ ، /g, '، ').replace(/ : /g, ': ') + '\u200F'}
                            </Text>
                        </View>

                        <View className="border-t border-slate-700 my-4" />

                        {/* English Text */}
                        <View className="mb-5">
                            <Text selectable={true} className="text-base text-slate-300 font-poppinsSemiBold mb-2">
                                {hadithDetail.english_narrator || ''}
                            </Text>
                            <Text selectable={true} className="text-lg text-white font-poppins leading-relaxed">
                                {(hadithDetail.english_text || '').split('\n').map(line => line.trim()).join(' ')}
                            </Text>
                        </View>

                        {/* Footer with Reference and Share */}
                        <View className="flex-row justify-between items-center mt-3 pt-4 border-t border-slate-700">
                            <Text className="text-slate-400 font-poppins text-sm">Ref: {hadithDetail.collectionName || ''} #{hadithDetail.idInBook || 'N/A'}</Text>
                            <Pressable className="bg-teal-600 px-4 py-2 rounded-md flex-row items-center active:bg-teal-700" onPress={handleShare}>
                                <Ionicons name="share-social-outline" size={18} color="white" style={{marginRight: 6}}/>
                                <Text className="text-white font-poppinsSemiBold text-sm">Share</Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </View>

            {renderBookmarkModal()}
            {renderNewFolderModal()}
            <BottomNavBar />
        </SafeAreaView>
    );
}

// --- StyleSheet ---
const styles = StyleSheet.create({
    arabicHadithText: {
        color: '#FFFFFF',
        fontSize: 22,
        lineHeight: 36,
        textAlign: 'right',
        writingDirection: 'rtl',
        // Consider adding a specific Arabic font if available
        // fontFamily: 'YourArabicFont-Regular',
    },
});

