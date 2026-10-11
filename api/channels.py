import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from api.index import app, get_channels
except ImportError:
    from index import app, get_channels

@app.route('/channels', methods=['GET'])
@app.route('/', defaults={'path': ''}, methods=['GET'])
@app.route('/<path:path>', methods=['GET'])
def handler(path=''):
    return get_channels()
