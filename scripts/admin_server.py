import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

DATA_KEYS = ["viendo", "en_cola", "dropeadas", "completadas"]


def get_project_root(base_dir=None) -> Path:
    if base_dir is None:
        return Path(__file__).resolve().parent.parent

    path = Path(base_dir).resolve()
    if path.name == "scripts":
        return path.parent
    if path.is_file():
        return path.parent
    return path


def get_data_dir(base_dir=None) -> Path:
    root = get_project_root(base_dir)
    data_dir = root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def load_collections_from_disk(base_dir=None):
    data_dir = get_data_dir(base_dir)
    collections = {key: [] for key in DATA_KEYS}

    for key in DATA_KEYS:
        file_path = data_dir / f"{key}.json"
        if file_path.exists():
            with file_path.open("r", encoding="utf-8") as handle:
                loaded = json.load(handle)
            collections[key] = loaded if isinstance(loaded, list) else []

    return collections


def save_collections_to_disk(collections, base_dir=None) -> Path:
    data_dir = get_data_dir(base_dir)
    normalized = {key: [] for key in DATA_KEYS}

    if isinstance(collections, dict):
        for key in DATA_KEYS:
            value = collections.get(key, [])
            normalized[key] = value if isinstance(value, list) else []

    for key in DATA_KEYS:
        file_path = data_dir / f"{key}.json"
        with file_path.open("w", encoding="utf-8") as handle:
            json.dump(normalized[key], handle, indent=2, ensure_ascii=False)

    return data_dir


class AdminRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, base_dir=None, **kwargs):
        self.base_dir = get_project_root(base_dir)
        super().__init__(*args, directory=str(self.base_dir), **kwargs)

    def do_GET(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == "/api/collections":
            self._send_json(load_collections_from_disk(self.base_dir))
            return

        if parsed_path.path == "/":
            self.send_response(302)
            self.send_header("Location", "/admin/")
            self.end_headers()
            return

        super().do_GET()

    def do_POST(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path != "/api/collections":
            self.send_error(404, "Endpoint no encontrado")
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length).decode("utf-8") if content_length else ""

        try:
            payload = json.loads(raw_body or "{}")
        except json.JSONDecodeError:
            self._send_json({"ok": False, "error": "JSON inválido"}, status=400)
            return

        collections_payload = payload.get("collections", payload)
        save_collections_to_disk(collections_payload, self.base_dir)
        self._send_json({"ok": True, "collections": load_collections_from_disk(self.base_dir)})

    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run_server(host="127.0.0.1", port=8000, base_dir=None):
    server = ThreadingHTTPServer((host, port), lambda *args, **kwargs: AdminRequestHandler(*args, base_dir=base_dir, **kwargs))
    print(f"Servidor de administración listo en http://{host}:{port}/admin/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido")
    finally:
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Servidor local para administrar los JSON de series")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    run_server(host=args.host, port=args.port)
