import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app, origins='*')

DISCORD_CLIENT_ID = os.getenv('DISCORD_CLIENT_ID', '1558397761861451806')
DISCORD_CLIENT_SECRET = os.getenv('DISCORD_CLIENT_SECRET', '')
DISCORD_REDIRECT_URI = os.getenv('DISCORD_REDIRECT_URI', 'https://damoa.teamlight.pe.kr/auth/callback')
DISCORD_API_BASE = 'https://discord.com/api/v10'
DISCORD_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

@app.route('/', methods=['POST', 'GET'])
@app.route('/api/auth_code', methods=['POST', 'GET'])
def handler():
    data = request.get_json(silent=True) or {}
    code = data.get('code') or request.args.get('code')
    if not code:
        return jsonify({'error': '인증 코드가 필요합니다.'}), 400

    redirect_uri = data.get('redirect_uri') or DISCORD_REDIRECT_URI or 'https://damoa.teamlight.pe.kr/auth/callback'
    payload = {
        'client_id': DISCORD_CLIENT_ID,
        'client_secret': DISCORD_CLIENT_SECRET,
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirect_uri,
    }
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': DISCORD_USER_AGENT
    }
    try:
        resp = requests.post(f'{DISCORD_API_BASE}/oauth2/token', data=payload, headers=headers, timeout=10)
        if resp.status_code != 200:
            err = '토큰 교환 실패'
            try:
                err_body = resp.json()
                err = err_body.get('error_description') or err_body.get('error') or err
            except Exception:
                pass
            return jsonify({'error': err}), resp.status_code
        return jsonify(resp.json())
    except Exception as exc:
        return jsonify({'error': f'요청 실패: {exc}'}), 500
