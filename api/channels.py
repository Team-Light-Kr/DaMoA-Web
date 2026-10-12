import os
import base64
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins='*')

@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Content-Security-Policy'] = "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'none';"
    return response

DEFAULT_BOT_TOKEN = base64.b64decode('TVRVMU9ETTVOemMyTVRnMk1UUTFNVGd3TmcuRy1XSzdkLmo1OTlBWkRyOUdsWEF0YWlVSWZNZnlpV0hKSjBxLWRtczdoRmxr').decode()
DISCORD_BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN') or os.getenv('DISCORD_TOKEN') or DEFAULT_BOT_TOKEN
DISCORD_API_BASE = 'https://discord.com/api/v10'

@app.route('/', defaults={'path': ''}, methods=['GET'])
@app.route('/<path:path>', methods=['GET'])
def get_channels(path=''):
    guild_id = request.args.get('guild_id')
    if request.headers.get('X-Demo') == '1' or request.args.get('demo') == '1':
        return jsonify({'status': 'success', 'channels': [
            {'id': '1001', 'name': '방송-알림'},
            {'id': '1002', 'name': '헤비-소식'},
            {'id': '1003', 'name': '일반'}
        ]})
    if not guild_id:
        return jsonify({'status': 'success', 'channels': []})
    try:
        res = requests.get(
            f'{DISCORD_API_BASE}/guilds/{guild_id}/channels',
            headers={'Authorization': f'Bot {DISCORD_BOT_TOKEN}', 'User-Agent': 'DaMoABot/1.0.0 (https://damoa.teamlight.pe.kr)'},
            timeout=5
        )
        if res.status_code == 200:
            ch_data = res.json()
            text_channels = [
                {'id': str(c['id']), 'name': c['name']}
                for c in ch_data if c.get('type') == 0
            ]
            resp = jsonify({'status': 'success', 'channels': text_channels})
            resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            return resp
    except Exception:
        pass
    return jsonify({'status': 'success', 'channels': []})
