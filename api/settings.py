import os
import sys
from flask import request

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from api.index import app, get_settings, update_settings
except ImportError:
    from index import app, get_settings, update_settings

@app.route('/settings', methods=['GET', 'POST'])
@app.route('/', defaults={'path': ''}, methods=['GET', 'POST'])
@app.route('/<path:path>', methods=['GET', 'POST'])
def handler(path=''):
    if request.method == 'POST':
        return update_settings()
    return get_settings()
