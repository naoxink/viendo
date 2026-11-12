let tvdbToken = null;
let tvdbTokenExp = 0;

export async function fetchWithTimeout(url, options = {}, ms = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getTvdbToken() {
  const now = Date.now();
  if (tvdbToken && now < tvdbTokenExp) return tvdbToken;
  const res = await fetchWithTimeout('https://api4.thetvdb.com/v4/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: process.env.TVDB_API_KEY })
  }, 3000);
  if (!res.ok) throw new Error('Login TVDB falló: ' + res.status);
  tvdbToken = (await res.json()).data.token;
  tvdbTokenExp = now + 1000 * 60 * 60 * 24;
  return tvdbToken;
}

export async function tvdbGet(path, token, ms = 3000) {
  const res = await fetchWithTimeout(`https://api4.thetvdb.com/v4${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  }, ms);
  if (!res.ok) throw new Error(`TVDB ${path} falló: ${res.status}`);
  return res.json();
}

/** Episodios con temporada > 0 (todas las páginas) */
export async function getEpisodiosValidos(tvdb_id, token) {
  const eps = [];
  for (let page = 0; page < 5; page++) {
    const json = await tvdbGet(`/series/${tvdb_id}/episodes/default?page=${page}`, token, 5000);
    eps.push(...(json.data?.episodes || []));
    if (!json.links?.next) break;
  }
  return eps.filter(e => (e.seasonNumber ?? 0) > 0);
}

/** { "1": { "1": "2026-01-01", ... } } — mismo formato que usan los scripts Python */
export function construirFechas(eps) {
  const fechas = {};
  for (const ep of eps) {
    (fechas[ep.seasonNumber] ||= {})[ep.number] = ep.aired || null;
  }
  return fechas;
}

/** Igual que los scripts: solo cuenta episodios con fecha */
export function contarCapitulos(eps) {
  const conteo = {};
  for (const ep of eps) {
    if (!ep.aired) continue;
    conteo[ep.seasonNumber] = (conteo[ep.seasonNumber] || 0) + 1;
  }
  return conteo;
}