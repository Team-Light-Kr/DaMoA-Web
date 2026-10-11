import os
import json
from functools import wraps
from pathlib import Path
from flask import Flask, jsonify, request, redirect
from flask_cors import CORS
from dotenv import load_dotenv
import requests
import base64

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'damoa-secret-key-change-in-prod')
CORS(app, origins='*')

# Discord OAuth2 Configuration
DISCORD_CLIENT_ID = os.getenv('DISCORD_CLIENT_ID', '1558397761861451806')
DISCORD_CLIENT_SECRET = os.getenv('DISCORD_CLIENT_SECRET', '')
DISCORD_REDIRECT_URI = os.getenv('DISCORD_REDIRECT_URI', 'https://damoa.teamlight.pe.kr/auth/callback')
DISCORD_API_BASE = 'https://discord.com/api/v10'

# Database configuration
DEFAULT_NEON_DB_URL = 'postgresql://neondb_owner:npg_qoNf2Brm7KwE@ep-summer-bonus-b5euqtai-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
NEON_DB_URL = os.getenv('NEON_DB_URL') or os.getenv('DATABASE_URL') or DEFAULT_NEON_DB_URL
USE_NEON = bool(NEON_DB_URL)

# Bot Token configuration
DEFAULT_BOT_TOKEN = base64.b64decode('TVRVMU9ETTVOemMyTVRnMk1UUTFNVGd3TmcuRy1XSzdkLmo1OTlBWkRyOUdsWEF0YWlVSWZNZnlpV0hKSjBxLWRtczdoRmxr').decode()
DISCORD_BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN') or os.getenv('DISCORD_TOKEN') or DEFAULT_BOT_TOKEN

DISCORD_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
_http_session = requests.Session()

# Platform metadata
PLATFORM_META = {
    'youtube':    {'name': 'YouTube',     'color': '#FF0000', 'icon': 'fab fa-youtube'},
    'chzzk':      {'name': '치지직',      'color': '#00FFA3', 'icon': 'fas fa-broadcast-tower'},
    'soop':       {'name': 'SOOP',        'color': '#0C8CE9', 'icon': 'fas fa-broadcast-tower'},
    'cime':       {'name': '씨미',        'color': '#7B4EFF', 'icon': 'fas fa-microphone'},
    'twitter':    {'name': 'X (Twitter)', 'color': '#000000', 'icon': 'fab fa-x-twitter'},
    'instagram':  {'name': 'Instagram',   'color': '#E1306C', 'icon': 'fab fa-instagram'},
    'spotify':    {'name': 'Spotify',     'color': '#1DB954', 'icon': 'fab fa-spotify'},
    'naver_cafe': {'name': '네이버 카페', 'color': '#03C75A', 'icon': 'fas fa-coffee'},
}

PLATFORM_KINDS = {
    'youtube':    ['post', 'short', 'community_post', 'live_start', 'live_end', 'live_scheduled'],
    'chzzk':      ['live_start', 'live_end', 'live_scheduled'],
    'soop':       ['live_start', 'live_end', 'live_scheduled'],
    'cime':       ['live_start', 'live_end', 'live_scheduled'],
    'twitter':    ['post'],
    'instagram':  ['feed_post', 'story'],
    'spotify':    ['post', 'playlist'],
    'naver_cafe': ['post', 'notice'],
}

PLATFORM_KIND_LABELS = {
    'post': '새 게시물',
    'short': '새 쇼츠',
    'community_post': '커뮤니티 글',
    'live_start': '방송 시작',
    'live_end': '방송 종료',
    'live_scheduled': '방송 예약',
    'feed_post': '피드 포스트',
    'story': '스토리',
    'playlist': '플레이리스트',
    'notice': '공지',
}


def get_db_connection():
    if USE_NEON and NEON_DB_URL:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        conn = psycopg2.connect(NEON_DB_URL)
        conn.autocommit = True
        return conn, True
    else:
        # Fallback sqlite if running locally
        import sqlite3
        db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'damoa.sqlite3')
        if not os.path.exists(db_path):
            db_path = 'damoa.sqlite3'
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn, False


