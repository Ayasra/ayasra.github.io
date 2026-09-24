#!/usr/bin/env python3
"""Serve Desk Clock from this Mac so the iPad can open it over Wi-Fi.

    python3 tools/serve.py              # prints the address to type on the iPad
    python3 tools/serve.py --port 9000
    python3 tools/serve.py --local      # this Mac only
"""

import argparse
import functools
import http.server
import os
import socket

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        # Always serve fresh files while developing; the service worker handles offline use.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


def lan_address():
    """The Mac's address on the local network (connecting a UDP socket sends nothing)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--local", action="store_true", help="only accept connections from this Mac")
    args = parser.parse_args()

    host = "127.0.0.1" if args.local else "0.0.0.0"
    handler = functools.partial(Handler, directory=ROOT)
    with http.server.ThreadingHTTPServer((host, args.port), handler) as server:
        print(f"Desk Clock   http://localhost:{args.port}")
        address = None if args.local else lan_address()
        if address:
            print(f"On the iPad  http://{address}:{args.port}")
        print("Ctrl+C to stop.", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
