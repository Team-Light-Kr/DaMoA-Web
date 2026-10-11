import os
import base64
import json
import re
import time
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

# 플랫폼별 푸터 아이콘 URL (네이버 카페 로고는 요청에 따라 제외됨)
PLATFORM_ICON_URLS = {
    'youtube':    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT35KBL5ifTR1qh-c7-UZJc5bGYTI2kXnyaGDGnZmeuiA&s=10',
    'chzzk':      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTL5o8WMTcizruTWGFYaAhK61h-fAJWIeRGGI5g8NC9dA&s=10',
    'twitter':    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSFbqet-sK8lwsz1nprOmg_E1x993Wvuliu2MmbCwVcOw&s=10',
    'cime':       'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRwoAs9YU5vS94EgfUPeMLdzq7EQLy7SlpRNK0i_6J8Bg&s=10',
    'instagram':  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR1mEo2-NnFTlPRLM13eEJf-qv66rqJUPRu-bAneh4Ncg&s=10',
    'spotify':    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRgoYNyRiH1MSuh1ZL_KreEfYiturY4NYE4RCGB4WhaWw&s=10',
    'soop':       'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTTET5t-HJitRYOD1ESgF4E8MwfCTcwztdUaGdP6a7Wdg&s=10',
}

def create_or_get_webhook(channel_id):
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
        print(f"[test_notify] Webhook create/get error for channel {channel_id}: {e}")
    return None

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

    # 1. DB 설정에서 해당 플랫폼의 채널 및 웹훅 조회
    try:
        conn = psycopg2.connect(clean_db_url())
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT channel, webhook_url, enabled, slot FROM settings "
            "WHERE guild = %s AND source = %s AND channel IS NOT NULL AND channel > 0 "
            "ORDER BY enabled DESC, slot ASC LIMIT 1",
            (int(guild_id), platform)
        )
        row = cur.fetchone()
        if row:
            target_channel_id = str(row['channel'])
            target_webhook_url = row.get('webhook_url')

        # Fallback: 동일 서버의 다른 플랫폼 설정 채널
        if not target_channel_id:
            cur.execute(
                "SELECT channel, webhook_url, enabled, slot FROM settings "
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

    # Fallback: 채널 목록에서 첫 번째 텍스트 채널 탐색
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

    # 만약 webhook_url이 비어있으면 생성 시도
    if not target_webhook_url and target_channel_id:
        target_webhook_url = create_or_get_webhook(int(target_channel_id))
        if target_webhook_url:
            # DB에 웹훅 URL 저장
            try:
                conn = psycopg2.connect(clean_db_url())
                conn.autocommit = True
                cur = conn.cursor()
                cur.execute(
                    "UPDATE settings SET webhook_url = %s WHERE guild = %s AND channel = %s",
                    (target_webhook_url, int(guild_id), int(target_channel_id))
                )
                conn.close()
            except Exception:
                pass

    # 봇의 /테스트알림과 100% 동일한 Components v2 페이로드 구성
    pinfo = PLATFORM_META.get(platform, {'name': platform, 'color': '#5865F2'})
    platform_name = pinfo.get('name', platform)
    hex_color = pinfo.get('color', '#5865F2').lstrip('#')
    platform_color = int(hex_color, 16) if hex_color else 0x5865F2

    now_ts = int(time.time())
    now_kst = datetime.now(timezone(timedelta(hours=9)))
    time_str = now_kst.strftime("%Y.%m.%d %H:%M:%S")

    inner = [
        {
            'type': 10,
            'content': f"DaMoA 테스트 @DaMoA\n-# <t:{now_ts}:f> · {platform_name}"
        },
        {'type': 14, 'divider': True, 'spacing': 1},
        {
            'type': 10,
            'content': f"**새 게시물**\n\n🔔 **{platform_name} 테스트 알림**\n\n이 메시지는 DaMoA 테스트 알림입니다.\n실제 알림이 예시처럼 디스코드에 전송됩니다."
        },
        {'type': 14, 'divider': False, 'spacing': 1},
        {
            'type': 1,
            'components': [
                {
                    'type': 2,
                    'style': 5,
                    'label': '원문 보기',
                    'url': 'https://damoa.teamlight.pe.kr'
                }
            ]
        },
        {'type': 14, 'divider': True, 'spacing': 1}
    ]

    # 네이버 카페는 요청에 따라 로고 이미지 제외
    platform_icon = PLATFORM_ICON_URLS.get(platform)
    if platform != 'naver_cafe' and platform_icon:
        inner.append({
            'type': 9,
            'components': [{'type': 10, 'content': f"-# {platform_name} | {time_str}"}],
            'accessory': {
                'type': 11,
                'media': {'url': platform_icon}
            }
        })
    else:
        inner.append({
            'type': 10,
            'content': f"-# {platform_name} | {time_str}"
        })

    payload = {
        'flags': 32768,
        'username': f'{platform_name} 테스트',
        'components': [
            {
                'type': 17,
                'accent_color': platform_color,
                'components': inner
            }
        ]
    }

    send_success = False
    err_detail = None

    # 1. 웹훅 전송 (우선)
    if target_webhook_url:
        try:
            w_res = requests.post(target_webhook_url, json=payload, params={"wait": "true"}, timeout=10)
            if w_res.status_code in (200, 204):
                send_success = True
            else:
                err_detail = f"Webhook HTTP {w_res.status_code}"
        except Exception as e:
            err_detail = str(e)

    # 2. 봇 직접 메시지 전송 (fallback)
    if not send_success and target_channel_id:
        try:
            b_res = requests.post(
                f"https://discord.com/api/v10/channels/{target_channel_id}/messages",
                headers={
                    "Authorization": f"Bot {DISCORD_BOT_TOKEN}",
                    "Content-Type": "application/json",
                    "User-Agent": "DaMoABot/1.0.0 (https://damoa.teamlight.pe.kr)"
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
            'channel_id': target_channel_id,
            'via_webhook': bool(target_webhook_url)
        }), 200
    else:
        return jsonify({
            'error': f'테스트 알림 전송 실패: {err_detail or "채널 권한을 확인해주세요."}'
        }), 400
