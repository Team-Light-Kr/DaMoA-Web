import os
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
def get_roles(path=''):
    guild_id = request.args.get('guild_id')
    if request.headers.get('X-Demo') == '1' or request.args.get('demo') == '1':
        return jsonify({'status': 'success', 'roles': [
            {'id': '9001', 'name': '@헤비 알림'},
            {'id': '9002', 'name': '@방송 알림'}
        ]})
    if not guild_id:
        return jsonify({'status': 'success', 'roles': []})
    try:
        res = requests.get(
            f'{DISCORD_API_BASE}/guilds/{guild_id}/roles',
            headers={'Authorization': f'Bot {DISCORD_BOT_TOKEN}', 'User-Agent': 'DaMoABot/1.0.0 (https://damoa.teamlight.pe.kr)'},
            timeout=5
        )
        if res.status_code == 200:
            r_data = res.json()
            roles = [
                {'id': str(r['id']), 'name': r['name']}
                for r in r_data if r.get('name') != '@everyone'
            ]
            resp = jsonify({'status': 'success', 'roles': roles})
            resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            return resp
    except Exception:
        pass
    return jsonify({'status': 'success', 'roles': []})
