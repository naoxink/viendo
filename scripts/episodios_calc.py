from datetime import datetime, date


def construir_fechas_por_temporada(episodios_validos):
    """A partir de la lista de episodios ya filtrados (temporada > 0),
    construye {temporada: {capitulo: fecha}} para guardar en Supabase."""
    fechas = {}
    for ep in episodios_validos:
        t = str(ep['seasonNumber'])
        c = str(ep['number'])
        fechas.setdefault(t, {})[c] = ep.get('aired')
    return fechas


def _parse_fecha(f):
    if not f:
        return None
    try:
        return datetime.strptime(f, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


def calcular_estado_pendiente(fechas_por_temporada, temporada_actual, capitulo_actual, hoy=None):
    """Cálculo 100% local (sin red): dado el dict de fechas guardado y en
    qué capítulo se quedó el usuario, devuelve el siguiente capítulo a ver,
    si está pendiente, cuántos hay acumulados y la próxima fecha de emisión
    (si el usuario está al día).

    Es el equivalente Python de src/utils/episodios.js::calcularEstadoPendiente.
    Se usa server-side en supabase_actualizar_fechas.py para decidir si hace
    falta resincronizar una serie y para detectar capítulos nuevos.
    """
    hoy = hoy or date.today()
    temporada_actual = temporada_actual or 1
    capitulo_actual = capitulo_actual or 0

    entradas = []
    for t, caps in (fechas_por_temporada or {}).items():
        for c, f in (caps or {}).items():
            entradas.append((int(t), int(c), f))
    entradas.sort(key=lambda x: (x[0], x[1]))

    posteriores = [e for e in entradas if (e[0], e[1]) > (temporada_actual, capitulo_actual)]

    emitidos = [e for e in posteriores if (fp := _parse_fecha(e[2])) and fp <= hoy]
    futuros = sorted(
        [e for e in posteriores if e[2] and not ((fp := _parse_fecha(e[2])) and fp <= hoy)],
        key=lambda e: e[2]
    )

    if emitidos:
        t, c, _ = emitidos[0]
        return {
            "temporada": t,
            "capitulo": c,
            "pendiente": True,
            "acumulados": len(emitidos) - 1,
            "proxima_fecha": None
        }

    return {
        "temporada": temporada_actual,
        "capitulo": capitulo_actual,
        "pendiente": False,
        "acumulados": 0,
        "proxima_fecha": futuros[0][2] if futuros else None
    }

def capitulos_estrenados_en(fechas_por_temporada, temporada_actual, capitulo_actual, fecha_objetivo):
    """Devuelve los capítulos (posteriores al progreso actual) cuya fecha de
    emisión es exactamente `fecha_objetivo` (string 'YYYY-MM-DD'). A
    diferencia de calcular_estado_pendiente(), esto NO se queda "pegado" en
    True mientras haya backlog sin ver: solo detecta el día exacto del
    estreno, así que sirve para notificaciones sin repetirse a diario."""
    temporada_actual = temporada_actual or 1
    capitulo_actual = capitulo_actual or 0

    encontrados = []
    for t, caps in (fechas_por_temporada or {}).items():
        for c, f in (caps or {}).items():
            if f != fecha_objetivo:
                continue
            t_int, c_int = int(t), int(c)
            if (t_int, c_int) > (temporada_actual, capitulo_actual):
                encontrados.append({"temporada": t_int, "capitulo": c_int})

    encontrados.sort(key=lambda e: (e["temporada"], e["capitulo"]))
    return encontrados