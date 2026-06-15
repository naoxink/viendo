import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import actualizar_fechas


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
