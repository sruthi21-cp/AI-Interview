# AI Interview Simulator

A full-stack, AI-powered interview practice platform that simulates realistic technical, HR, behavioral, and mixed interview sessions. Candidates receive personalized questions tailored to their resume and target job description, practice with speech-to-text voice input and timed mode, and receive comprehensive evaluations, performance analytics, and downloadable PDF reports.

---

## Key Features

- **Authentication & Security:** Secure JWT token-based authentication, password hashing with bcrypt, protected routes, and user profile management (name and password updates).
- **Interview Customization:** Configure interview type (Technical, HR, Mixed, Behavioral), job role, experience level (Beginner, Intermediate, Advanced), difficulty (Easy, Medium, Hard), and question count (3, 5, 10, 15).
- **Resume & Job Description Tailoring:** Upload PDF resumes (up to 2 MiB) and paste target job descriptions (up to 2,000 characters) for tailored AI questions.
- **AI Question Generation & Resilient Fallback:** Automated batch question generation using Gemini/OpenAI with automatic graceful fallback to mock question templates if the external provider times out or fails.
- **Interactive Interview Room:** Live question progression, timed mode with countdown timer, and browser-native Web Speech API speech-to-text voice input.
- **AI Evaluation & Scoring:** Multi-dimensional feedback on every answer (overall score, correctness, relevance, technical depth, communication quality, strengths, and weaknesses).
- **PDF Report Export:** Download formatted, client-side rendered PDF interview evaluation reports using jsPDF and html2canvas.
- **Performance Analytics Dashboard:** Aggregated user metrics, performance trends over time, top strengths & weaknesses, and recent session history.

---

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons, Recharts, Axios, jsPDF, html2canvas, Web Speech API
- **Backend:** FastAPI, SQLAlchemy, SQLite (default) / PostgreSQL, Pydantic v2, Python-Jose (JWT), Passlib (Bcrypt), Pdfminer.six, Requests
- **Testing:** Comprehensive end-to-end regression suite (`regression_test.py`, 123 automated assertions)

---

## Project Structure

```text
AI-Interview/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI routers (auth, health, interviews) & dependencies
│   │   ├── core/            # Database engine, JWT security, environment config
│   │   ├── models/          # SQLAlchemy models (User, InterviewSession)
│   │   ├── schemas/         # Pydantic schemas for requests and responses
│   │   ├── services/        # Business logic: Auth, InterviewEngine, AI Provider
│   │   └── utils/           # Helper utilities (PDF text extraction)
│   └── .env                 # Backend environment configuration
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components (Button, cards, score rings)
│   │   ├── hooks/           # Custom React hooks (useSpeechRecognition, useAuth)
│   │   ├── layouts/         # MainLayout and AuthLayout
│   │   ├── pages/           # Dashboard, Setup, Room, Evaluation, Profile, Auth
│   │   ├── routes/          # Protected and public route configuration
│   │   └── services/        # Axios API client and backend service wrappers
└── regression_test.py       # 123-test automated end-to-end regression test suite
```

---

## Getting Started

### 1. Backend Setup

1. Navigate to `backend/`:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure `.env`:
   ```ini
   PROJECT_NAME="AI Interview Simulator"
   SECRET_KEY="your-secret-key"
   DATABASE_URL="sqlite:///./sql_app.db"
   AI_PROVIDER=mock  # Options: mock, gemini, openai
   AI_API_KEY=your_api_key_here
   ```
5. Start the FastAPI server:
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```

### 2. Frontend Setup

1. Navigate to `frontend/`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser at `http://localhost:5173`.

---

## Running Tests

Run the complete 123-assertion end-to-end regression test suite against a running backend:

```bash
# Set AI_PROVIDER=mock in backend/.env or run with mock provider
python regression_test.py
```
