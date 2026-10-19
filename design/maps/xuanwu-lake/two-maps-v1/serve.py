from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json,base64
D=Path(__file__).parent
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(D),**kw)
    def do_POST(self):
        if self.path!='/export':self.send_error(404);return
        length=int(self.headers.get('Content-Length','0'))
        if length>30_000_000:self.send_error(413);return
        data=json.loads(self.rfile.read(length));name=data.get('name')
        if name not in ['map-small.png','map-large.png','browser-check.json']:self.send_error(400);return
        if name.endswith('.png'):
            content=base64.b64decode(data['data'].split(',',1)[1]);assert content[:8]==b'\x89PNG\r\n\x1a\n'
        else:content=json.dumps(data['data'],ensure_ascii=False,indent=2).encode('utf-8')
        (D/name).write_bytes(content)
        self.send_response(200);self.end_headers();self.wfile.write(b'OK')
print('Map preview at http://127.0.0.1:8768',flush=True)
ThreadingHTTPServer(('127.0.0.1',8768),Handler).serve_forever()