def discord_headers(token=None, is_bot=False):
    ua = 'DaMoABot/1.0.0 (https://damoa.teamlight.pe.kr)' if is_bot else DISCORD_USER_AGENT
    h = {'User-Agent': ua}
    if token:
        prefix = 'Bot ' if is_bot else 'Bearer '
        h['Authorization'] = prefix + token
    return h


def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Demo mode
        if request.args.get('demo') == '1' or request.headers.get('X-Demo') == '1':
            request.user = {
                'id': '000000000000000001',
                'username': '체험 사용자',
                'discriminator': '0000',
                'avatar': None,
                'demo': True,
            }
            return f(*args, **kwargs)

        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized'}), 401

        token = auth_header[7:]
        try:
            user_response = _http_session.get(
                f'{DISCORD_API_BASE}/users/@me',
                headers=discord_headers(token),
                timeout=5,
            )
            if user_response.status_code != 200:
                return jsonify({'error': 'Invalid token'}), 401

            request.user = user_response.json()
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': f'Auth verification failed: {e}'}), 401
    return decorated_function


@app.route('/api/users/@me', methods=['GET'])
@require_auth
def get_user_me():
    return jsonify(request.user)


@app.route('/api/users/@me/guilds', methods=['GET'])
@require_auth
def get_user_me_guilds():
    if request.user.get('demo'):
        return jsonify([
            {'id': '100000000000000001', 'name': '데모 서버 1', 'icon': None, 'owner': True,
             'permissions': '8', 'features': []},
        ])

    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    token = auth_header[7:]
    try:
        res = _http_session.get(f'{DISCORD_API_BASE}/users/@me/guilds', headers=discord_headers(token), timeout=5)
        if res.status_code == 200:
            return jsonify(res.json()), 200
        return jsonify({'error': 'Failed to fetch user guilds'}), res.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/bot/guilds', methods=['GET'])
def get_bot_guilds():
    """Get list of guild IDs where DaMoA bot is present"""
    bot_token = DISCORD_BOT_TOKEN
    guild_ids = set()

    # 1. Fetch live guilds from Discord API if bot token is configured
    if bot_token:
        try:
            res = _http_session.get(
                f'{DISCORD_API_BASE}/users/@me/guilds?limit=200',
                headers=discord_headers(bot_token, is_bot=True),
                timeout=5
            )
            if res.status_code == 200:
                for g in res.json():
                    guild_ids.add(str(g['id']))
        except Exception as e:
            app.logger.warning(f"Error fetching bot guilds from Discord API: {e}")

    # 2. Also include any guilds with existing records in DB
    try:
        conn, use_neon = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT DISTINCT guild FROM settings')
        rows = cursor.fetchall()
        conn.close()
        for r in rows:
            if isinstance(r, dict):
                guild_ids.add(str(r.get('guild')))
            else:
                guild_ids.add(str(r[0]))
    except Exception:
        pass

    resp = jsonify({'status': 'success', 'guild_ids': list(guild_ids)})
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return resp



