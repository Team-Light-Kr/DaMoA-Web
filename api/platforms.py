from flask import Flask, jsonify
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

PLATFORMS = [
    {'id': 'youtube', 'name': 'YouTube', 'color': '#FF0000', 'icon': 'fab fa-youtube',
     'kinds': ['post', 'short', 'community_post', 'live_start', 'live_end', 'live_scheduled'],
     'kind_labels': {'post': '새 게시물', 'short': '새 쇼츠', 'community_post': '커뮤니티 글', 'live_start': '방송 시작', 'live_end': '방송 종료', 'live_scheduled': '방송 예약'}},
    {'id': 'chzzk', 'name': '치지직', 'color': '#00FFA3', 'icon': 'fas fa-broadcast-tower',
     'kinds': ['live_start', 'live_end', 'live_scheduled'],
     'kind_labels': {'live_start': '방송 시작', 'live_end': '방송 종료', 'live_scheduled': '방송 예약'}},
    {'id': 'soop', 'name': 'SOOP', 'color': '#0C8CE9', 'icon': 'fas fa-broadcast-tower',
     'kinds': ['live_start', 'live_end', 'live_scheduled'],
     'kind_labels': {'live_start': '방송 시작', 'live_end': '방송 종료', 'live_scheduled': '방송 예약'}},
    {'id': 'cime', 'name': '씨미', 'color': '#7B4EFF', 'icon': 'fas fa-microphone',
     'kinds': ['live_start', 'live_end', 'live_scheduled'],
     'kind_labels': {'live_start': '방송 시작', 'live_end': '방송 종료', 'live_scheduled': '방송 예약'}},
    {'id': 'twitter', 'name': 'X (Twitter)', 'color': '#000000', 'icon': 'fab fa-x-twitter',
     'kinds': ['post'],
     'kind_labels': {'post': '새 게시물'}},
    {'id': 'instagram', 'name': 'Instagram', 'color': '#E1306C', 'icon': 'fab fa-instagram',
     'kinds': ['feed_post', 'story'],
     'kind_labels': {'feed_post': '피드 포스트', 'story': '스토리'}},
    {'id': 'spotify', 'name': 'Spotify', 'color': '#1DB954', 'icon': 'fab fa-spotify',
     'kinds': ['post', 'playlist'],
     'kind_labels': {'post': '새 게시물', 'playlist': '플레이리스트'}},
    {'id': 'naver_cafe', 'name': '네이버 카페', 'color': '#03C75A', 'icon': 'fas fa-coffee',
     'kinds': ['post', 'notice'],
     'kind_labels': {'post': '새 게시물', 'notice': '공지'}}
]

@app.route('/', defaults={'path': ''}, methods=['GET'])
@app.route('/<path:path>', methods=['GET'])
def get_platforms(path=''):
    return jsonify({'status': 'success', 'platforms': PLATFORMS})
