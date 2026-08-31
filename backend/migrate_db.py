import sqlite3

conn = sqlite3.connect('sql_app.db')
cursor = conn.cursor()

# Check existing columns
cursor.execute('PRAGMA table_info(interview_sessions)')
existing_cols = [row[1] for row in cursor.fetchall()]
print(f"Existing columns: {existing_cols}")

if 'evaluations' not in existing_cols:
    cursor.execute("ALTER TABLE interview_sessions ADD COLUMN evaluations VARCHAR NOT NULL DEFAULT '[]'")
    print("Added 'evaluations' column")
else:
    print("'evaluations' column already exists")

if 'answered_count' not in existing_cols:
    cursor.execute("ALTER TABLE interview_sessions ADD COLUMN answered_count INTEGER NOT NULL DEFAULT 0")
    print("Added 'answered_count' column")
else:
    print("'answered_count' column already exists")

if 'questions' not in existing_cols:
    cursor.execute("ALTER TABLE interview_sessions ADD COLUMN questions VARCHAR NOT NULL DEFAULT '[]'")
    print("Added 'questions' column")
else:
    print("'questions' column already exists")

conn.commit()

# Verify
cursor.execute('PRAGMA table_info(interview_sessions)')
print(f"Final columns: {[row[1] for row in cursor.fetchall()]}")
conn.close()
print("Migration complete!")
