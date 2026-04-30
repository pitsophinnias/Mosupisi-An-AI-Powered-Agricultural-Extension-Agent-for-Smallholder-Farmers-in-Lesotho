# cleanup_notifications.py
# Run from: backend/mosupisi-notification-service
#   python cleanup_notifications.py
#
# Removes duplicate notifications — same farmer_id + title + type,
# keeping only the most recent one per group.

import sqlite3
import os

# Try common DB paths for the notification service
CANDIDATE_PATHS = [
    os.path.join(os.path.dirname(__file__), "notifications.db"),
    os.path.join(os.path.dirname(__file__), "app", "notifications.db"),
    os.path.join(os.path.dirname(__file__), "mosupisi_notifications.db"),
]

def find_db():
    for p in CANDIDATE_PATHS:
        if os.path.exists(p):
            return p
    # Search one level up
    parent = os.path.dirname(os.path.dirname(__file__))
    for f in os.listdir(parent):
        if f.endswith(".db"):
            return os.path.join(parent, f)
    return None


def main():
    db_path = find_db()
    if not db_path:
        print("Could not find notification database.")
        print("Checked:", CANDIDATE_PATHS)
        print("Run from the mosupisi-notification-service directory.")
        return

    print(f"Using database: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Check table name (may vary)
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall()]
    print(f"Tables found: {tables}")

    table = next((t for t in tables if "notif" in t.lower()), None)
    if not table:
        print("No notifications table found.")
        conn.close()
        return

    cur.execute(f"SELECT COUNT(*) FROM {table}")
    total = cur.fetchone()[0]
    print(f"\nTotal notifications: {total}\n")

    # Find duplicates: same farmer_id + title + type
    cur.execute(f"""
        SELECT farmer_id, title, type, COUNT(*) as cnt, MAX(id) as keep_id
        FROM {table}
        GROUP BY farmer_id, title, type
        HAVING cnt > 1
    """)
    dup_groups = cur.fetchall()

    if not dup_groups:
        print("No duplicates found — database is clean.")
        conn.close()
        return

    dupe_ids = []
    print(f"DUPLICATE GROUPS ({len(dup_groups)}):")
    for g in dup_groups:
        cur.execute(f"""
            SELECT id, title, type, severity, created_at
            FROM {table}
            WHERE farmer_id = ? AND title = ? AND type = ?
            ORDER BY id DESC
        """, (g['farmer_id'], g['title'], g['type']))
        rows = cur.fetchall()
        print(f"  farmer={g['farmer_id']} | {g['type']} | \"{g['title']}\" — {g['cnt']} copies:")
        for i, r in enumerate(rows):
            keep = "KEEP" if i == 0 else "DELETE"
            print(f"    [{keep}] ID {r['id']} | {r['severity']} | {r['created_at']}")
            if i > 0:
                dupe_ids.append(r['id'])

    print(f"\nWill delete {len(dupe_ids)} duplicate(s), keeping {len(dup_groups)} unique notification(s).")

    confirm = input("\nType 'yes' to proceed: ").strip().lower()
    if confirm != 'yes':
        print("Cancelled.")
        conn.close()
        return

    placeholders = ",".join("?" * len(dupe_ids))
    cur.execute(f"DELETE FROM {table} WHERE id IN ({placeholders})", dupe_ids)
    conn.commit()

    cur.execute(f"SELECT COUNT(*) FROM {table}")
    remaining = cur.fetchone()[0]
    print(f"\nDone. Deleted {len(dupe_ids)} duplicate(s). Remaining: {remaining}")
    conn.close()


if __name__ == "__main__":
    main()