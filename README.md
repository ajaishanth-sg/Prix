<div align="center">
  <img src="src/logo.png" alt="Prix Logo" width="120" style="border-radius: 20px; margin-bottom: 20px;" />
  <h1>Prix — News, Games & Secure Communication Suite</h1>
  <p><em>A dual-purpose web portal featuring a rich public entertainment hub that unlocks a secure, encrypted peer-to-peer messaging system.</em></p>
</div>

---

## 📖 Overview & Application Architecture

**Prix** is built with a stealth-first dual layout, providing a secure personal communication interface hidden behind an engaging, high-fidelity public face.

### 🎭 The Public Disguise
1. **News Hunt (`/api/news`)**: A modern, real-time news aggregator. It pulls breaking stories from **Times of India RSS feeds**, enriches summaries via the **Google Gemini 3.5 Flash API** using **Google Search Grounding**, categorizes news, and performs real-time sentiment analysis and entity recognition (persons, locations, organizations). It also features a live widescreen broadcast news stream sourced dynamically from YouTube.
2. **Shift Games**: A collection of high-fidelity client-side games for quick, casual play:
   - **Chess**: Fully interactive chess board supporting local two-player mode or an adaptive, client-side AI player.
   - **Sudoku**: Multiple difficulty levels, cell annotations, error detection, and puzzle generation.
   - **Mahjong Solitaire**: Classic tile matching with complex layouts, tile validation, and win/loss states.
   - **Open Games Explorer**: Integrates with `opengames.dev` API to showcase open-source web game statistics and catalogs.

### 🔐 The Encrypted Messaging Core (IntergramMessenger)
When a user activates a hidden trigger (such as the floating lock icon or a secret key sequence in the news portal) and enters the correct PIN or credentials, the interface decrypts to reveal **IntergramMessenger**:
- **Real-Time Direct Messaging**: Handled via Firebase Firestore for instantaneous communication.
- **WebRTC Voice & Video Calling**: Features real-time call invites, ringing states, and audio/video WebRTC connection hooks.
- **Cryptographic Mesh Link/Pairing**: Generates bidirectional connection invite links. These can be transmitted via **SMTP email** or **simulated SMS** using the Node.js Nodemailer backend (supporting Ethereal test accounts or custom SMTP configurations).
- **Security Protocols**: Locally managed cryptographic contexts and secure key integrations.

---

## 🛠️ Tech Stack Information

