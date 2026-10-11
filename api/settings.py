import os
import json
import re
from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)
CORS(app, origins='*')

def clean_db_url(url=None):
    default_url = 'postgresql://neondb_owner:npg_qoNf2Brm7KwE@ep-summer-bonus-b5euqtai-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'
    raw = (url or os.getenv('NEON_DB_URL') or os.getenv('DATABASE_URL') or default_url).strip()
    # Strip channel_binding which causes "invalid channel_binding value: require " in libpq
    cleaned = re.sub(r'[?&]channel_binding=[^&]*', '', raw).strip()
    if '?' not in cleaned and '&' in cleaned:
        cleaned = cleaned.replace('&', '?', 1)
    return cleaned

PLATFORM_KIND_LABELS = {
    'post': '새 게시물', 'short': '새 쇼츠', 'community_post': '커뮤니티 글',
    'live_start': '방송 시작', 'live_end': '방송 종료', 'live_scheduled': '방송 예약',
    'feed_post': '피드 포스트', 'story': '스토리', 'playlist': '플레이리스트', 'notice': '공지'
}

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'DELETE'])
@app.route('/<path:path>', methods=['GET', 'POST', 'DELETE'])
def handle_settings(path=''):
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        guild_id = data.get('guild_id')
        platform = data.get('platform')
        slot = int(data.get('slot', 1))
        if not guild_id or not platform:
            return jsonify({'error': 'guild_id and platform required'}), 400
        
        channel = data.get('channel_id') or data.get('channel')
        role = data.get('role_id')
        custom_message = data.get('custom_message')
        target_url = data.get('target_url')
        kinds = data.get('kinds')
        enabled = data.get('enabled')

        updates, params = [], []
        if channel is not None:
            updates.append('channel = %s')
            params.append(int(channel) if channel else 0)
        if role is not None:
            updates.append('role_id = %s')
            params.append(int(role) if role else None)
        if custom_message is not None:
            updates.append('message = %s')
            params.append(custom_message or None)
        if target_url is not None:
            updates.append('target_url = %s')
            params.append(target_url or None)
        if kinds is not None:
            updates.append('kinds = %s')
            params.append(json.dumps(kinds) if not isinstance(kinds, str) else kinds)
        if enabled is not None:
            updates.append('enabled = %s')
            params.append(1 if enabled else 0)

        if not updates:
            return jsonify({'status': 'success', 'message': 'No changes'})

        try:
            conn = psycopg2.connect(clean_db_url())
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute(f"UPDATE settings SET {', '.join(updates)} WHERE guild = %s AND source = %s AND slot = %s",
                        params + [int(guild_id), platform, slot])
            if cur.rowcount == 0:
                cur.execute(
                    "INSERT INTO settings (guild, source, slot, channel, role_id, message, target_url, kinds, enabled) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) "
                    "ON CONFLICT (guild, source, slot) DO UPDATE SET " +
                    ', '.join([f"{u.split(' = ')[0]} = EXCLUDED.{u.split(' = ')[0]}" for u in updates]),
                    [
                        int(guild_id),
                        platform,
                        slot,
                        int(channel) if channel else 0,
                        int(role) if role else None,
                        custom_message or None,
                        target_url or None,
                        json.dumps(kinds) if (kinds is not None and not isinstance(kinds, str)) else (kinds or '[]'),
                        1 if enabled else 0
                    ]
                )
            conn.close()
            return jsonify({'status': 'success', 'message': 'Settings updated'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    if request.method == 'DELETE':
        guild_id = request.args.get('guild_id')
        slot = None
        if path:
            try:
                slot = int(path.split('/')[-1])
            except Exception:
                pass
        if not slot:
            slot = request.args.get('slot')
        if not guild_id or not slot:
            return jsonify({'error': 'guild_id and slot required'}), 400
        try:
            conn = psycopg2.connect(clean_db_url())
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute("DELETE FROM settings WHERE guild = %s AND slot = %s", (int(guild_id), int(slot)))
            conn.close()
            return jsonify({'status': 'success', 'message': 'Slot deleted'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # GET
    guild_id = request.args.get('guild_id')
    if not guild_id:
        return jsonify({'status': 'success', 'settings': []})
    try:
        conn = psycopg2.connect(clean_db_url())
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            'SELECT source AS platform, slot, channel AS channel_id, role_id, '
            'message AS custom_message, target_url, enabled, kinds '
            'FROM settings WHERE guild = %s ORDER BY source, slot',
            (int(guild_id),)
        )
        rows = cur.fetchall()
        conn.close()
        result = []
        for row in rows:
            d = dict(row)
            kinds_raw = d.get('kinds') or '[]'
            try:
                kinds = json.loads(kinds_raw) if isinstance(kinds_raw, str) else kinds_raw
            except Exception:
                kinds = []
            d['kinds'] = kinds
            d['kinds_labels'] = [PLATFORM_KIND_LABELS.get(k, k) for k in kinds]
            d['enabled'] = bool(d.get('enabled', 0))
            result.append(d)
        resp = jsonify({'status': 'success', 'settings': result})
        resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        return resp
    except Exception as e:
        return jsonify({'error': str(e)}), 500
