from __future__ import annotations

from pathlib import Path
from typing import Optional
from datetime import date, datetime, timedelta
import itertools

import requests


class TheTVDB:

    BASE_URL = "https://api4.thetvdb.com/v4"

    def __init__(
        self,
        api_key: str,
        pin: Optional[str] = None,
        language: str = "spa"
    ):
        """
        Proveedor para acceder a la API v4 de TheTVDB.

        Args:
            api_key: API Key de TheTVDB.
            pin: PIN de usuario (opcional).
            language: Idioma preferido de las respuestas.
        """

        self.api_key = api_key
        self.pin = pin
        self.language = language

        self._token: Optional[str] = None

        self._session = requests.Session()

        self._session.headers.update({
            "Accept": "application/json"
        })

        self._series_cache: dict[int, Series] = {}
        self._episodes_cache: dict[int, list[Episode]] = {}

    ####################################################################
    # Métodos privados
    ####################################################################

    def _url(self, endpoint: str) -> str:
        """
        Devuelve la URL completa de un endpoint.
        """

        return f"{self.BASE_URL}{endpoint}"

    def _authenticate(self) -> None:
        """
        Obtiene un token JWT desde TheTVDB.
        """

        payload = {
            "apikey": self.api_key
        }

        if self.pin:
            payload["pin"] = self.pin

        response = requests.post(
            self._url("/login"),
            json=payload,
            timeout=30
        )

        response.raise_for_status()

        data = response.json()

        self._token = data["data"]["token"]

        self._session.headers.update({
            "Authorization": f"Bearer {self._token}"
        })

    def _request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> dict:
        """
        Realiza una petición autenticada a la API.
        """

        if self._token is None:
            self._authenticate()

        response = self._session.request(
            method,
            self._url(endpoint),
            timeout=30,
            **kwargs
        )

        #
        # Token caducado.
        #

        if response.status_code == 401:

            self._authenticate()

            response = self._session.request(
                method,
                self._url(endpoint),
                timeout=30,
                **kwargs
            )

        response.raise_for_status()

        return response.json()

    ####################################################################
    # Series
    ####################################################################

    def search(self, query: str, limit: int = 10) -> list:
        """
        Busca series por nombre.

        Args:
            query: Texto a buscar.
            limit: Máximo número de resultados.

        Returns:
            Lista de series normalizadas.
        """

        response = self._request(
            "GET",
            "/search",
            params={
                "query": query,
                "type": "series"
            }
        )

        results = []

        for item in response.get("data", []):

            if item.get("type") != "series":
                continue

            results.append(self._normalize_series(item))

            if len(results) >= limit:
                break

        return results

    def get_series(self, query):
        """
        Obtiene una serie por nombre o por ID.
        """

        if isinstance(query, int):
            return self.get_series_by_id(query)

        results = self.search(query, limit=1)

        if not results:
            return None

        return self.get_series_by_id(results[0]["id"])

    def get_series_by_id(self, series_id: int):
        """
        Obtiene la información completa de una serie.
        """

        if series_id in self._series_cache:
            return self._series_cache[series_id]

        response = self._request(
            "GET",
            f"/series/{series_id}/extended"
        )

        data = response.get("data")

        if data is None:
            return None
        print(data)
        series = self._normalize_series(data)

        self._series_cache[series_id] = series

        return series



    def get_trending(
        self,
        limit: int = 20,
        min_score: float = 0.0,
        country: Optional[str] = None,
        languages: tuple[str, ...] = ("spa", "eng"),
        include_upcoming: bool = True,
        upcoming_ratio: float = 0.3,
        recent_days: int = 60,
        search_limit: int = 12
    ) -> list[dict]:
        """
        Series "trending" reales: popularidad (score) PERO solo entre las que
        tienen actividad de emisión reciente (recent_days hacia atrás/adelante).
        Esto evita que series antiguas con score alto pero inactivas dominen
        el resultado.
        """

        # Sobre-pedimos bastante más de lo pedido, porque el filtro de
        # recencia va a descartar muchísimas series "viejas con score alto".
        fetch_limit = limit * 6

        popular = self._fetch_series_filtered_multilang(
            sort="score",
            sort_type="desc",
            country=country,
            languages=languages,
            status=None,
            min_score=min_score,
            limit=fetch_limit
        )

        popular = [
            item for item in popular
            if self._is_currently_active(item, recent_days)
        ]
        popular = popular[:limit]

        if not include_upcoming:
            return popular

        n_upcoming = max(1, int(limit * upcoming_ratio))

        upcoming = self._fetch_series_filtered_multilang(
            sort="firstAired",
            sort_type="asc",
            country=country,
            languages=languages,
            status="upcoming",
            min_score=0.0,
            limit=n_upcoming
        )

        seen_ids = {item["id"] for item in popular}
        merged = list(popular)

        for item in upcoming:
            if item["id"] in seen_ids:
                continue
            seen_ids.add(item["id"])
            merged.append(item)
            if len(merged) >= limit:
                break

        return merged[:limit]


    def _is_currently_active(self, series: dict, recent_days: int) -> bool:
        """
        Determina si una serie tiene actividad de emisión reciente:
        - último episodio emitido dentro de la ventana, o
        - próximo episodio programado dentro de la ventana, o
        - estado "continuing" (en emisión activa)
        """

        status = (series.get("status") or "").lower()

        if status == "continuing":
            return True

        today = date.today()
        window_start = today - timedelta(days=recent_days)
        window_end = today + timedelta(days=recent_days)

        for field in ("last_aired", "next_aired", "first_aired"):

            raw = series.get(field)

            if not raw:
                continue

            try:
                parsed = datetime.strptime(raw[:10], "%Y-%m-%d").date()
            except (ValueError, TypeError):
                continue

            if window_start <= parsed <= window_end:
                return True

        return False

    def _fetch_series_filtered(
        self,
        sort: str,
        sort_type: str,
        country: Optional[str],
        lang: str,
        min_score: float,
        limit: int,
        status_filter: Optional[str] = None,
        year: Optional[int] = None,
        max_pages: int = 15
    ) -> list[dict]:

        params = {
            "sort": sort,
            "sortType": sort_type,
            "lang": lang
        }

        if country:
            params["country"] = country
        if year:
            params["year"] = year

        fetch_target = limit * 3 if (min_score or status_filter) else limit

        results: list[dict] = []
        page = 0

        try:
            while len(results) < fetch_target and page < max_pages:

                response = self._request(
                    "GET",
                    "/series/filter",
                    params={**params, "page": page}
                )

                items = response.get("data") or []
                if not items:
                    break

                for item in items:

                    score = item.get("score") or 0
                    if min_score and score < min_score:
                        continue

                    normalized = self._normalize_series(item)

                    if status_filter and (normalized.get("status") or "").lower() != status_filter.lower():
                        continue

                    results.append(normalized)

                links = response.get("links", {})
                if links.get("next") is None:
                    break

                page += 1

        except Exception as exc:  # pylint: disable=broad-except
            print(f"⚠️ /series/filter falló ({status_filter or 'popular'}): {exc}")
            return self._fallback_search(min_score, limit, status_filter)

        return results[:limit]
    def _fallback_search(
        self,
        min_score: float,
        limit: int,
        status_filter: Optional[str] = None
    ) -> list[dict]:
        """
        Fallback cuando /series/filter falla: búsqueda amplia por letras
        comunes, filtrando en cliente por score y status.
        """

        query_terms = ["a", "e", "i", "o", "u"]
        found: dict[int, dict] = {}

        for term in query_terms:

            results = self.search(term, limit=limit)

            for item in results:

                series_id = item.get("id")
                if series_id is None or series_id in found:
                    continue

                score = item.get("score") or 0
                if min_score and score < min_score:
                    continue

                if status_filter and (item.get("status") or "").lower() != status_filter.lower():
                    continue

                found[series_id] = item

        ordered = sorted(
            found.values(),
            key=lambda item: item.get("score") or 0,
            reverse=True
        )

        return ordered[:limit]


    def _fetch_series_filtered_multilang(
        self,
        sort: str,
        sort_type: str,
        country: Optional[str],
        languages: tuple[str, ...],
        status: Optional[str],
        min_score: float,
        limit: int
    ) -> list[dict]:
        """
        Llama a /series/filter una vez por cada idioma y fusiona resultados.
        El filtro de status se aplica en cliente (ver _fetch_series_filtered).
        """

        merged: dict[int, dict] = {}

        for lang in languages:

            items = self._fetch_series_filtered(
                sort=sort,
                sort_type=sort_type,
                country=country,
                lang=lang,
                min_score=min_score,
                limit=limit,
                status_filter=status
            )

            for item in items:

                series_id = item.get("id")
                if series_id is None:
                    continue

                if item.get("language") and item["language"] not in languages:
                    continue

                merged.setdefault(series_id, item)

        reverse = sort_type == "desc"

        ordered = sorted(
            merged.values(),
            key=lambda item: item.get("score") or 0,
            reverse=reverse
        )

        return ordered[:limit]

    def get_upcoming_premieres(
        self,
        limit: int = 20,
        country: Optional[str] = None,
        languages: tuple[str, ...] = ("spa", "eng"),
        days_ahead: int = 30,
        order_by: str = "score"  # "score" o "date"
    ) -> list[dict]:

        today = date.today()
        years_to_check = {today.year, today.year + 1}

        candidates_by_id: dict[int, dict] = {}

        for year in years_to_check:
            for lang in languages:

                items = self._fetch_series_filtered(
                    sort="score",
                    sort_type="desc",
                    country=country,
                    lang=lang,
                    min_score=0.0,
                    limit=limit * 5,
                    status_filter="Upcoming",
                    year=year
                )

                for item in items:
                    series_id = item.get("id")
                    if series_id is not None:
                        candidates_by_id.setdefault(series_id, item)

        window_end = today + timedelta(days=days_ahead)
        upcoming = []

        for item in candidates_by_id.values():

            premiere = self._parse_date(item.get("first_aired"))

            if premiere is None or premiere < today or premiere > window_end:
                continue

            item["days_until_premiere"] = (premiere - today).days
            upcoming.append(item)

        if order_by == "score":
            upcoming.sort(key=lambda item: item.get("score") or 0, reverse=True)
        else:
            upcoming.sort(key=lambda item: item["days_until_premiere"])

        return upcoming[:limit]
    def _parse_date(self, raw: Optional[str]):
        """
        Parsea una fecha en formato YYYY-MM-DD devuelta por la API.
        Devuelve None si no hay fecha o el formato no es el esperado.
        """

        if not raw:
            return None

        try:
            return datetime.strptime(raw[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return None

    ####################################################################
    # Normalización
    ####################################################################

    def _normalize_series(self, data: dict) -> dict:

        return {
            # Algunos endpoints devuelven el id en la clave `id`, otros en `tvdb_id`.
            "id": data.get("tvdb_id") or data.get("id"),
            "name": data.get("name"),
            "slug": data.get("slug"),
            "year": data.get("year"),
            "overview": data.get("overview"),
            "image": data.get("image"),
            "thumbnail": data.get("thumbnail"),
            "score": data.get("score"),
            "runtime": data.get("averageRuntime"),
            "first_aired": data.get("firstAired"),
            "last_aired": data.get("lastAired"),
            "country": data.get("originalCountry"),
            "language": data.get("originalLanguage"),
            "genres": [
                genre["name"]
                for genre in data.get("genres", [])
            ],
            "status": (
                data["status"]["name"]
                if isinstance(data.get("status"), dict)
                else data.get("status")
            ),
            "next_aired": data.get("nextAired") or data.get("next_aired"),
            "airsDays": data.get("airsDays", {}),
            "airsTime": data.get("airsTime")
        }

    def _normalize_episode(self, data: dict) -> dict:
        """
        Normaliza un episodio.
        """

        return {
            "id": data.get("id"),
            "name": data.get("name"),
            "overview": data.get("overview"),
            "season": data.get("seasonNumber"),
            "number": data.get("number"),
            "aired": data.get("aired"),
            "runtime": data.get("runtime"),
            "image": data.get("image")
        }

    ####################################################################
    # Episodios
    ####################################################################

    def get_episodes(self, series_id: int) -> list:
        """
        Devuelve todos los episodios de una serie.
        """

        if series_id in self._episodes_cache:
            return self._episodes_cache[series_id]

        episodes = []

        page = 0

        while True:

            data = self._request(
                "GET",
                f"/series/{series_id}/episodes/default",
                params={
                    "page": page
                }
            )

            items = data.get("data", {}).get("episodes", [])

            if not items:
                break

            for episode in items:
                episodes.append(
                    self._normalize_episode(episode)
                )

            links = data.get("links", {})

            if links.get("next") is None:
                break

            page += 1

        self._episodes_cache[series_id] = episodes

        return episodes

    def get_episode(
        self,
        series_id: int,
        season: int,
        episode: int
    ):
        """
        Devuelve un episodio concreto.
        """

        for item in self.get_episodes(series_id):

            if (
                item["season"] == season
                and
                item["number"] == episode
            ):
                return item

        return None

    ####################################################################
    # Temporadas
    ####################################################################

    def get_seasons(self, series_id: int) -> list:
        """
        Devuelve un resumen de temporadas.
        """

        seasons = {}

        for episode in self.get_episodes(series_id):

            season = episode["season"]

            if season is None:
                continue

            seasons.setdefault(season, 0)

            seasons[season] += 1

        return [
            {
                "season": season,
                "episodes": count
            }
            for season, count in sorted(seasons.items())
        ]

    ####################################################################
    # Imágenes
    ####################################################################

    def download_image(
        self,
        url: str,
        filename: str
    ) -> bool:
        """
        Descarga una imagen desde una URL.

        Args:
            url: URL de la imagen.
            filename: Ruta donde guardar el archivo.

        Returns:
            True si se ha descargado correctamente.
        """

        if not url:
            return False

        Path(filename).parent.mkdir(
            parents=True,
            exist_ok=True
        )

        response = self._session.get(
            url,
            stream=True,
            timeout=30
        )

        if response.status_code != 200:
            return False

        with open(filename, "wb") as fp:

            for chunk in response.iter_content(8192):

                if chunk:
                    fp.write(chunk)

        return True

    def download_poster(
        self,
        series: dict,
        filename: str
    ) -> bool:
        """
        Descarga el póster principal de una serie.
        """

        return self.download_image(
            series.get("image"),
            filename
        )

    def download_thumbnail(
        self,
        series: dict,
        filename: str
    ) -> bool:
        """
        Descarga la miniatura de una serie.
        """

        return self.download_image(
            series.get("thumbnail"),
            filename
        )

    def download_poster_by_id(
        self,
        series_id: int,
        filename: str
    ) -> bool:

        series = self.get_series_by_id(series_id)

        if series is None:
            return False

        return self.download_poster(
            series,
            filename
        )

    def exists(self, query: str) -> bool:
        """
        Indica si existe alguna serie con ese nombre.
        """

        return self.get_series(query) is not None

    def get_recently_updated(
        self,
        limit: int = 20,
        min_score: float = 60.0,
        country: Optional[str] = None,
        languages: tuple[str, ...] = ("spa", "eng"),
        exclude_countries: tuple[str, ...] = ("kor", "ind"),
        exclude_languages: tuple[str, ...] = ("kor", "hin"),
        recent_days: int = 14
    ) -> list[dict]:
        """
        Series con episodios emitidos recientemente (recent_days) y cierta
        popularidad (min_score), excluyendo países/idiomas concretos.
        """

        fetch_limit = limit * 8

        # Usamos "score" como sort (válido y ya probado en get_trending),
        # y filtramos la recencia nosotros mismos comparando last_aired.
        candidatas = self._fetch_series_filtered_multilang(
            sort="score",
            sort_type="desc",
            country=country,
            languages=languages,
            status=None,
            min_score=min_score,
            limit=fetch_limit
        )

        hoy = date.today()
        ventana_inicio = hoy - timedelta(days=recent_days)

        resultado = []

        for item in candidatas:

            pais = (item.get("country") or "").lower()
            idioma = (item.get("language") or "").lower()

            if pais in exclude_countries or idioma in exclude_languages:
                continue

            last_aired = self._parse_date(item.get("last_aired"))

            if last_aired is None or last_aired < ventana_inicio or last_aired > hoy:
                continue

            resultado.append(item)

        # Ordenamos por fecha de última emisión (lo que realmente pedías:
        # "últimas series actualizadas"), no por score
        resultado.sort(key=lambda item: item.get("last_aired") or "", reverse=True)

        return resultado[:limit]