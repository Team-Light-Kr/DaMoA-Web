import os
import base64
import json
import re
from datetime import datetime, timezone, timedelta
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)
CORS(app, origins='*')

def clean_db_url(url=None):
    default_url = 'postgresql://neondb_owner:npg_qoNf2Brm7KwE@ep-summer-bonus-b5euqtai-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'
    raw = (url or os.getenv('NEON_DB_URL') or os.getenv('DATABASE_URL') or default_url).strip()
    cleaned = re.sub(r'[?&]channel_binding=[^&]*', '', raw).strip()
    if '?' not in cleaned and '&' in cleaned:
        cleaned = cleaned.replace('&', '?', 1)
    return cleaned

DEFAULT_BOT_TOKEN = base64.b64decode('TVRVMU9ETTVOemMyTVRnMk1UUTFNVGd3TmcuRy1XSzdkLmo1OTlBWkRyOUdsWEF0YWlVSWZNZnlpV0hKSjBxLWRtczdoRmxr').decode()
DISCORD_BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN') or os.getenv('DISCORD_TOKEN') or DEFAULT_BOT_TOKEN

PLATFORM_META = {
    'youtube':    {'name': 'YouTube',     'color': '#FF0000'},
    'chzzk':      {'name': '치지직',      'color': '#00FFA3'},
    'soop':       {'name': 'SOOP',        'color': '#0C8CE9'},
    'cime':       {'name': '씨미',        'color': '#7B4EFF'},
    'twitter':    {'name': 'X (Twitter)', 'color': '#000000'},
    'instagram':  {'name': 'Instagram',   'color': '#E1306C'},
    'spotify':    {'name': 'Spotify',     'color': '#1DB954'},
    'naver_cafe': {'name': '네이버 카페', 'color': '#03C75A'},
}

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST'])
@app.route('/<path:path>', methods=['GET', 'POST'])
def handle_test_notify(path=''):
    if request.method == 'GET':
        return jsonify({'status': 'ok', 'message': 'DaMoA Test Notify Service'})

    data = request.get_json(silent=True) or {}
    guild_id = data.get('guild_id') or request.args.get('guild_id')
    platform = data.get('platform') or request.args.get('platform') or 'chzzk'

    if not guild_id:
        return jsonify({'error': 'guild_id required'}), 400

    target_channel_id = None
    target_webhook_url = None

    # 1. Search Neon DB settings for this guild & platform
    try:
        conn = psycopg2.connect(clean_db_url())
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # First priority: matching platform with channel set
        cur.execute(
            "SELECT channel, webhook_url, enabled FROM settings "
            "WHERE guild = %s AND source = %s AND channel IS NOT NULL AND channel > 0 "
            "ORDER BY enabled DESC, slot ASC LIMIT 1",
            (int(guild_id), platform)
        )
        row = cur.fetchone()
        if row:
            target_channel_id = str(row['channel'])
            target_webhook_url = row.get('webhook_url')

        # Second priority: any other platform configured in this guild
        if not target_channel_id:
            cur.execute(
                "SELECT channel, webhook_url FROM settings "
                "WHERE guild = %s AND channel IS NOT NULL AND channel > 0 "
                "ORDER BY enabled DESC, slot ASC LIMIT 1",
                (int(guild_id),)
            )
            fallback_row = cur.fetchone()
            if fallback_row:
                target_channel_id = str(fallback_row['channel'])
                target_webhook_url = fallback_row.get('webhook_url')

        conn.close()
    except Exception as e:
        print(f"[test_notify] DB query error: {e}")

    # 3. Third priority: query Discord API for first text channel if still not found
    if not target_channel_id and DISCORD_BOT_TOKEN:
        try:
            r = requests.get(
                f'https://discord.com/api/v10/guilds/{guild_id}/channels',
                headers={'Authorization': f'Bot {DISCORD_BOT_TOKEN}'},
                timeout=5
            )
            if r.status_code == 200:
                chs = r.json()
                for c in chs:
                    if c.get('type') == 0:  # GUILD_TEXT
                        target_channel_id = str(c['id'])
                        break
        except Exception as e:
            print(f"[test_notify] Discord channels query error: {e}")

    if not target_channel_id and not target_webhook_url:
        pname = PLATFORM_META.get(platform, {}).get("name", platform)
        return jsonify({
            'error': f'{pname} 알림을 전송할 채널을 찾을 수 없습니다. 슬롯 설정에서 알림 채널을 먼저 선택해주세요.'
        }), 400

    # Build Discord Embed / Message payload
    pinfo = PLATFORM_META.get(platform, {'name': platform, 'color': '#5865F2'})
    platform_name = pinfo.get('name', platform)
    hex_color = pinfo.get('color', '#5865F2').lstrip('#')
    platform_color = int(hex_color, 16) if hex_color else 0x5865F2

    now_kst = datetime.now(timezone(timedelta(hours=9)))
    time_str = now_kst.strftime("%Y.%m.%d %H:%M:%S")

    payload = {
        "flags": 1 << 15,
        "components": [{"type": 17, "accent_color": platform_color, "components": [
            {"type": 10, "content": f"**DaMoA 테스트 알림**\n-# {time_str} · {platform_name}"},
            {"type": 14, "divider": True, "spacing": 1},
            {"type": 10, "content": f"🔔 **{platform_name} 테스트 알림 전송 성공!**\n\nDaMoA 알림 서비스 연동이 정상적으로 작동하고 있습니다.\n설정하신 채널로 실시간 알림이 전송됩니다."},
            {"type": 14, "divider": False, "spacing": 1},
            {"type": 1, "components": [{"type": 2, "style": 5, "label": "웹 대시보드 바로가기", "url": "https://damoa.teamlight.pe.kr"}]},
            {"type": 14, "divider": True, "spacing": 1},
            {"type": 10, "content": f"-# DaMoA Notification System · {time_str}"},
        ]}]
    }

    # Dispatch to Discord
    send_success = False
    err_detail = None

    if target_webhook_url:
        try:
            w_res = requests.post(target_webhook_url, json=payload, params={"wait": "true"}, timeout=10)
            if w_res.status_code in (200, 204):
                send_success = True
            else:
                err_detail = f"Webhook HTTP {w_res.status_code}"
        except Exception as e:
            err_detail = str(e)

    if not send_success and target_channel_id:
        try:
            b_res = requests.post(
                f"https://discord.com/api/v10/channels/{target_channel_id}/messages",
                headers={
                    "Authorization": f"Bot {DISCORD_BOT_TOKEN}",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=10
            )
            if b_res.status_code in (200, 201, 204):
                send_success = True
            else:
                err_detail = f"Discord Bot HTTP {b_res.status_code} ({b_res.text})"
        except Exception as e:
            err_detail = str(e)

    if send_success:
        return jsonify({
            'status': 'success',
            'message': f'{platform_name} 테스트 알림을 채널로 전송했습니다!',
            'channel_id': target_channel_id
        }), 200
    else:
        return jsonify({
            'error': f'테스트 알림 전송 실패: {err_detail or "채널 권한을 확인해주세요."}'
        }), 400
