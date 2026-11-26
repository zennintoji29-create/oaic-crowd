"""
CPR AI Vision System - Shared HTTP MJPEG Stream Broadcaster
Streams annotated OpenCV frames over HTTP (/video_feed and /snapshot.jpg)
so the web dashboard can display the live YOLO camera feed without browser webcam permissions.
"""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import cv2


class FrameBroadcaster:
    """Thread-safe holder for the latest annotated JPEG frame for HTTP MJPEG streaming."""

    def __init__(self):
        self._lock = threading.Lock()
        self._jpeg_bytes = None
        self._cond = threading.Condition(self._lock)

    def update(self, frame_bgr):
        ok, buf = cv2.imencode(".jpg", frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if ok:
            with self._cond:
                self._jpeg_bytes = buf.tobytes()
                self._cond.notify_all()

    def get_snapshot(self):
        with self._lock:
            return self._jpeg_bytes

    def wait_next(self, timeout=1.0):
        with self._cond:
            self._cond.wait(timeout=timeout)
            return self._jpeg_bytes


def start_mjpeg_server(port: int, broadcaster: FrameBroadcaster) -> ThreadingHTTPServer:
    """Starts a background HTTP MJPEG server exposing /video_feed, /snapshot.jpg, and /health."""

    class StreamHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            path = self.path.split("?")[0]
            if path in ("/", "/health"):
                payload = json.dumps({
                    "status": "running",
                    "port": port,
                    "video_feed": f"http://localhost:{port}/video_feed",
                    "snapshot": f"http://localhost:{port}/snapshot.jpg",
                }).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(payload)
            elif path == "/snapshot.jpg":
                jpg = broadcaster.get_snapshot()
                if not jpg:
                    self.send_error(503, "Camera frame not ready yet")
                    return
                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(jpg)
            elif path == "/video_feed":
                self.send_response(200)
                self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
                self.end_headers()
                try:
                    while True:
                        jpg = broadcaster.wait_next(timeout=1.5)
                        if not jpg:
                            continue
                        self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n")
                        self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError, OSError):
                    pass
            else:
                self.send_error(404, "Not found")

        def log_message(self, format, *args):
            pass

    server = ThreadingHTTPServer(("0.0.0.0", port), StreamHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server
