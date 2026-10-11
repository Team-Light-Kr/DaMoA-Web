import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from api.index import app, test_notify
except ImportError:
    from index import app, test_notify

@app.route('/test_notify', methods=['POST'])
@app.route('/', defaults={'path': ''}, methods=['POST'])
@app.route('/<path:path>', methods=['POST'])
def handler(path=''):
    return test_notify()
