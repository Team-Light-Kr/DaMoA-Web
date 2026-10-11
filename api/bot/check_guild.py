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
def check_bot_guild(path=''):
    guild_id = request.args.get('guild_id')
    if not guild_id:
        return jsonify({'status': 'error', 'message': 'guild_id required'}), 400

    try:
        res = requests.get(
            f'{DISCORD_API_BASE}/guilds/{guild_id}',
            headers={'Authorization': f'Bot {DISCORD_BOT_TOKEN}', 'User-Agent': 'DaMoABot/1.0.0 (https://damoa.teamlight.pe.kr)'},
            timeout=5
        )
        if res.status_code == 200:
            resp = jsonify({'status': 'success', 'present': True, 'guild_id': guild_id})
            resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            return resp
    except Exception:
        pass

    try:
        import psycopg2
        neon_url = os.getenv('NEON_DB_URL') or os.getenv('DATABASE_URL') or 'postgresql://neondb_owner:npg_qoNf2Brm7KwE@ep-summer-bonus-b5euqtai-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
        conn = psycopg2.connect(neon_url)
        cur = conn.cursor()
        cur.execute('SELECT 1 FROM settings WHERE guild=%s LIMIT 1', (guild_id,))
        row = cur.fetchone()
        conn.close()
        if row:
            resp = jsonify({'status': 'success', 'present': True, 'guild_id': guild_id})
            resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            return resp
    except Exception:
        pass

    resp = jsonify({'status': 'success', 'present': False, 'guild_id': guild_id})
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return resp
