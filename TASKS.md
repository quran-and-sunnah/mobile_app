# Hadith Semantic Search: Project Overview & Next Steps

## Project Goal

This project aims to create a React Native + Expo Go mobile app that enables users to browse Hadith collections (Bukhari, Muslim, etc.) with two search capabilities:

1. **Offline keyword search**: Traditional text matching that works without internet connection
2. **Semantic search**: An AI-powered search mode that understands the meaning of queries in both Arabic and English, returning relevant results even when query terms don't exactly match the text

The semantic search capability is powered by a fine-tuned multilingual embedding model that can understand both Arabic and English, placing semantically similar content close together in the embedding space regardless of language.

## Progress So Far

- **Data preparation**: Merged nine Hadith collection JSONs into one `hadiths.json` with a uniform structure including a "title" field for collection identification
- **Model selection**: Chose `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` as the base model due to its multilingual capabilities
- **Fine-tuning**: Successfully trained the model to align Arabic and English texts in the same 384-dimensional vector space:
  - Used paired Arabic-English Hadith texts as training examples
  - Applied `MultipleNegativesRankingLoss` to bring true pairs closer while pushing apart unrelated examples
  - Leveraged Apple's MPS backend for GPU acceleration on Mac M3
  - Training completed with steadily decreasing loss (from ~2.44 to ~1.41), confirming successful learning

## Next Steps Checklist

### 1. Create Embeddings & Vector Index ✅
- [x] **Load the fine-tuned model** from the saved directory (~/Users/Ayoub/Desktop/mobile_app)
- [x] **Generate embeddings** for all Hadiths in your collection
  - Created embeddings for Arabic text and English text
  - Processed in batches to manage memory efficiently
- [x] **Build a FAISS index** with these embeddings
  - Used IndexFlatIP for exact search with cosine similarity
  - Implemented batch processing to handle large dataset
- [x] **Save the index** to disk for later use by the API
- [x] **Create a mapping** between index positions and Hadith IDs for result retrieval
- [x] **Save full hadiths data** for complete result retrieval

### 2. Develop FastAPI Backend ✅
- [x] **Set up project structure** for the FastAPI application
- [x] **Install dependencies** (FastAPI, Uvicorn, FAISS, SentenceTransformers, etc.)
- [x] **Load model, index, and data** at application startup
- [x] **Create API endpoints**:
  - `/search` endpoint that accepts:
    - Query text (in Arabic or English)
    - Number of results to return (top_k)
  - `/health` endpoint for monitoring
- [x] **Implement search logic**:
  - Encode the incoming query using the fine-tuned model
  - Search the FAISS index for nearest neighbors
  - Retrieve the corresponding Hadiths using the ID mapping
  - Return formatted results with text and metadata
- [x] **Add error handling** and input validation

### 3. Set Up Deployment Configuration ✅
- [x] **Create requirements.txt** listing all Python dependencies
- [x] **Write a startup script** to launch the FastAPI server
- [x] **Configure server settings** (host, port, logging)
- [x] **Set up environment variables** for different environments
- [x] **Configure API URLs** for development and production
- [x] **Add mobile-specific configurations** for emulator/simulator access

### 4. Update Mobile App for Semantic Search ✅
- [x] **Create API client** with environment-aware configuration
- [x] **Implement API URL switching** based on environment
- [x] **Add network error handling** and retry logic
- [x] **Implement offline fallback** to keyword search
- [x] **Add loading states** and error handling for API calls
- [x] **Configure API endpoint URL** for different environments

### 5. Test and Deploy
- [ ] **Run the FastAPI backend** on a local server
- [ ] **Test semantic search** with various queries in both Arabic and English
- [ ] **Compare results** with keyword search to verify improvement
- [ ] **Optimize performance** if search latency is too high
- [ ] **Deploy the backend** to an appropriate hosting service
- [ ] **Update mobile app** to point to the deployed backend
- [ ] **Consider bundling a smaller model** directly in the app for offline semantic search

## Technical Notes

- The fine-tuned model creates a shared embedding space where semantically similar content in either language clusters together
- Vector search is significantly more powerful than keyword matching for understanding intent and meaning
- The backend/API approach allows for model updates without requiring app updates
- Consider privacy implications of sending user queries to a server vs. fully offline search

This approach enables a powerful, bilingual search capability that goes beyond simple keyword matching, allowing users to find relevant Hadiths based on concepts and meaning rather than exact word matches.