from pathlib import Path

from scripts.data_store import load_data, save_data


def test_load_and_save_data_uses_collection_files(tmp_path):
    root = tmp_path
    (root / 'viendo.json').write_text('[]', encoding='utf-8')
    (root / 'en_cola.json').write_text('[]', encoding='utf-8')
    (root / 'dropeadas.json').write_text('[]', encoding='utf-8')
    (root / 'completadas.json').write_text('[]', encoding='utf-8')

    data = load_data(root)
    assert data == {'viendo': [], 'en_cola': [], 'dropeadas': [], 'completadas': []}

    data['viendo'] = [{'titulo': 'Test'}]
    save_data(data, root)

    assert (root / 'viendo.json').read_text(encoding='utf-8') == '[{"titulo": "Test"}]'
    assert not (root / 'data.json').exists()
