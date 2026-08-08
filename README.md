# AI Interview Simulator

A clean, modular foundation for the AI Interview Simulator web application MVP.

## Tech Stack

- **Frontend**: React (Vite, Tailwind CSS, React Router, Axios)
- **Backend**: FastAPI, SQLAlchemy, PostgreSQL, JWT Authentication

## Project Structure

```
AI-Interview/
├── frontend/             # React + Vite frontend
└── backend/              # FastAPI backend
```

## Running the Project

Refer to the README instructions in the `frontend` and `backend` directories (or below) to run the services.

### Backend

1. Navigate to `backend/`
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Unix/macOS:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy `.env.example` to `.env` and configure environment variables.
5. Run the server:
   ```bash
   python -m uvicorn app.main:app --reload
   ```

### Frontend

1. Navigate to `frontend/`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
