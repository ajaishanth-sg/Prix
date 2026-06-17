<div align="center">
  <img src="src/assets/logo.png" alt="Prix Logo" width="120" style="border-radius: 20px; margin-bottom: 20px;" />
  <h1>Prix — News, Games & Secure Communication Suite</h1>
  <p><em>A restructured dual-purpose web portal featuring a rich public entertainment hub that unlocks a secure, encrypted peer-to-peer messaging system.</em></p>
</div>

---

## 📖 Overview & Application Architecture

**Prix** is built with a stealth-first dual layout, providing a secure personal communication interface hidden behind an engaging, high-fidelity public face.

### 🎭 The Public Disguise
1. **News Hunt**: A modern, real-time news aggregator. It pulls breaking stories from **Times of India RSS feeds**, enriches summaries via the **Google Gemini API** using **Google Search Grounding**, categorizes news, and performs real-time sentiment analysis and entity recognition. It also features a live widescreen broadcast news stream sourced dynamically from YouTube.
2. **Shift Games**: A collection of high-fidelity client-side games for quick, casual play:
   - **Chess**: Fully interactive chess board supporting local two-player mode or an adaptive, client-side AI player.
   - **Sudoku**: Multiple difficulty levels, cell annotations, error detection, and puzzle generation.
   - **Mahjong Solitaire**: Classic tile matching with complex layouts, tile validation, and win/loss states.
   - **Open Games Explorer**: Integrates with `opengames.dev` API to showcase open-source web game statistics and catalogs.

### 🔐 The Encrypted Messaging Core (IntergramMessenger)
When a user activates a hidden trigger (such as the floating lock icon or a secret key sequence in the news portal) and enters the correct PIN or credentials, the interface decrypts to reveal **IntergramMessenger**:
- **Real-Time Direct Messaging**: Handled via Firebase Firestore for instantaneous communication.
- **WebRTC Voice & Video Calling**: Features real-time call invites, ringing states, and audio/video WebRTC connection hooks.
- **Cryptographic Mesh Link/Pairing**: Generates bidirectional connection invite links. These can be transmitted via **SMTP email** or **simulated SMS** using the Python backend (supporting custom SMTP configurations).
- **Security Protocols**: Locally managed cryptographic contexts and secure key integrations.

---

## 🛠️ Tech Stack Information

