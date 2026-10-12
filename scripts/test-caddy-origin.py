#!/usr/bin/env python3
"""Exercise the real Caddy binary on loopback, never the production admin API."""
import argparse
import http.client
import http.server
import json
import os
import pathlib
import re
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request


class Echo(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({k.lower(): v for k, v in self.headers.items()}).encode()
        self.send_response(200)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


def port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def test_https_only(template):
    """Check automatic HTTP routing without production ports, ACME or root trust."""
    http_port, https_port = port(), port()
    config = re.sub(r"    tls \{.*?\n    \}", "    tls internal", template, flags=re.S)
    assert config != template and "issuer acme" not in config
    config = (f"{{\n admin off\n skip_install_trust\n http_port {http_port}\n"
              f" https_port {https_port}\n default_bind 127.0.0.1\n}}\n" + config)
    # Production has other explicit HTTP sites sharing the redirect listener.
    config += "\nhttp://unrelated.example {\n respond unrelated\n}\n"
    with tempfile.TemporaryDirectory(prefix="henry-caddy-routing-") as directory:
        path = pathlib.Path(directory) / "Caddyfile"
        path.write_text(config)
        env = dict(os.environ, HOME=directory, XDG_DATA_HOME=directory, XDG_CONFIG_HOME=directory)
        with (path.parent / "caddy.log").open("w+") as log:
            process = subprocess.Popen(["caddy", "run", "--adapter", "caddyfile", "--config", str(path)],
                                       stdout=log, stderr=log, env=env)
            try:
                for _ in range(100):
                    if process.poll() is not None:
                        log.seek(0)
                        raise RuntimeError(log.read())
                    try:
                        with socket.create_connection(("127.0.0.1", http_port), timeout=.2):
                            break
                    except OSError:
                        time.sleep(.05)
                else:
                    raise RuntimeError("Isolated redirect listener did not become ready")
                connection = http.client.HTTPConnection("127.0.0.1", http_port, timeout=3)
                try:
                    connection.request("GET", "/api/health?probe=1", headers={"Host": "api.henry.ink"})
                    response = connection.getresponse()
                    assert response.status == 308, response.status
                    assert response.getheader("Location") == "https://api.henry.ink/api/health?probe=1", response.getheader("Location")
                    response.read()
                    print("PASS API HTTP redirects to HTTPS, preserving path/query")
                    connection.request("GET", "/api/health", headers={"Host": "arena.henry.ink"})
                    response = connection.getresponse()
                    body = response.read()
                    # Caddy's generic HTTP fallback redirects unknown hosts too;
                    # this must not become a proxy response or point at the API.
                    assert response.status == 308 and body == b"", (response.status, body)
                    assert response.getheader("Location") == "https://arena.henry.ink/api/health"
                    print("PASS retired arena hostname has no API response")
                    connection.request("GET", "/", headers={"Host": "unrelated.example"})
                    response = connection.getresponse()
                    assert response.status == 200 and response.read() == b"unrelated"
                    print("PASS unrelated HTTP site remains reachable")
                finally:
                    connection.close()
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("template", type=pathlib.Path)
    args = parser.parse_args()
    template = args.template.read_text()
    snippet = template.split("\nhttps://api.henry.ink {", 1)[0]
    assert "(henry_api_proxy)" in snippet
    upstream = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Echo)
    threading.Thread(target=upstream.serve_forever, daemon=True).start()
    trusted, untrusted = port(), port()
    snippet = snippet.replace("127.0.0.1:3000", f"127.0.0.1:{upstream.server_port}")
    trusted_snippet = re.sub(r"remote_ip [^\n]+", "remote_ip 127.0.0.1/32", snippet)
    untrusted_snippet = snippet.replace("henry_api_proxy", "henry_untrusted_proxy")
    config = "{\n admin off\n auto_https off\n}\n" + trusted_snippet + untrusted_snippet
    config += f"\nhttp://127.0.0.1:{trusted} {{\n import henry_api_proxy\n}}\n"
    config += f"\nhttp://127.0.0.1:{untrusted} {{\n import henry_untrusted_proxy\n}}\n"
    forged = {"X-Forwarded-For": "198.51.100.99, 203.0.113.99",
              "X-Real-IP": "198.51.100.98", "Forwarded": "for=198.51.100.97"}
    cases = [
        ("trusted IPv4", trusted, "203.0.113.42", "203.0.113.42"),
        ("trusted IPv6", trusted, "2001:db8::42", "2001:db8::42"),
        ("untrusted forged CF and XFF", untrusted, "203.0.113.42", "127.0.0.1"),
        ("trusted missing CF", trusted, None, "127.0.0.1"),
        ("trusted empty CF", trusted, "", "127.0.0.1"),
        ("trusted CF list rejected", trusted, "203.0.113.42, 203.0.113.43", "127.0.0.1"),
        ("trusted malformed CF", trusted, "not-an-ip", "127.0.0.1"),
    ]
    try:
        with tempfile.TemporaryDirectory(prefix="henry-caddy-test-") as directory:
            path = pathlib.Path(directory) / "Caddyfile"
            path.write_text(config)
            with (path.parent / "caddy.log").open("w+") as log:
                process = subprocess.Popen(["caddy", "run", "--adapter", "caddyfile", "--config", str(path)],
                                           stdout=log, stderr=log)
                try:
                    for _ in range(100):
                        if process.poll() is not None:
                            log.seek(0)
                            raise RuntimeError(log.read())
                        try:
                            with urllib.request.urlopen(f"http://127.0.0.1:{trusted}/", timeout=.2):
                                break
                        except (OSError, urllib.error.URLError):
                            time.sleep(.05)
                    else:
                        raise RuntimeError("Isolated Caddy did not become ready")
                    for name, listener, cf_ip, expected in cases:
                        headers = dict(forged)
                        if cf_ip is not None:
                            headers["CF-Connecting-IP"] = cf_ip
                        request = urllib.request.Request(f"http://127.0.0.1:{listener}/", headers=headers)
                        with urllib.request.urlopen(request, timeout=3) as response:
                            received = json.load(response)
                        assert received.get("x-forwarded-for") == expected, (name, received)
                        assert all(k not in received for k in ("cf-connecting-ip", "x-real-ip", "forwarded")), (name, received)
                        print("PASS", name)
                finally:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
    finally:
        upstream.shutdown()
        upstream.server_close()
    test_https_only(template)


if __name__ == "__main__":
    main()
