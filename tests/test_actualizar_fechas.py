import subprocess
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts import actualizar_fechas


def test_obtener_fecha_hora_emision_con_hora():
    ep = {"aired": "2024-10-16", "airTime": "20:30"}
    ahora = datetime(2024, 10, 16, 20, 0)

    assert actualizar_fechas.obtener_fecha_hora_emision(ep) == datetime(2024, 10, 16, 20, 30)


def test_es_emision_futura_sin_hora_usa_la_fecha():
    ep = {"aired": "2024-10-16"}
    ahora = datetime(2024, 10, 15, 20, 0)

    assert actualizar_fechas.es_emision_futura(ep, ahora) is True


def test_es_emision_futura_sin_hora_mismo_dia_no_es_futura():
    ep = {"aired": "2024-10-15"}
    ahora = datetime(2024, 10, 15, 20, 0)

    assert actualizar_fechas.es_emision_futura(ep, ahora) is False


def test_usar_hora_de_la_serie_cuando_el_capitulo_no_la_tiene():
    ep = {"aired": "2024-10-16"}
    ahora = datetime(2024, 10, 16, 20, 0)

    assert actualizar_fechas.es_emision_futura(ep, ahora, hora_default="20:30") is True


def test_limpiar_fechas_pasadas_en_cola_elimina_proxima_fecha_vencida():
    data = {
        "en_cola": [
            {"titulo": "Serie A", "proxima_fecha": "2024-10-14"},
            {"titulo": "Serie B", "proxima_fecha": "2024-10-16"},
        ]
    }
    ahora = datetime(2024, 10, 15, 20, 0)

    modificada = actualizar_fechas.limpiar_fechas_pasadas_en_cola(data, ahora)

    assert modificada is True
    assert "proxima_fecha" not in data["en_cola"][0]
    assert data["en_cola"][1]["proxima_fecha"] == "2024-10-16"


def test_script_puede_ejecutarse_directamente_desde_la_raiz_del_repo():
    repo_root = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        [sys.executable, str(repo_root / "scripts" / "actualizar_fechas.py"), "--help"],
        capture_output=True,
        text=True,
        cwd=repo_root,
    )

    assert result.returncode == 0
    assert "Actualiza fechas de series" in result.stdout
