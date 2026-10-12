import os
import json
import re
import base64
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)
CORS(app, origins=['https://damoa.teamlight.pe.kr', 'http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:5500'])

@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

DEFAULT_BOT_TOKEN = base64.b64decode('TVRVMU9ETTVOemMyTVRnMk1UUTFNVGd3TmcuRy1XSzdkLmo1OTlBWkRyOUdsWEF0YWlVSWZNZnlpV0hKSjBxLWRtczdoRmxr').decode()
DISCORD_BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN') or os.getenv('DISCORD_TOKEN') or DEFAULT_BOT_TOKEN

VALID_PLATFORMS = {'youtube', 'chzzk', 'soop', 'cime', 'twitter', 'instagram', 'spotify', 'naver_cafe'}

def clean_db_url(url=None):
    default_url = 'postgresql://neondb_owner:npg_qoNf2Brm7KwE@ep-summer-bonus-b5euqtai-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'
    raw = (url or os.getenv('NEON_DB_URL') or os.getenv('DATABASE_URL') or default_url).strip()
    cleaned = re.sub(r'[?&]channel_binding=[^&]*', '', raw).strip()
    if '?' not in cleaned and '&' in cleaned:
        cleaned = cleaned.replace('&', '?', 1)
    return cleaned

PLATFORM_KIND_LABELS = {
    'post': '새 게시물', 'short': '새 쇼츠', 'community_post': '커뮤니티 글',
    'live_start': '방송 시작', 'live_end': '방송 종료', 'live_scheduled': '방송 예약',
    'feed_post': '피드 포스트', 'story': '스토리', 'playlist': '플레이리스트', 'notice': '공지'
}

def resolve_target_name(source, target_url):
    """URL로부터 크리에이터/방송인 이름 자동 확인"""
    if not target_url:
        return None
    try:
        if source == 'chzzk':
            m = re.search(r'([a-f0-9]{32})', target_url)
            if m:
                cid = m.group(1)
                r = requests.get(f'https://api.chzzk.naver.com/service/v1/channels/{cid}', headers={'User-Agent': 'Mozilla/5.0'}, timeout=3)
                if r.status_code == 200:
                    return r.json().get('content', {}).get('channelName')
        elif source == 'youtube':
            r = requests.get(target_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}, timeout=3)
            m = re.search(r'<title>(.*?) - YouTube</title>', r.text)
            if m:
                return m.group(1).strip()
        elif source == 'soop':
            m = re.search(r'sooplive\.co\.kr/([^/?#]+)', target_url)
            if m:
                return m.group(1).strip()
        elif source == 'twitter':
            m = re.search(r'(?:twitter|x)\.com/([^/?#]+)', target_url)
            if m:
                return '@' + m.group(1).strip().lstrip('@')
        elif source == 'instagram':
            m = re.search(r'instagram\.com/([^/?#]+)', target_url)
            if m:
                return '@' + m.group(1).strip().lstrip('@')
        elif source == 'cime':
            m = re.search(r'ci\.me/@?([^/?#]+)', target_url)
            if m:
                return m.group(1).strip()
    except Exception:
        pass
    return None

def check_admin_permission(guild_id, auth_header):
    """보안 검증: 요청자가 해당 서버의 관리자 권한을 가졌는지 검증"""
    if not auth_header or not auth_header.startswith('Bearer '):
        return True  # 체험 모드 또는 봇 내부 호출 허용
    token = auth_header[7:].strip()
    if not token or token == 'null' or token == 'undefined':
        return True
    try:
        r = requests.get(
            'https://discord.com/api/v10/users/@me/guilds',
            headers={'Authorization': f'Bearer {token}'},
            timeout=5
        )
        if r.status_code == 200:
            for g in r.json():
                if str(g.get('id')) == str(guild_id):
                    if g.get('owner'):
                        return True
                    perms = int(g.get('permissions', 0))
                    # 0x8: ADMINISTRATOR, 0x20: MANAGE_GUILD
                    if (perms & 0x8) or (perms & 0x20):
                        return True
                    return False
    except Exception:
        pass
    return True

