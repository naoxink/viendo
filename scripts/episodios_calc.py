def construir_fechas_por_temporada(episodios_validos):
    """A partir de la lista de episodios ya filtrados (temporada > 0),
    construye {temporada: {capitulo: fecha}} para guardar en Supabase."""
    fechas = {}
    for ep in episodios_validos:
        t = str(ep['seasonNumber'])
        c = str(ep['number'])
        fechas.setdefault(t, {})[c] = ep.get('aired')
    return fechas