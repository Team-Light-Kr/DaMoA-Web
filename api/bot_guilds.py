import os
import json
import base64
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins='*')

DEFAULT_BOT_TOKEN = base64.b64decode('TVRVMU9ETTVOemMyTVRnMk1UUTFNVGd3TmcuRy1XSzdkLmo1OTlBWkRyOUdsWEF0YWlVSWZNZnlpV0hKSjBxLWRtczdoRmxr').decode()
DISCORD_BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN') or os.getenv('DISCORD_TOKEN') or DEFAULT_BOT_TOKEN
DISCORD_API_BASE = 'https://discord.com/api/v10'

@app.route('/', defaults={'path': ''}, methods=['GET'])
@app.route('/<path:path>', methods=['GET'])
def get_bot_guilds(path=''):
    guild_ids = set()
    # 1. Fetch live guilds from Discord API
    try:
        res = requests.get(
            f'{DISCORD_API_BASE}/users/@me/guilds?limit=200',
            headers={'Authorization': f'Bot {DISCORD_BOT_TOKEN}', 'User-Agent': 'Mozilla/5.0'},
            timeout=5
        )
        if res.status_code == 200:
            for g in res.json():
                guild_ids.add(str(g['id']))
    except Exception:
        pass

    # 2. Also check Neon DB
    try:
        import psycopg2
        neon_url = os.getenv('NEON_DB_URL') or os.getenv('DATABASE_URL') or 'postgresql://neondb_owner:npg_qoNf2Brm7KwE@ep-summer-bonus-b5euqtai-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
        conn = psycopg2.connect(neon_url)
        cur = conn.cursor()
        cur.execute('SELECT DISTINCT guild FROM settings')
        for r in cur.fetchall():
            guild_ids.add(str(r[0]))
        conn.close()
    except Exception:
        pass

    resp = jsonify({'status': 'success', 'guild_ids': list(guild_ids)})
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return resp
