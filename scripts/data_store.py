import json
from pathlib import Path
from typing import Dict, List

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


def load_data(base_dir=None) -> Dict[str, List[dict]]:
    data_dir = get_data_dir(base_dir)
    data = {key: [] for key in DATA_KEYS}

    for key in DATA_KEYS:
        file_path = data_dir / f"{key}.json"
        if file_path.exists():
            with file_path.open("r", encoding="utf-8") as handle:
                loaded = json.load(handle)
            data[key] = loaded if isinstance(loaded, list) else []

    return data


def save_data(data, base_dir=None) -> Path:
    data_dir = get_data_dir(base_dir)
    normalized = {key: [] for key in DATA_KEYS}

    if isinstance(data, dict):
        for key in DATA_KEYS:
            value = data.get(key, [])
            normalized[key] = value if isinstance(value, list) else []

    for key in DATA_KEYS:
        file_path = data_dir / f"{key}.json"
        with file_path.open("w", encoding="utf-8") as handle:
            json.dump(normalized[key], handle, indent=2, ensure_ascii=False)

    return data_dir / f"{DATA_KEYS[0]}.json"