### Frontend
- **Framework**: [React 19](https://react.dev/) (Single Page Application)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (using the new `@tailwindcss/vite` compiler)
- **Icons**: [Lucide React](https://lucide.dev/) for premium vector iconography
- **Animation**: [Motion](https://motion.dev/) (Framer Motion) for fluid UI state transitions and overlays

### Backend (Node.js API Server)
- **Framework**: [Express.js](https://expressjs.com/)
- **Runner**: [tsx](https://github.com/privatenumber/tsx) (TypeScript execution engine for node)
- **Transports**: [Nodemailer](https://nodemailer.com/) (handles automated mail delivery, SMTP gateways, and Ethereal debugging accounts)

### Database & External APIs
- **Cloud Database**: [Firebase Firestore](https://firebase.google.com/) (real-time chat message syncing, calling signals, active users directory)
- **Authentication**: Firebase Authentication
- **Artificial Intelligence**: [Google Gemini 3.5 Flash](https://ai.google.dev/) (`@google/genai` SDK) with **Google Search Grounding** enabled for live news processing.

---

## 📁 File Structure

```
├── .env                          # Developer environment configuration
├── .env.example                  # Template of variables for local installation
├── .gitignore                    # Ignored directories and files (e.g. node_modules, .env)
├── firebase-applet-config.json    # Firebase project identifier and client API keys
├── firebase-blueprint.json       # JSON structural guide for Firestore collections
├── firestore.rules               # Security rules for direct Firestore access
├── index.html                    # Root index container
├── package.json                  # Script registry and Node.js dependencies
├── server.ts                     # Express server for API proxies and nodemailer transport
├── tsconfig.json                 # TypeScript compiler configurations
├── vite.config.ts                # Vite bundler options and plugins
└── src/
    ├── App.tsx                   # Main App Router, presence sync, and calling orchestrator
    ├── firebase.ts               # Firebase SDK client initialization and offline fallbacks
    ├── index.css                 # Global styles, fonts, and Tailwind v4 directives
    ├── logo.png                  # Prix brand visual asset
    ├── main.tsx                  # Vite React app entry mountpoint
    ├── types.ts                  # Global TypeScript type definitions
    ├── components/               # Core UI component directories
    │   ├── ChessGame.tsx         # Chess engine UI, board logic, and minimax local AI
    │   ├── DisguiseGame.tsx      # Shift Games catalog and game wrapper
    │   ├── DisguiseNews.tsx      # News feed layout, categorizer, and portal viewer
    │   ├── IntergramMessenger.tsx# Multi-pane real-time messenger UI
    │   ├── MahjongGame.tsx       # Solitaire Mahjong matching algorithm & layout engine
    │   ├── OpenGamesExplorer.tsx # Fetching and viewing portal for opengames.dev
    │   ├── SecretLockpad.tsx     # Hidden PIN/Key authorization panel
    │   └── WebRTCCalling.tsx     # Active WebRTC audio/video call screen
    └── utils/
        ├── cryptoAndDrive.ts     # Encrypted payload routines and file attachments helpers
        └── firestoreHelpers.ts   # Firestore read/write query wrappers
```

---

## 🔌 Express Server API Endpoints

The backend in `server.ts` exposes critical API endpoints:

1. **`GET /api/news`**: 
   - Attempts to scrape and parse the live **Times of India RSS feed** first.
   - If RSS is unavailable, it queries the **Gemini 3.5 Flash** model with the **Google Search tool** enabled to generate a structured JSON list of recent news complete with titles, publishing sources, Unsplash images, sentiment scores, and entities.
   - Includes a **3-minute cache TTL** to prevent 429 quota exhaustion.
   - Leverages a **circuit-breaker** cooldown period of 60 seconds if rate-limiting is detected, automatically serving high-fidelity local fallback news.

2. **`POST /api/send-invite`**:
   - Accepts pairing requests detailing the connection link and destination contact address.
   - Dispatches a secure HTML formatted email containing the matchmaking connection link.
   - Uses custom SMTP if defined in `.env`, or automatically configures a transient **Ethereal Mail** developer account, logging the debug inbox URL directly in the server console.

3. **`GET /api/portal-proxy`**:
   - A CORS-bypass proxy designed to fetch articles directly from news sources and serve them inline by injecting a `<base>` tag.

4. **`GET /api/toi-live`**:
   - Scrapes YouTube RSS channels to extract the active video ID for the live Times Now broadcast stream, falling back to a pre-defined stream ID if necessary.

5. **`GET /api/opengames/games` | `search` | `stats`**:
   - Proxy endpoints that aggregate lists and statistics from `opengames.dev` with a local database fallback.

---

## 🚀 Setup & Local Execution

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- Firebase Project setup (optional, simulated offline modes are active if omitted)
- Gemini API Key (from [Google AI Studio](https://aistudio.google.com/))

### Configuration
1. Clone the project files and create a `.env` file in the root directory:
   ```env
   # API Keys
   GEMINI_API_KEY=your_gemini_api_key_here

   # Server Port
   PORT=3000

   # Optional: Mail SMTP Setup (Falls back to Ethereal Mail if empty)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   SMTP_SECURE=true
   ```

2. Verify or add your client keys to `firebase-applet-config.json`.

### Running the Project

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```
   *The client page will be accessible at [http://localhost:3000](http://localhost:3000).*

3. **Build for production**:
   ```bash
   npm run build
   ```
   *This compiles the React asset bundle via Vite and prepares the esbuild server output inside the `/dist` directory.*
