import threading, http.server, os, time, sys
ROOT = os.getcwd()
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8321
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
print('SERVING', PORT, flush=True)
while True: time.sleep(3600)
