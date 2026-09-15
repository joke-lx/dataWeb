import yaml, psycopg2

with open(r'D:\DevProjects\my\work\dataWeb\apps\api\app\real_data\registry.yaml', encoding='utf-8') as f:
    reg = yaml.safe_load(f)

conn = psycopg2.connect(
    host='127.0.0.1', port=15432, dbname='dataweb',
    user='dataweb', password='1ee7465aebdb85bceb0101dd04dce346',
)
conn.autocommit = True
cur = conn.cursor()

for s in reg['samples']:
    cur.execute("""
        INSERT INTO samples (id, tissue, breed, sex, individual, dev_stage, species, assembly)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            tissue=EXCLUDED.tissue, breed=EXCLUDED.breed, sex=EXCLUDED.sex,
            individual=EXCLUDED.individual, dev_stage=EXCLUDED.dev_stage
    """, (s['id'], s['tissue'], s['breed'], s['sex'], s['individual'],
          s.get('dev_stage', 'adult'), reg['species'], reg['assembly']))

cur.execute("SELECT count(*) FROM samples")
print(f"samples: {cur.fetchone()[0]} rows")
cur.execute("SELECT id, tissue, breed, sex, dev_stage FROM samples ORDER BY id LIMIT 10")
for r in cur.fetchall():
    print(' -', r)
