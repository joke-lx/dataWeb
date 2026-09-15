import psycopg2

sql = open(r'D:\DevProjects\my\work\dataWeb\db_schema.sql', encoding='utf-8').read()
conn = psycopg2.connect(
    host='127.0.0.1', port=15432, dbname='dataweb',
    user='dataweb', password='1ee7465aebdb85bceb0101dd04dce346',
)
conn.autocommit = True
cur = conn.cursor()
cur.execute(sql)
print('Tables created')
cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
for r in cur.fetchall():
    print(' -', r[0])