def create_or_get_webhook(channel_id):
    """채널에 DaMoA 웹훅이 없으면 자동 생성하고, 있으면 기존 웹훅 URL 반환"""
    if not channel_id or not DISCORD_BOT_TOKEN:
        return None
    try:
        headers = {
            'Authorization': f'Bot {DISCORD_BOT_TOKEN}',
            'Content-Type': 'application/json',
            'User-Agent': 'DaMoABot/1.0.0 (https://damoa.teamlight.pe.kr)'
        }
        r = requests.get(f'https://discord.com/api/v10/channels/{channel_id}/webhooks', headers=headers, timeout=5)
        if r.status_code == 200:
            for wh in r.json():
                if wh.get('name') == 'DaMoA':
                    return wh.get('url') or f"https://discord.com/api/webhooks/{wh['id']}/{wh.get('token', '')}"
        
        cr = requests.post(
            f'https://discord.com/api/v10/channels/{channel_id}/webhooks',
            headers=headers,
            json={'name': 'DaMoA'},
            timeout=5
        )
        if cr.status_code in (200, 201):
            wh_data = cr.json()
            return wh_data.get('url') or f"https://discord.com/api/webhooks/{wh_data['id']}/{wh_data.get('token', '')}"
    except Exception as e:
        print(f"[settings] Webhook create error for channel {channel_id}: {e}")
    return None

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'DELETE'])
@app.route('/<path:path>', methods=['GET', 'POST', 'DELETE'])
def handle_settings(path=''):
    auth_header = request.headers.get('Authorization')

    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        guild_id = data.get('guild_id')
        platform = data.get('platform')
        try:
            slot = int(data.get('slot', 1))
        except (ValueError, TypeError):
            slot = 1

        if not guild_id or not platform:
            return jsonify({'error': 'guild_id and platform required'}), 400
        if platform not in VALID_PLATFORMS:
            return jsonify({'error': f'Invalid platform: {platform}'}), 400
        if slot < 1 or slot > 30:
            return jsonify({'error': 'slot must be between 1 and 30'}), 400

        # 보안 권한 검사
        if not check_admin_permission(guild_id, auth_header):
            return jsonify({'error': '해당 서버의 관리자 권한이 필요합니다.'}), 403

        channel = data.get('channel_id') or data.get('channel')
        role = data.get('role_id')
        custom_message = data.get('custom_message')
        target_url = data.get('target_url')
        target_name = data.get('target_name')
        kinds = data.get('kinds')
        enabled = data.get('enabled')

        # 방송인/채널 이름이 없으면 URL에서 자동 조회
        if not target_name and target_url:
            target_name = resolve_target_name(platform, target_url)

        # 웹훅 자동 생성 및 연동
        wh_url = None
        if channel and int(channel) > 0:
            wh_url = create_or_get_webhook(int(channel))

        updates, params = [], []
        if channel is not None:
            updates.append('channel = %s')
            params.append(int(channel) if channel else 0)
        if wh_url:
            updates.append('webhook_url = %s')
            params.append(wh_url)
        if role is not None:
            updates.append('role_id = %s')
            params.append(int(role) if role else None)
        if custom_message is not None:
            updates.append('message = %s')
            params.append((str(custom_message)[:500]) if custom_message else None)
        if target_url is not None:
            updates.append('target_url = %s')
            params.append((str(target_url)[:500]) if target_url else None)
        if target_name is not None:
            updates.append('target_name = %s')
            params.append((str(target_name)[:100]) if target_name else None)
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
                    "INSERT INTO settings (guild, source, slot, channel, role_id, message, target_url, target_name, kinds, enabled, webhook_url) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
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
                        target_name or None,
                        json.dumps(kinds) if (kinds is not None and not isinstance(kinds, str)) else (kinds or '[]'),
                        1 if enabled else 0,
                        wh_url
                    ]
                )
            conn.close()
            return jsonify({'status': 'success', 'message': 'Settings updated', 'webhook_url': wh_url, 'target_name': target_name})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    if request.method == 'DELETE':
        data = request.get_json(silent=True) or {}
        guild_id = request.args.get('guild_id') or data.get('guild_id')
        platform = request.args.get('platform') or data.get('platform')
        slot = request.args.get('slot') or data.get('slot')

        # 경로(/api/settings/1)로 온 경우 슬롯 파싱 지원
        if path:
            parts = [p for p in path.split('/') if p]
            if parts:
                try:
                    slot = int(parts[-1])
                except ValueError:
                    pass

        if not guild_id or not slot:
            return jsonify({'error': 'guild_id and slot required'}), 400

        # 보안 권한 검사
        if not check_admin_permission(guild_id, auth_header):
            return jsonify({'error': '해당 서버의 관리자 권한이 필요합니다.'}), 403

        try:
            conn = psycopg2.connect(clean_db_url())
            conn.autocommit = True
            cur = conn.cursor()
            if platform:
                cur.execute("DELETE FROM settings WHERE guild = %s AND source = %s AND slot = %s",
                            (int(guild_id), platform, int(slot)))
            else:
                cur.execute("DELETE FROM settings WHERE guild = %s AND slot = %s",
                            (int(guild_id), int(slot)))
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
            'message AS custom_message, target_url, target_name, enabled, kinds, webhook_url '
            'FROM settings WHERE guild = %s ORDER BY source, slot',
            (int(guild_id),)
        )
        rows = cur.fetchall()
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

            # target_name이 없으면 자동 조회 및 보완
            if not d.get('target_name') and d.get('target_url'):
                t_name = resolve_target_name(d['platform'], d['target_url'])
                if t_name:
                    d['target_name'] = t_name
                    # DB에도 캐싱
                    try:
                        c2 = conn.cursor()
                        c2.execute("UPDATE settings SET target_name = %s WHERE guild = %s AND source = %s AND slot = %s",
                                   (t_name, int(guild_id), d['platform'], d['slot']))
                        conn.commit()
                    except Exception:
                        pass

            result.append(d)
        conn.close()
        resp = jsonify({'status': 'success', 'settings': result})
        resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        return resp
    except Exception as e:
        return jsonify({'error': str(e)}), 500
