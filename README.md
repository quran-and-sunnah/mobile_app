# Islamic Library

A mobile application built with React Native (Expo Go) and a Python FastAPI backend for browsing and searching through multiple Hadith collections. Features both standard keyword search and AI-powered semantic search.

## Features

* Browse Hadith collections (Bukhari, Muslim, Abu Dawud, etc.) by chapter.
* Read Hadith text in English and Arabic.
* Keyword search across all loaded collections.
* AI-powered Semantic Search (toggleable) for finding Hadith based on meaning and context.

## Prerequisites

* **Node.js** (LTS version recommended) and **npm** or **yarn**.
* **Python** (3.9 or later recommended).
* **pip** (Python package installer).
* **Git**.
* **Expo Go App** installed on your iOS or Android device for running the frontend.
* **(Optional) NVIDIA GPU with CUDA:** Required *only* if you intend to re-train the AI model or run backend inference on the GPU (currently configured for CPU inference).

## Project Structure

mobile_app/
├── assets/         # App assets (fonts, images, hadith JSONs)
├── backend/        # FastAPI server code, requirements, index files
├── components/     # React Native components
├── app/            # Expo app screens/routing
├── training/       # Python scripts & source data for AI model training
│   ├── hadith-semantic-model-labse_checkpoints/ # Downloaded model checkpoints go here
│   └── hadiths.json      # Downloaded full dataset goes here
├── .gitignore
├── package.json
├── README.md

## Setup Instructions

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/quran-and-sunnah/mobile_app.git
    cd mobile_app # Or your project's root directory name
    ```

2.  **Download Large Files:**
    * The fine-tuned AI model, search index, and full dataset are too large for the repository. Download them from Google Drive:
        https://drive.google.com/drive/folders/1FWNDtb13-MftLxwhyWmTbnTAKiAFPYFp?usp=sharing * You should have downloaded:
        * A zip file like `checkpoint-2367.zip` (the best LaBSE model checkpoint).
        * `hadith_index.faiss`
        * `index_mapping.json`
        * `hadiths.json`
        * `hadith_data.db`

3.  **Place Downloaded Files:**
    * Unzip `checkpoint-2367.zip`.
    * Place the resulting `checkpoint-2367` **folder** inside the `training/hadith-semantic-model-labse_checkpoints/` directory. (Create the parent directories `training/hadith-semantic-model-labse_checkpoints/` if they don't exist after cloning).
    * Place `hadith_index.faiss` inside the `backend/` directory.
    * Place `index_mapping.json` inside the `backend/` directory.
    * Place `hadiths.json` inside the `training/` directory.
    * Place `hadith_data.db` in `assets/database`.

4.  **Frontend Setup:**
    * Navigate to the project root directory (where `package.json` is).
    * Install Node.js dependencies:
        ```bash
        npm install
        # OR
        # yarn install
        ```

5.  **Backend Setup:**
    * Navigate to the backend directory:
        ```bash
        cd backend
        ```
    * Create and activate a Python virtual environment:
        ```bash
        # Windows
        python -m venv .venv
        .\.venv\Scripts\activate

        # macOS / Linux
        python3 -m venv .venv
        source .venv/bin/activate
        ```
    * Install Python dependencies:
        ```bash
        pip install -r requirements.txt
        ```
        *(Note: This will install PyTorch, Sentence-Transformers, FAISS-CPU (usually), FastAPI, Uvicorn etc.)*

## Running the Application

You need to run both the backend server and the frontend app.

1.  **Start the Backend Server:**
    * Open a terminal, navigate to the `backend/` directory.
    * Make sure your Python virtual environment (`.venv`) is activated.
    * Run the FastAPI server:
        ```bash
        # Recommended for development (auto-reloads on code change)
        uvicorn main:app --host 0.0.0.0 --port 8000 --reload

        # Or without reload
        # python main.py
        ```
    * The server should start and log that it has successfully loaded the model, index, and mapping files. It will be accessible at `http://YOUR_LOCAL_IP:8000`.

2.  **Start the Frontend App:**
    * Open a *new* terminal, navigate to the project root directory (where `package.json` is).
    * Run the Expo development server:
        ```bash
        npx expo start
        ```
    * Wait for the Metro bundler to start and display a QR code.
    * Open the **Expo Go** app on your physical device (iOS or Android).
    * Scan the QR code displayed in the terminal.
    * The app should build and load on your device. Ensure your device is on the **same Wi-Fi network** as the computer running the backend server. The app should automatically detect the backend's IP address.

## Using the App

* Browse collections and chapters.
* Read hadiths.
* Use the search bar for keyword search (default).
* Toggle "AI Search" on for semantic search using the fine-tuned LaBSE model.