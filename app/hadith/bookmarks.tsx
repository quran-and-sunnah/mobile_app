import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, TextInput, Modal, Alert, StyleSheet, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavBar from '../../components/BottomNavBar';

// Storage keys
const STORAGE_KEYS = {
    FOLDERS: 'bookmark_folders',
    BOOKMARKS: 'bookmark_items'
};

// TypeScript interfaces
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

export default function BookmarksScreen() {
    const router = useRouter();
    const [folders, setFolders] = useState<Folder[]>([]);
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState('folders'); // 'folders' or 'bookmarks'
    const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Load data from storage
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                
                // Load folders
                const storedFolders = await AsyncStorage.getItem(STORAGE_KEYS.FOLDERS);
                const parsedFolders = storedFolders ? JSON.parse(storedFolders) : [];
                setFolders(parsedFolders);
                
                // Load bookmarks
                const storedBookmarks = await AsyncStorage.getItem(STORAGE_KEYS.BOOKMARKS);
                const parsedBookmarks = storedBookmarks ? JSON.parse(storedBookmarks) : [];
                setBookmarks(parsedBookmarks);
            } catch (error) {
                console.error('Error loading bookmarks data:', error);
                setFolders([]);
                setBookmarks([]);
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, []);

    // Save folders whenever they change
    useEffect(() => {
        const saveData = async () => {
            try {
                await AsyncStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
            } catch (error) {
                console.error('Error saving folders:', error);
            }
        };
        
        if (!loading) {
            saveData();
        }
    }, [folders, loading]);

    // Save bookmarks whenever they change
    useEffect(() => {
        const saveData = async () => {
            try {
                await AsyncStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
            } catch (error) {
                console.error('Error saving bookmarks:', error);
            }
        };
        
        if (!loading) {
            saveData();
        }
    }, [bookmarks, loading]);

    const handleFolderPress = (folder: Folder) => {
        setSelectedFolder(folder);
        setCurrentView('bookmarks');
    };

    const goBackToFolders = () => {
        setCurrentView('folders');
        setSelectedFolder(null);
    };

    const handleHadithPress = (bookmark: Bookmark) => {
        router.push(`/hadith/${bookmark.collectionId}/${bookmark.hadithNumber}`);
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
        setModalVisible(false);
    };

    const deleteFolder = (folderId: string) => {
        Alert.alert(
            'Delete Folder',
            'Are you sure you want to delete this folder and all its bookmarks?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Delete', 
                    style: 'destructive',
                    onPress: () => {
                        setFolders(folders.filter(f => f.id !== folderId));
                        setBookmarks(bookmarks.filter(b => b.folderId !== folderId));
                    }
                }
            ]
        );
    };

    const renderFolder = ({ item }: { item: Folder }) => (
        <Pressable
            className="bg-slate-800 rounded-lg p-4 mb-3 active:bg-slate-700"
            onPress={() => handleFolderPress(item)}
        >
            <View className="flex-row justify-between items-center">
                <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-slate-700 rounded-lg items-center justify-center mr-3">
                        <Ionicons name="folder" size={24} color="#94a3b8" />
                    </View>
                    <Text className="text-white font-poppinsSemiBold text-lg">{item.name}</Text>
                </View>
                <View className="flex-row items-center">
                    <Text className="text-slate-400 font-poppins mr-2">{item.count}</Text>
                    <Pressable
                        className="ml-4 p-2"
                        onPress={() => deleteFolder(item.id)}
                    >
                        <Ionicons name="trash-outline" size={18} color="#94a3b8" />
                    </Pressable>
                    <Ionicons name="chevron-forward" size={20} color="#64748b" />
                </View>
            </View>
        </Pressable>
    );

    const renderBookmark = ({ item }: { item: Bookmark }) => (
        <Pressable
            className="bg-slate-800 rounded-lg p-4 mb-3 active:bg-slate-700"
            onPress={() => handleHadithPress(item)}
        >
            <View className="flex-row justify-between mb-2">
                <Text className="text-teal-500 font-poppinsSemiBold">{`${item.collectionId.charAt(0).toUpperCase() + item.collectionId.slice(1)} #${item.hadithNumber}`}</Text>
                <Pressable 
                    className="p-1"
                    onPress={() => {
                        setBookmarks(bookmarks.filter(b => b.id !== item.id));
                        if (selectedFolder) {
                            const updatedFolders = folders.map(f => 
                                f.id === selectedFolder.id ? {...f, count: f.count - 1} : f
                            );
                            setFolders(updatedFolders);
                            setSelectedFolder({...selectedFolder, count: selectedFolder.count - 1});
                        }
                    }}
                >
                    <Ionicons name="bookmark" size={18} color="#5eead4" />
                </Pressable>
            </View>
            <Text className="text-white font-poppins" numberOfLines={2}>{item.text}</Text>
        </Pressable>
    );

    const renderCreateFolderModal = () => (
        <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
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
                            onPress={() => setModalVisible(false)}
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

    const renderFoldersView = () => (
        <View style={{flex: 1}}>
            <View style={{
                paddingTop: Platform.OS === 'ios' ? 50 : 40, 
                paddingBottom: 20,
                paddingHorizontal: 40,
            }}>
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <Text style={{
                        fontSize: 24,
                        fontFamily: 'PoppinsBold',
                        color: 'white',
                    }}>Folders</Text>
                    
                    <Pressable 
                        style={{
                            backgroundColor: '#0d9488',
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        onPress={() => setModalVisible(true)}
                    >
                        <Ionicons name="add" size={24} color="white" />
                    </Pressable>
                </View>
            </View>
            
            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
            ) : folders.length > 0 ? (
                <FlatList<Folder>
                    data={folders}
                    renderItem={renderFolder}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{paddingHorizontal: 40, paddingBottom: 130}}
                />
            ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="folder-outline" size={60} color="#475569" />
                    <Text style={{ color: '#94a3b8', fontFamily: 'PoppinsSemiBold', fontSize: 18, marginTop: 16, textAlign: 'center' }}>No folders yet</Text>
                    <Text style={{ color: '#64748b', fontFamily: 'PoppinsRegular', textAlign: 'center', marginTop: 8, paddingHorizontal: 24 }}>
                        Create folders to organize your bookmarked hadiths.
                    </Text>
                    <Pressable 
                        style={styles.createButton}
                        onPress={() => setModalVisible(true)}
                    >
                        <Text style={{ color: 'white', fontFamily: 'PoppinsSemiBold' }}>Create Folder</Text>
                    </Pressable>
                </View>
            )}
        </View>
    );

    const renderBookmarksView = () => {
        if (!selectedFolder) return null;
        
        return (
            <View style={{flex: 1}}>
                <View style={{
                    paddingTop: Platform.OS === 'ios' ? 50 : 40,
                    paddingBottom: 20,
                    paddingHorizontal: 40,
                }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}>
                        <Pressable 
                            style={{marginRight: 16}}
                            onPress={goBackToFolders}
                        >
                            <Ionicons name="arrow-back" size={24} color="white" />
                        </Pressable>
                        <Text style={{
                            fontSize: 24,
                            fontFamily: 'PoppinsBold',
                            color: 'white',
                        }}>{selectedFolder.name}</Text>
                    </View>
                </View>
                
                {loading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#FFFFFF" />
                    </View>
                ) : bookmarks.filter(b => b.folderId === selectedFolder.id).length > 0 ? (
                    <FlatList<Bookmark>
                        data={bookmarks.filter(b => b.folderId === selectedFolder.id)}
                        renderItem={renderBookmark}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{paddingHorizontal: 40, paddingBottom: 130}}
                    />
                ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="bookmark-outline" size={60} color="#475569" />
                        <Text style={{ color: '#94a3b8', fontFamily: 'PoppinsSemiBold', fontSize: 18, marginTop: 16, textAlign: 'center' }}>No bookmarks in this folder</Text>
                        <Text style={{ color: '#64748b', fontFamily: 'PoppinsRegular', textAlign: 'center', marginTop: 8, paddingHorizontal: 24 }}>
                            Bookmarks you add to this folder will appear here.
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={{
            flex: 1,
            backgroundColor: '#0f172a',
            paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
        }}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <View style={{
                flex: 1,
                position: 'relative',
                backgroundColor: '#0f172a',
            }}>
                {currentView === 'folders' ? renderFoldersView() : renderBookmarksView()}
                {renderCreateFolderModal()}
            </View>
            
            <BottomNavBar />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        position: 'relative',
    },
    content: {
        flex: 1,
        paddingBottom: 110,
        paddingTop: 0,
        paddingHorizontal: 0,
    },
    headerOuterContainer: {
        margin: 20,
        marginTop: 30,
        marginBottom: 10,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    headerText: {
        fontSize: 24,
        fontFamily: 'PoppinsBold',
        color: '#ffffff',
        marginLeft: 15,
    },
    addButton: {
        backgroundColor: '#0d9488',
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
    },
    createButton: {
        backgroundColor: '#0d9488',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 32,
    },
    listContainer: {
        paddingHorizontal: 35,
        paddingBottom: 130,
    }
}); 