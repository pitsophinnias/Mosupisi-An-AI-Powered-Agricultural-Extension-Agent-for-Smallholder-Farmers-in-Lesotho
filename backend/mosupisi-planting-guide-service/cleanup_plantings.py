# cleanup_plantings.py
# Run from: backend/mosupisi-planting-guide-service
#   python cleanup_plantings.py
#
# Removes:
#   1. Plantings created by integration tests (location = "Maseru"/"Leribe" with
#      area = "1 hectare"/"2 hectares" and notes = "New planting")
#   2. Duplicate plantings — same crop + location + plantingDate, keep newest
#
# Shows a preview before deleting — you confirm before anything is removed.

import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "planting.db")

def main():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # ── Show current state ─────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM plantings")
    total = cur.fetchone()[0]
    print(f"\nCurrent plantings in DB: {total}")
    print()

    # ── Identify test plantings ────────────────────────────────────────────
    # Tests create plantings with these exact values
    test_conditions = """
        (notes = 'New planting' AND area IN ('1 hectare', '2 hectares', '1 ha', '2 ha'))
        OR (notes = 'New planting' AND location IN ('Maseru', 'Leribe', 'Butha-Buthe'))
    """
    cur.execute(f"SELECT id, crop, location, area, notes, plantingDate, createdAt FROM plantings WHERE {test_conditions} ORDER BY createdAt DESC")
    test_rows = cur.fetchall()

    print(f"TEST PLANTINGS to remove ({len(test_rows)}):")
    for r in test_rows:
        print(f"  ID {r['id']:>4} | {r['crop']:<10} | {r['location']:<15} | {r['area']:<15} | {r['notes']:<20} | planted {r['plantingDate']}")

    print()

    # ── Identify duplicates ────────────────────────────────────────────────
    # Same crop + location + plantingDate — keep the one with the highest id
    cur.execute("""
        SELECT crop, location, plantingDate, COUNT(*) as cnt, MIN(id) as oldest_id
        FROM plantings
        GROUP BY crop, location, plantingDate
        HAVING cnt > 1
    """)
    dup_groups = cur.fetchall()

    dupe_ids = []
    print(f"DUPLICATE GROUPS ({len(dup_groups)}):")
    for g in dup_groups:
        cur.execute("""
            SELECT id, crop, location, plantingDate, createdAt, notes
            FROM plantings
            WHERE crop = ? AND location = ? AND plantingDate = ?
            ORDER BY id DESC
        """, (g['crop'], g['location'], g['plantingDate']))
        dupes = cur.fetchall()
        print(f"  {g['crop']} @ {g['location']} planted {g['plantingDate']} — {g['cnt']} copies:")
        for i, d in enumerate(dupes):
            keep = "KEEP" if i == 0 else "DELETE"
            print(f"    [{keep}] ID {d['id']} | created {d['createdAt']} | {d['notes']}")
            if i > 0:
                dupe_ids.append(d['id'])

    print()

    # ── Summary ───────────────────────────────────────────────────────────
    test_ids = [r['id'] for r in test_rows]
    all_ids_to_delete = list(set(test_ids + dupe_ids))

    if not all_ids_to_delete:
        print("Nothing to delete — database looks clean.")
        conn.close()
        return

    print(f"SUMMARY: Will delete {len(all_ids_to_delete)} planting(s)")
    print(f"  Test plantings: {len(test_ids)}")
    print(f"  Duplicates:     {len(dupe_ids)}")
    print(f"  Remaining after cleanup: {total - len(all_ids_to_delete)}")
    print()

    # ── Confirm ───────────────────────────────────────────────────────────
    confirm = input("Type 'yes' to proceed with deletion, anything else to cancel: ").strip().lower()
    if confirm != 'yes':
        print("Cancelled — no changes made.")
        conn.close()
        return

    # ── Delete ────────────────────────────────────────────────────────────
    placeholders = ",".join("?" * len(all_ids_to_delete))
    cur.execute(f"DELETE FROM plantings WHERE id IN ({placeholders})", all_ids_to_delete)

    # Also clean up orphaned action logs for deleted plantings
    cur.execute(f"""
        DELETE FROM action_logs
        WHERE planting_id IN ({placeholders})
    """, all_ids_to_delete)

    conn.commit()

    cur.execute("SELECT COUNT(*) FROM plantings")
    remaining = cur.fetchone()[0]
    print(f"\nDone. Deleted {len(all_ids_to_delete)} planting(s). Remaining: {remaining}")
    conn.close()


if __name__ == "__main__":
    main()