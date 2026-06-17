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
- **Cryptographic Mesh Link/Pairing**: Generates bidirectional connection invite links. These can be transmitted via **SMTP email** or **simulated SMS** using the Django backend (supporting custom SMTP configurations).
- **Security Protocols**: Locally managed cryptographic contexts and secure key integrations.

---

## 🛠️ Tech Stack Information

### Frontend
- **Framework**: [React 19](https://react.dev/) (Single Page Application)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (using the `@tailwindcss/vite` compiler)
- **Icons**: [Lucide React](https://lucide.dev/) for premium vector iconography
- **Animation**: [Motion](https://motion.dev/) (Framer Motion) for fluid UI state transitions and overlays

### Backend Services (Django + PostgreSQL)
- **Framework**: [Django 6.0](https://www.djangoproject.com/) (Python 3.13)
- **Database**: [PostgreSQL](https://www.postgresql.org/) — local instance, database: `prix`
- **ORM**: Django Models — `UserProfile`, `Contact`, `ChatSession`, `ChatMessage`, `NewsCache`, `InviteLog`
- **CORS**: [`django-cors-headers`](https://pypi.org/project/django-cors-headers/) for cross-origin API access
- **AI Integration**: [Google GenAI SDK](https://github.com/google/generative-ai-python) (`google-genai` library) for content generation with **Google Search Grounding**
- **Transports**: `smtplib` and `email` for pairing invitations via SMTP
- **Database Adapter**: [`psycopg2-binary`](https://pypi.org/project/psycopg2-binary/) for PostgreSQL connectivity

### Real-Time & Cloud Services
- **Firebase Firestore**: Real-time chat message synchronization
- **Firebase Auth**: Google Sign-In + phone OTP authentication
- **WebRTC**: Peer-to-peer voice and video calling

### Dev Server & Proxy (Node.js)
- **Framework**: [Express.js](https://expressjs.com/) (Vite Dev Server integration middleware)
- **Proxy**: Natively forwards all `/api/*` endpoints to the Django Python server at `http://127.0.0.1:8001` using standard `fetch` APIs.

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
├── backend/                      # Django backend service folder
│   ├── manage.py                 # Django management CLI
│   ├── create_db.py              # PostgreSQL database bootstrap script
│   ├── main.py                   # Legacy FastAPI server (deprecated, kept for reference)
│   ├── requirements.txt          # Python dependencies
│   │
│   ├── prix_backend/             # Django project configuration
│   │   ├── __init__.py
│   │   ├── settings.py           # Django settings (PostgreSQL, CORS, apps)
│   │   ├── urls.py               # Root URL routing (admin + api)
│   │   ├── wsgi.py               # WSGI application entry point
│   │   └── asgi.py               # ASGI application entry point
│   │
│   └── api/                      # Django API application
│       ├── __init__.py
│       ├── models.py             # ORM models (UserProfile, ChatSession, etc.)
│       ├── views.py              # API view functions (news, auth, chat, etc.)
│       ├── urls.py               # API URL routing
│       ├── admin.py              # Django admin registrations
│       └── migrations/           # Database migration files
│           └── 0001_initial.py   # Initial schema migration
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

## 🗄️ Database Schema (PostgreSQL)

The Django backend uses PostgreSQL with the following models:

| Model | Table | Description |
|-------|-------|-------------|
| `UserProfile` | `user_profiles` | Extended user profile (display name, avatar, permissions) linked to Django's `auth_user` |
| `Contact` | `contacts` | Contact relationships between users |
| `ChatSession` | `chat_sessions` | Conversation threads with platform, type, and encryption key |
| `ChatMessage` | `chat_messages` | Individual messages with support for files, polls, checklists, location, and wallet transfers |
| `NewsCache` | `news_cache` | Server-side persistent news cache (JSON articles by query key) |
| `InviteLog` | `invite_logs` | Audit log of pairing invitations sent via email/SMS |

---

## 🔌 Django Backend API Endpoints

The Django backend in `backend/api/views.py` exposes the following endpoints (all prefixed with `/api/`):

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/signup/` | Register new user with email/password + profile data |
| `POST` | `/api/login/` | Authenticate user and return profile |
| `POST` | `/api/logout/` | Mark user as offline |

### Users & Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users/` | List all registered users for contact directory |
| `GET` | `/api/contacts/?userId=` | List contacts for a specific user |
| `POST` | `/api/contacts/` | Add a new contact |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/chat/sessions/?userId=` | List chat sessions for a user |
| `POST` | `/api/chat/sessions/` | Create a new chat session |
| `GET` | `/api/chat/messages/?sessionId=` | List messages in a session |
| `POST` | `/api/chat/messages/` | Send a new message |

### News & Content
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/news/` | Fetch news (TOI RSS → Gemini Search → fallback) with 3-min cache + circuit breaker |
| `GET` | `/api/portal-proxy/?url=` | CORS-bypass proxy for inline article viewing |
| `GET` | `/api/toi-live/` | Resolve YouTube video ID for live Times Now broadcast |

### Invitations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/send-invite/` | Send pairing invitation via SMTP email or simulated SMS |

### OpenGames Proxy
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/opengames/games/` | Proxy for OpenGames game listing |
| `GET` | `/api/opengames/search/` | Proxy for OpenGames search |
| `GET` | `/api/opengames/stats/` | Proxy for OpenGames statistics |

### Utility
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health/` | Health check (returns server status + timestamp) |

---

## 🚀 Setup & Local Execution

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Python 3.13+](https://www.python.org/)
- [PostgreSQL](https://www.postgresql.org/) (v15+ recommended, running locally on port 5432)
- Gemini API Key (from [Google AI Studio](https://aistudio.google.com/))

### Configuration
1. Create a `.env` file in the root directory:
   ```env
   # API Keys
   GEMINI_API_KEY=your_gemini_api_key_here

   # Server Port
   PORT=3000

   # PostgreSQL Database
   DB_NAME=prix
   DB_USER=postgres
   DB_PASSWORD=Admin@123
   DB_HOST=localhost
   DB_PORT=5432

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

3. **Bootstrap the PostgreSQL Database**:
   ```bash
   python backend/create_db.py
   ```

4. **Run Django Migrations**:
   ```bash
   cd backend
   python manage.py migrate
   ```

5. **Start the Django Backend** (port 8001):
   ```bash
   cd backend
   python manage.py runserver 0.0.0.0:8001
   ```

6. **Start the Frontend Dev Server** (port 3000):
   ```bash
   npm run dev
   ```
   *The client page will be accessible at [http://localhost:3000](http://localhost:3000).*

### Django Admin
To access the Django admin panel at `http://localhost:8001/admin/`:
```bash
cd backend
python manage.py createsuperuser
```

---

## 📋 Future Enhancements & Missing Features

The following features are identified for future development:

| Feature | Status | Priority |
|---------|--------|----------|
| JWT / Token-based auth for API endpoints | 🔲 Planned | High |
| WebSocket real-time chat via Django Channels | 🔲 Planned | High |
| Full frontend migration from Firebase Auth to Django Auth | 🔲 Planned | Medium |
| User avatar upload to server (file storage) | 🔲 Planned | Medium |
| Chat message search & pagination | 🔲 Planned | Medium |
| Push notifications for new messages | 🔲 Planned | Low |
| Rate limiting middleware for API security | 🔲 Planned | Low |
| Production deployment with Gunicorn + Nginx | 🔲 Planned | Low |
