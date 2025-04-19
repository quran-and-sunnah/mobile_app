// dbSetup.ts (Updated)
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_NAME = "hadith_data.db";

async function openDatabase(): Promise<SQLiteDatabase> {
    const internalDbName = DATABASE_NAME;
    const dbDirectory = `${FileSystem.documentDirectory}SQLite`;

    // Ensure the SQLite directory exists
    const dirInfo = await FileSystem.getInfoAsync(dbDirectory);
    if (!dirInfo.exists) {
        console.log("SQLite directory doesn't exist, creating...");
        await FileSystem.makeDirectoryAsync(dbDirectory, { intermediates: true });
    }

    const dbFilePath = `${dbDirectory}/${internalDbName}`;

    // Use Asset.fromModule to get the asset object
    const dbAsset = Asset.fromModule(require(`../assets/database/${DATABASE_NAME}`));

    // Check if the database file already exists in the writable directory
    const fileInfo = await FileSystem.getInfoAsync(dbFilePath);

    if (!fileInfo.exists) {
        console.log("Database doesn't exist in writable directory, downloading from asset...");
        if (!dbAsset.uri) {
             // Ensure asset metadata including URI is loaded
            await dbAsset.downloadAsync();
        }
        // Use downloadAsync to copy from the asset URI to the target file path
        await FileSystem.downloadAsync(
            dbAsset.uri, // Use the resolved asset URI
            dbFilePath
        );
        console.log("Database copied.");
    } else {
        console.log("Database already exists in writable directory.");
        // Optional: Check asset hash against stored hash to see if update needed
        // (More advanced, skip for now)
    }

    // Now open the database from the writable location using the SYNC method
    console.log(`Opening database synchronously from: ${dbFilePath}`);
    return SQLite.openDatabaseSync(internalDbName); // Using Sync open based on your hadith.tsx fetches
}

// Export a promise that resolves with the database connection
// Although openDatabaseSync is sync, we keep the promise pattern
// for consistency in initialization logic if needed elsewhere.
export const dbPromise = openDatabase();

console.log("dbPromise initiated (using openDatabaseSync inside)...");