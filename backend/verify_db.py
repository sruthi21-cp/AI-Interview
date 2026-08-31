import sqlite3, json

conn = sqlite3.connect('sql_app.db')
c = conn.cursor()

# Check session 19
c.execute('SELECT id, user_id, job_role, interview_type, experience_level, difficulty, question_count, status, answered_count, created_at, completed_at FROM interview_sessions WHERE id = 19')
row = c.fetchone()
cols = ['id', 'user_id', 'job_role', 'interview_type', 'experience_level', 'difficulty', 'question_count', 'status', 'answered_count', 'created_at', 'completed_at']
print('=== SESSION 19 ===')
for col, val in zip(cols, row):
    print(f'  {col}: {val}')

# Check questions
c.execute('SELECT questions FROM interview_sessions WHERE id = 19')
questions = json.loads(c.fetchone()[0])
print(f'\n=== QUESTIONS ({len(questions)} total) ===')
for i, q in enumerate(questions, 1):
    is_mock = '[Mock' in q
    print(f'  Q{i}: {q[:100]}... [mock={is_mock}]')

# Check evaluations
c.execute('SELECT evaluations FROM interview_sessions WHERE id = 19')
evals = json.loads(c.fetchone()[0])
print(f'\n=== EVALUATIONS ({len(evals)} total) ===')
for i, e in enumerate(evals, 1):
    score = e.get("score", "?")
    fb = e.get("feedback", "")[:60]
    print(f'  E{i}: score={score}/10 | feedback={fb}...')

# Check unique questions
unique_qs = set(questions)
print(f'\n=== INTEGRITY ===')
print(f'  Total questions: {len(questions)}')
print(f'  Unique questions: {len(unique_qs)}')
print(f'  Has duplicates: {len(unique_qs) < len(questions)}')
print(f'  Total evaluations: {len(evals)}')
print(f'  All evals have scores: {all("score" in e for e in evals)}')
print(f'  All evals have feedback: {all("feedback" in e for e in evals)}')
print(f'  Session status: {row[7]}')
print(f'  Answered count matches: {row[8]} == {len(evals)} -> {row[8] == len(evals)}')

conn.close()