@app.route('/api/bot/check_guild', methods=['GET'])
def check_bot_guild():
    """Check if bot is specifically present in a given guild"""
    guild_id = request.args.get('guild_id')
    if not guild_id:
        return jsonify({'status': 'error', 'message': 'guild_id required'}), 400

    bot_token = DISCORD_BOT_TOKEN
    if bot_token:
        try:
            res = _http_session.get(
                f'{DISCORD_API_BASE}/guilds/{guild_id}',
                headers=discord_headers(bot_token, is_bot=True),
                timeout=5
            )
            if res.status_code == 200:
                return jsonify({'status': 'success', 'present': True, 'guild_id': guild_id})
        except Exception as e:
            app.logger.warning(f"Error checking guild {guild_id}: {e}")

    try:
        conn, use_neon = get_db_connection()
        cursor = conn.cursor()
        if use_neon:
            cursor.execute('SELECT 1 FROM settings WHERE guild=%s LIMIT 1', (guild_id,))
        else:
            cursor.execute('SELECT 1 FROM settings WHERE guild=? LIMIT 1', (guild_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return jsonify({'status': 'success', 'present': True, 'guild_id': guild_id})
    except Exception:
        pass

    return jsonify({'status': 'success', 'present': False, 'guild_id': guild_id})


@app.route('/api/settings', methods=['GET'])
@require_auth
def get_settings():
    """Get notification settings for a guild"""
    guild_id = request.args.get('guild_id')
    is_demo = request.user.get('demo', False)

    if is_demo:
        return jsonify({
            'status': 'success',
            'settings': [
                {
                    'platform': 'cime', 'slot': 1, 'channel_id': '1001',
                    'channel_name': '방송-알림', 'role_id': None, 'custom_message': None,
                    'target_url': 'https://ci.me/@demo', 'enabled': True,
                    'kinds': ['live_start', 'live_end', 'live_scheduled'],
                    'kinds_labels': ['방송 시작', '방송 종료', '방송 예약'],
                },
                {
                    'platform': 'youtube', 'slot': 1, 'channel_id': '1002',
                    'channel_name': '헤비-소식', 'role_id': None, 'custom_message': None,
                    'target_url': 'https://www.youtube.com/@hebich', 'enabled': True,
                    'kinds': ['post', 'short', 'live_start', 'live_end'],
                    'kinds_labels': ['새 영상', '새 쇼츠', '방송 시작', '방송 종료'],
                },
                {
                    'platform': 'chzzk', 'slot': 1, 'channel_id': '1001',
                    'channel_name': '방송-알림', 'role_id': None, 'custom_message': None,
                    'target_url': 'https://chzzk.naver.com/live/demo', 'enabled': True,
                    'kinds': ['live_start', 'live_end', 'live_scheduled'],
                    'kinds_labels': ['방송 시작', '방송 종료', '방송 예약'],
                },
            ]
        })

    if not guild_id:
        return jsonify({'error': 'guild_id is required'}), 400

    try:
        conn, use_neon = get_db_connection()
        if use_neon:
            from psycopg2.extras import RealDictCursor
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                'SELECT source AS platform, slot, channel AS channel_id, role_id, '
                'message AS custom_message, target_url, enabled, kinds '
                'FROM settings WHERE guild = %s ORDER BY source, slot',
                (int(guild_id),)
            )
        else:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT source AS platform, slot, channel AS channel_id, role_id, '
                'message AS custom_message, target_url, enabled, kinds '
                'FROM settings WHERE guild = ? ORDER BY source, slot',
                (int(guild_id),)
            )

        rows = cursor.fetchall()
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

        return jsonify({'status': 'success', 'settings': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings', methods=['POST'])
@require_auth
def update_settings():
    """Update a single notification slot setting"""
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    is_demo = request.user.get('demo', False)
    if is_demo:
        return jsonify({'status': 'success', 'message': '체험 모드: 실제 서버에는 저장되지 않습니다'})

    guild_id = data.get('guild_id')
    platform = data.get('platform')
    slot = int(data.get('slot', 1))
    channel = data.get('channel_id') or data.get('channel')
    role = data.get('role_id')
    custom_message = data.get('custom_message')
    kinds = data.get('kinds')
    enabled = data.get('enabled')

    if not guild_id or not platform:
        return jsonify({'error': 'guild_id and platform are required'}), 400

    try:
        conn, use_neon = get_db_connection()
        cursor = conn.cursor()
        updates = []
        params = []

        if channel is not None:
            updates.append('channel = %s' if use_neon else 'channel = ?')
            params.append(int(channel))
        if role is not None:
            updates.append('role_id = %s' if use_neon else 'role_id = ?')
            params.append(int(role) if role else None)
        if custom_message is not None:
            updates.append('message = %s' if use_neon else 'message = ?')
            params.append(custom_message or None)
        if kinds is not None:
            updates.append('kinds = %s' if use_neon else 'kinds = ?')
            params.append(json.dumps(kinds))
        if enabled is not None:
            updates.append('enabled = %s' if use_neon else 'enabled = ?')
            params.append(int(enabled))

        if not updates:
            conn.close()
            return jsonify({'status': 'success', 'message': 'No changes'})

        if use_neon:
            cursor.execute(
                f"UPDATE settings SET {', '.join(updates)} WHERE guild = %s AND source = %s AND slot = %s",
                params + [int(guild_id), platform, slot]
            )
        else:
            cursor.execute(
                f"UPDATE settings SET {', '.join(updates)} WHERE guild = ? AND source = ? AND slot = ?",
                params + [int(guild_id), platform, slot]
            )
            conn.commit()

        conn.close()
        return jsonify({'status': 'success', 'message': 'Settings updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/status', methods=['GET'])
def get_status():
    """Get global status board across ALL servers (not per-guild notification-based)"""
    try:
        conn, use_neon = get_db_connection()
        if use_neon:
            from psycopg2.extras import RealDictCursor
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute('''
                SELECT
                    source,
                    COUNT(*) AS total_slots,
                    COUNT(DISTINCT guild) AS total_guilds,
                    COUNT(DISTINCT target_url) AS unique_targets,
                    SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS active_slots
                FROM settings
                WHERE target_url IS NOT NULL AND target_url != ''
                GROUP BY source
                ORDER BY source
            ''')
        else:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT
                    source,
                    COUNT(*) AS total_slots,
                    COUNT(DISTINCT guild) AS total_guilds,
                    COUNT(DISTINCT target_url) AS unique_targets,
                    SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS active_slots
                FROM settings
                WHERE target_url IS NOT NULL AND target_url != ''
                GROUP BY source
                ORDER BY source
            ''')

        rows = cursor.fetchall()

        cursor.execute('SELECT COUNT(*) FROM settings WHERE enabled = 1')
        total_active_row = cursor.fetchone()
        total_active = (list(total_active_row.values())[0] if isinstance(total_active_row, dict) else total_active_row[0]) if total_active_row else 0

        cursor.execute('SELECT COUNT(DISTINCT guild) FROM settings')
        total_guilds_row = cursor.fetchone()
        total_guilds = (list(total_guilds_row.values())[0] if isinstance(total_guilds_row, dict) else total_guilds_row[0]) if total_guilds_row else 0

        conn.close()

        result = []
        for row in rows:
            d = dict(row)
            src = d.get('source', '')
            meta = PLATFORM_META.get(src, {'name': src, 'color': '#888', 'icon': 'fas fa-bell'})
            result.append({
                'platform': src,
                'name': meta['name'],
                'color': meta['color'],
                'icon': meta['icon'],
                'total_guilds': d.get('total_guilds', 0),
                'total_slots': d.get('total_slots', 0),
                'unique_targets': d.get('unique_targets', 0),
                'active_slots': d.get('active_slots', 0),
            })

        return jsonify({
            'status': 'success',
            'platforms': result,
            'total_active_notifications': total_active,
            'total_servers': total_guilds,
        })
    except Exception:
        return jsonify({'status': 'success', 'platforms': [], 'total_active_notifications': 0, 'total_servers': 0})


@app.route('/api/platforms', methods=['GET'])
def get_platforms():
    """Get available platforms and their supported notification kinds"""
    result = []
    for pid, meta in PLATFORM_META.items():
        result.append({
            'id': pid,
            'name': meta['name'],
            'color': meta['color'],
            'icon': meta['icon'],
            'kinds': PLATFORM_KINDS.get(pid, []),
            'kind_labels': {k: PLATFORM_KIND_LABELS.get(k, k) for k in PLATFORM_KINDS.get(pid, [])},
        })
    return jsonify({'status': 'success', 'platforms': result})


@app.route('/api/channels', methods=['GET'])
@require_auth
def get_channels():
    """Get Discord text channels for a guild"""
    is_demo = request.user.get('demo', False)
    guild_id = request.args.get('guild_id')

    if is_demo:
        return jsonify({'status': 'success', 'channels': [
            {'id': '1001', 'name': '방송-알림'},
            {'id': '1002', 'name': '헤비-소식'},
            {'id': '1003', 'name': '일반'},
        ]})

    bot_token = DISCORD_BOT_TOKEN
    if guild_id and bot_token:
        try:
            res = _http_session.get(
                f'{DISCORD_API_BASE}/guilds/{guild_id}/channels',
                headers=discord_headers(bot_token, is_bot=True),
                timeout=5
            )
            if res.status_code == 200:
                ch_data = res.json()
                text_channels = [
                    {'id': str(c['id']), 'name': c['name']}
                    for c in ch_data if c.get('type') == 0
                ]
                return jsonify({'status': 'success', 'channels': text_channels})
        except Exception as e:
            print(f"Error fetching guild channels: {e}")

    return jsonify({'status': 'success', 'channels': []})


@app.route('/api/roles', methods=['GET'])
@require_auth
def get_roles():
    """Get Discord roles for a guild"""
    is_demo = request.user.get('demo', False)
    guild_id = request.args.get('guild_id')

    if is_demo:
        return jsonify({'status': 'success', 'roles': [
            {'id': '9001', 'name': '@헤비 알림'},
            {'id': '9002', 'name': '@방송 알림'},
        ]})

    bot_token = DISCORD_BOT_TOKEN
    if guild_id and bot_token:
        try:
            res = _http_session.get(
                f'{DISCORD_API_BASE}/guilds/{guild_id}/roles',
                headers=discord_headers(bot_token, is_bot=True),
                timeout=5
            )
            if res.status_code == 200:
                role_data = res.json()
                roles = [
                    {'id': str(r['id']), 'name': r['name']}
                    for r in role_data if r.get('name') != '@everyone'
                ]
                return jsonify({'status': 'success', 'roles': roles})
        except Exception as e:
            print(f"Error fetching guild roles: {e}")

    return jsonify({'status': 'success', 'roles': []})


@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Get global metrics (for status board)"""
    try:
        conn, use_neon = get_db_connection()
        cursor = conn.cursor()

        def fetchone_val(q):
            cursor.execute(q)
            row = cursor.fetchone()
            if row is None:
                return 0
            return list(row.values())[0] if isinstance(row, dict) else row[0]

        total_settings = fetchone_val('SELECT COUNT(*) FROM settings WHERE enabled = 1')
        total_targets = fetchone_val("SELECT COUNT(DISTINCT target_url) FROM settings WHERE target_url IS NOT NULL AND target_url != ''")
        total_guilds = fetchone_val('SELECT COUNT(DISTINCT guild) FROM settings')
        conn.close()

        return jsonify({
            'status': 'success',
            'metrics': {
                'active_notifications': total_settings,
                'unique_targets': total_targets,
                'total_servers': total_guilds,
                'delivered_total': total_settings,
            }
        })
    except Exception:
        return jsonify({'status': 'success', 'metrics': {
            'active_notifications': 0,
            'unique_targets': 0,
            'total_servers': 0,
            'delivered_total': 0,
        }})


@app.route('/api/auth_code', methods=['POST'])
@app.route('/auth_code', methods=['POST'])
def exchange_auth_code():
    """Exchange Discord OAuth2 authorization code for access token via JSON API"""
    data = request.json or {}
    code = data.get('code')
    if not code:
        return jsonify({'error': '인증 코드가 누락되었습니다.'}), 400

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
        response = _http_session.post(f'{DISCORD_API_BASE}/oauth2/token', data=payload, headers=headers, timeout=10)
    except Exception as e:
        return jsonify({'error': f'Discord API 연결 오류: {e}'}), 500

    if response.status_code != 200:
        err_msg = '토큰 교환 실패'
        try:
            err_json = response.json()
            err_msg = err_json.get('error_description') or err_json.get('error') or err_msg
        except Exception:
            pass
        return jsonify({'error': err_msg}), response.status_code

    token_data = response.json()
    return jsonify({
        'access_token': token_data.get('access_token'),
        'token_type': token_data.get('token_type', 'Bearer'),
        'expires_in': token_data.get('expires_in'),
    })


@app.route('/auth/callback')
@app.route('/api/auth/callback')
def auth_callback():
    """Handle Discord OAuth2 callback"""
    code = request.args.get('code')
    if not code:
        return redirect('/')

    # Determine redirect_uri dynamically if not set
    redirect_uri = DISCORD_REDIRECT_URI
    if not redirect_uri:
        redirect_uri = request.host_url.rstrip('/') + '/auth/callback'
        # ensure https
        if redirect_uri.startswith('http://') and 'localhost' not in redirect_uri and '127.0.0.1' not in redirect_uri:
            redirect_uri = 'https://' + redirect_uri[7:]

    data = {
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
        response = _http_session.post(f'{DISCORD_API_BASE}/oauth2/token', data=data, headers=headers, timeout=10)
    except Exception:
        return redirect('/#login_error')

    if response.status_code != 200:
        return redirect('/#login_error')

    token_data = response.json()
    access_token = token_data.get('access_token')

    return redirect(f'/#access_token={access_token}&token_type={token_data.get("token_type", "Bearer")}')



@app.route('/invite', methods=['GET'])
@app.route('/api/invite', methods=['GET'])
def bot_invite():
    guild_id = request.args.get('guild_id', '')
    invite_url = (
        'https://discord.com/oauth2/authorize'
        f'?client_id={DISCORD_CLIENT_ID}'
        '&permissions=8'
        '&scope=bot%20applications.commands'
    )
    if guild_id:
        invite_url += f'&guild_id={guild_id}'
    return redirect(invite_url)


@app.route('/api/test_notify', methods=['POST'])
@require_auth
def test_notify():
    data = request.get_json() or {}
    guild_id = data.get('guild_id')
    platform = data.get('platform', 'chzzk')
    if not guild_id:
        return jsonify({'error': 'guild_id required'}), 400
    if platform not in PLATFORM_META:
        return jsonify({'error': f'Unknown platform: {platform}'}), 400
    try:
        conn, use_neon = get_db_connection()
        cursor = conn.cursor()
        if use_neon:
            cursor.execute("SELECT channel, webhook_url FROM settings WHERE guild=%s AND source=%s AND enabled=true LIMIT 3", (guild_id, platform))
        else:
            cursor.execute("SELECT channel, webhook_url FROM settings WHERE guild=? AND source=? AND enabled=1 LIMIT 3", (guild_id, platform))
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        return jsonify({'error': f'DB error: {e}'}), 500
    if not rows:
        pname = PLATFORM_META[platform]["name"]
        return jsonify({'error': f'{pname} 플랫폼의 설정된 채널이 없습니다.', 'code': 'no_settings'}), 404
    platform_name = PLATFORM_META[platform]["name"]
    platform_color = int(PLATFORM_META[platform]["color"].lstrip("#"), 16)
    from datetime import datetime, timezone, timedelta
    now_kst = datetime.now(timezone(timedelta(hours=9)))
    time_str = now_kst.strftime("%Y.%m.%d %H:%M:%S")
    payload = {
        "flags": 1 << 15,
        "components": [{"type": 17, "accent_color": platform_color, "components": [
            {"type": 10, "content": "**DaMoA 테스트**\n-# " + time_str + " · " + platform_name},
            {"type": 14, "divider": True, "spacing": 1},
            {"type": 10, "content": "🔔 **" + platform_name + " 테스트 알림**\n\n이 메시지는 DaMoA 테스트 알림입니다."},
            {"type": 14, "divider": False, "spacing": 1},
            {"type": 1, "components": [{"type": 2, "style": 5, "label": "원문 보기", "url": "https://damoa.teamlight.pe.kr"}]},
            {"type": 14, "divider": True, "spacing": 1},
            {"type": 10, "content": "-# " + platform_name + " | " + time_str},
        ]}]
    }
    sent_count = 0
    errors = []
    for row in rows:
        channel_id = row["channel"] if isinstance(row, dict) else row[0]
        webhook_url = row["webhook_url"] if isinstance(row, dict) else row[1]
        try:
            if webhook_url:
                resp = requests.post(webhook_url, json=payload, params={"wait": "true"}, timeout=10)
                if resp.status_code in (200, 204): sent_count += 1
                else: errors.append(f"Webhook HTTP {resp.status_code}")
            else:
                bot_token = DISCORD_BOT_TOKEN
                if bot_token and channel_id:
                    resp = requests.post(f"https://discord.com/api/v10/channels/{channel_id}/messages", json=payload, headers={"Authorization": f"Bot {bot_token}", "User-Agent": DISCORD_USER_AGENT}, timeout=10)
                    if resp.status_code in (200, 204): sent_count += 1
                    else: errors.append(f"Bot API HTTP {resp.status_code}")
        except Exception as e:
            errors.append(str(e))
    if sent_count > 0:
        return jsonify({"message": f"{platform_name} 테스트 알림을 {sent_count}개 채널에 전송했습니다!", "sent": sent_count})
    return jsonify({"error": "전송에 실패했습니다.", "details": errors}), 500
