import sqlite3, time

db_path = r"c:/Users/Tanmay.Mondal/MyWorkSpace/myproject/mti-mindai-main/backend/data/webui.db"

db = sqlite3.connect(db_path)
db.execute(
    "UPDATE service SET status='coming-soon', updated_at=? WHERE id != 'chat-engine'",
    (int(time.time()),)
)
db.commit()

rows = db.execute("SELECT id, status FROM service").fetchall()
for row in rows:
    print(row)

db.close()
print("Done.")