### Frontend
- **Framework**: [React 19](https://react.dev/) (Single Page Application)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (using the `@tailwindcss/vite` compiler)
- **Icons**: [Lucide React](https://lucide.dev/) for premium vector iconography
- **Animation**: [Motion](https://motion.dev/) (Framer Motion) for fluid UI state transitions and overlays

### Backend Services (Python Backend)
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.13)
- **Server**: [Uvicorn](https://www.uvicorn.org/) (Asynchronous Server Gateway Interface)
- **AI Integration**: [Google GenAI SDK](https://github.com/google/generative-ai-python) (`google-genai` library) for content generation with **Google Search Grounding**
- **Transports**: `smtplib` and `email` for pairing invitations via SMTP

### Dev Server & Proxy (Node.js)
- **Framework**: [Express.js](https://expressjs.com/) (Vite Dev Server integration middleware)
- **Proxy**: Natively forwards all `/api/*` endpoints to the FastAPI Python server at `http://127.0.0.1:8000` using standard `fetch` APIs.

---

## 📁 File Structure

```
project-root/
├── .env                          # Developer environment configuration
├── .env.example                  # Template of variables for local installation
├── .gitignore                    # Ignored directories and files (e.g. node_modules, .env)
├── package.json                  # Script registry and Node.js dependencies
├── tsconfig.json                 # TypeScript compiler configurations
├── vite.config.ts                # Vite bundler options and plugins
├── index.html                    # Root index container
│
├── config/                       # Firebase app config & rules directory
│   ├── firebase-applet-config.json # Firebase connection details
│   ├── firebase-blueprint.json    # JSON structural guide for Firestore collections
│   └── firestore.rules            # Security rules for direct Firestore access
│
├── server/                       # Express server proxy directory
│   └── server.ts                 # Dev server for Vite and backend routing proxy
│
├── backend/                      # Python backend service folder
│   ├── main.py                   # FastAPI server serving API endpoints
│   └── requirements.txt          # Python dependencies
│
├── src/                          # Frontend source code
    ├── main.tsx                  # Client entry point
    ├── App.tsx                   # Main App State coordinator
    ├── index.css                 # Global styles, fonts, and Tailwind v4 directives
    │
    ├── assets/                   # Brand assets and visual designs
    │   ├── logo.png              # Brand icon
    │   ├── anime_chat_bg.png
    │   ├── anime_dark_bg.png
    │   └── anime_sidebar_art.png
    │
    ├── config/                   # Client-side system initialisation
    │   └── firebase.ts           # Firebase client SDK initialization & offline mode
    │
    ├── types/                    # TS global interface mappings
    │   └── index.ts
    │
    ├── shared/                   # Shared utility components & services
    │   └── utils/
    │       ├── cryptoAndDrive.ts # Symmetric E2EE & Google Drive integration
    │       └── firestoreHelpers.ts # Firestore retry wrapper routines
    │
    ├── features/                 # Modular application features
    │   ├── games/                # Client-side entertainment features
    │   │   ├── ChessGame.tsx     # Local AI & 2-player chess board
    │   │   ├── MahjongGame.tsx   # Solitaire Mahjong tiles matches
    │   │   ├── SudokuGame.tsx    # Sudoku boards generation & solvers
    │   │   └── DisguiseGame.tsx  # Games catalog index
    │   ├── news/                 # News aggregator features
    │   │   └── DisguiseNews.tsx  # News feed categories and filters UI
    │   ├── opengames/            # OpenGames API catalog
    │   │   └── OpenGamesExplorer.tsx
    │   ├── security/             # Lockpad & authentication features
    │   │   └── SecretLockpad.tsx # Keypad, email/pass decryption and signup steps
    │   └── messenger/            # Encrypted chat communication features
    │       ├── components/
    │       │   ├── IntergramMessenger.tsx # Main multi-pane chat messenger
    │       │   └── WebRTCCalling.tsx      # Video/Audio WebRTC peer interface
    │       └── types.ts
    │
    └── routes/                   # Routing configuration
        └── index.tsx             # Conditional view coordinator router
```

---

## 🔌 Python Backend API Endpoints

The FastAPI backend in `backend/main.py` exposes the following endpoints:

1. **`GET /api/news`**: 
   - Attempts to scrape and parse the live **Times of India RSS feed** using regex.
   - If RSS is unavailable, it queries the **Gemini API** (`gemini-2.0-flash`) with the **Google Search tool** enabled to generate a structured JSON list of recent news complete with sentiment scores, and entities.
   - Includes a **3-minute cache TTL** to prevent 429 quota exhaustion.
   - Leverages a **circuit-breaker** cooldown period of 60 seconds if rate-limiting is detected, automatically serving high-fidelity local fallback news.

2. **`POST /api/send-invite`**:
   - Accepts pairing requests detailing the connection link and destination contact address.
   - Dispatches a secure HTML formatted email containing the matchmaking connection link.
   - Uses custom SMTP if defined in `.env`.

3. **`GET /api/portal-proxy`**:
   - A CORS-bypass proxy designed to fetch articles directly from news sources and serve them inline by injecting a `<base>` tag.

4. **`GET /api/toi-live`**:
   - Resolves YouTube video IDs for the live Times Now broadcast stream.

5. **`GET /api/opengames/games` | `search` | `stats`**:
   - Proxy endpoints that aggregate lists and statistics from `opengames.dev` with local fallbacks.

---

## 🚀 Setup & Local Execution

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Python 3.13+](https://www.python.org/)
- Gemini API Key (from [Google AI Studio](https://aistudio.google.com/))

### Configuration
1. Create a `.env` file in the root directory:
   ```env
   # API Keys
   GEMINI_API_KEY=your_gemini_api_key_here

   # Server Port
   PORT=3000

   # Optional: Mail SMTP Setup (Falls back to Console Logs if empty)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   SMTP_SECURE=true
   ```

2. Verify your client keys in `config/firebase-applet-config.json`.

### Running the Application

1. **Install Frontend Dependencies**:
   ```bash
   npm install
   ```

2. **Install Python Backend Dependencies**:
   ```bash
   pip install -r backend/requirements.txt
   ```

3. **Start the Python Backend**:
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```

4. **Start the Frontend Dev Server**:
   ```bash
   npm run dev
   ```
   *The client page will be accessible at [http://localhost:3000](http://localhost:3000).*
