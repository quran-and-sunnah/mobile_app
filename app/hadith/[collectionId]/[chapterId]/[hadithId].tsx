import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator, SafeAreaView, Pressable, StyleSheet, Share } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { dbPromise } from '../../../../utils/dbSetup';
import type { SQLiteDatabase } from 'expo-sqlite';
import "../../../../global.css";

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

export default function HadithDetailScreen() {
    const params = useLocalSearchParams<{ collectionId: string; chapterId: string; hadithId: string }>();
    const { collectionId, chapterId, hadithId: hadithIdStr } = params;
    const hadithId = hadithIdStr ? parseInt(hadithIdStr, 10) : null;

    const [db, setDb] = useState<SQLiteDatabase | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hadithDetail, setHadithDetail] = useState<HadithDetail | null>(null);

    // --- Database Initialization Effect ---
    useEffect(() => {
        let isMounted = true;
        dbPromise.then((database: SQLiteDatabase) => {
            if (isMounted) {
                setDb(database);
            }
        }).catch((err: any) => {
            console.error(`HadithDetailScreen [${hadithId}]: Failed to open database:`, err);
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
                        onPress={() => { if (db && collectionId && hadithId !== null) fetchSingleHadithDetails(db, collectionId, hadithId); }}
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
            <Stack.Screen options={{ title: `${hadithDetail.collectionName} #${hadithDetail.idInBook}` }} />

            <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
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

