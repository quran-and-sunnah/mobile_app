# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

# Hadith Semantic Search

A mobile app that provides semantic search capabilities for Hadith collections.

## Project Structure

```
.
├── backend/                 # FastAPI backend
│   ├── main.py             # API endpoints
│   ├── models/             # ML models and embeddings
│   ├── data/               # Hadith data
│   ├── requirements.txt    # Python dependencies
│   ├── .env.example        # Environment variables
│   └── start.sh            # Server startup script
└── mobile/                 # React Native mobile app
    ├── src/                # Source code
    ├── components/         # UI components
    └── api/                # API client
```

## Development Setup

### Backend

1. Create and activate virtual environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Copy environment file:
```bash
cp .env.example .env
```

4. Start the server:
```bash
./start.sh
```

The API will be available at:
- Local development: `http://localhost:8000`
- Android emulator: `http://10.0.2.2:8000`
- iOS simulator: `http://localhost:8000`

### Mobile App

1. Install dependencies:
```bash
cd mobile
npm install
```

2. Configure API URL in environment:
```bash
cp .env.example .env
```

3. Start the development server:
```bash
npm start
```

## Deployment

### Backend
1. Deploy FastAPI backend to cloud service (e.g., Heroku, AWS, GCP)
2. Update mobile app's production API URL

### Mobile App
1. Build and deploy to app stores
2. Configure production API URL

## API Endpoints

- `GET /search?query={text}`: Semantic search endpoint
- `GET /health`: Health check endpoint

## Environment Variables

### Backend
- `ENV`: Environment (development/production)
- `DEV_API_URL`: Development API URL
- `ANDROID_EMULATOR_API_URL`: Android emulator API URL
- `IOS_SIMULATOR_API_URL`: iOS simulator API URL
- `PROD_API_URL`: Production API URL

### Mobile App
- `API_URL`: Current environment API URL
