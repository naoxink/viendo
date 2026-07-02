import json

from scripts.admin_server import load_collections_from_disk, save_collections_to_disk


def test_save_and_load_collections_persist_the_expected_json_files(tmp_path):
    root = tmp_path
    data_dir = root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    collections = {
        "viendo": [{"titulo": "Test Show", "temporada": 1, "capitulo": 2}],
        "en_cola": [],
        "dropeadas": [],
        "completadas": [],
    }

    save_collections_to_disk(collections, root)

    reloaded = load_collections_from_disk(root)

    assert reloaded["viendo"] == [{"titulo": "Test Show", "temporada": 1, "capitulo": 2}]
    assert reloaded["en_cola"] == []
    assert json.loads((data_dir / "viendo.json").read_text(encoding="utf-8")) == [
        {"titulo": "Test Show", "temporada": 1, "capitulo": 2}
    ]
