from __future__ import annotations

import re
from pathlib import Path
from typing import Optional
from datetime import date, datetime, timedelta

import requests


class TMDB:

    BASE_URL = "https://api.themoviedb.org/3"
    IMAGE_BASE_URL = "https://image.tmdb.org/t/p"

    def __init__(
        self,
        api_key: str,
        language: str = "es-ES",
        image_size: str = "original",
        thumbnail_size: str = "w300"
    ):
        """
        Proveedor para acceder a la API v3 de TMDB.

        Mismo interfaz público que `TheTVDB`, para que ambos providers
        sean intercambiables de forma transparente para la aplicación.

        Args:
            api_key: API Key (v3) de TMDB.
            language: Idioma preferido de las respuestas (formato TMDB, ej. "es-ES").
            image_size: Tamaño de imagen a usar para pósters (image).
            thumbnail_size: Tamaño de imagen a usar para miniaturas (thumbnail).
        """

        self.api_key = api_key
        self.language = language
        self.image_size = image_size
        self.thumbnail_size = thumbnail_size

        self._session = requests.Session()

        self._session.headers.update({
            "Accept": "application/json"
        })

        self._series_cache: dict[int, dict] = {}
        self._episodes_cache: dict[int, list] = {}
        self._genre_map: Optional[dict[int, str]] = None

    ####################################################################
    # Métodos privados
    ####################################################################

    def _url(self, endpoint: str) -> str:
        """
        Devuelve la URL completa de un endpoint.
        """

        return f"{self.BASE_URL}{endpoint}"

    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict] = None,
        **kwargs
    ) -> dict:
        """
        Realiza una petición a la API, inyectando api_key e idioma.
        """

        request_params = dict(params or {})

        request_params.setdefault("api_key", self.api_key)
        request_params.setdefault("language", self.language)

        response = self._session.request(
            method,
            self._url(endpoint),
            params=request_params,
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
            "/search/tv",
            params={
                "query": query
            }
        )

        results = []

        for item in response.get("results", []):

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

        return self.get_series_by_id(results[0]["tmdb_id"])

    def get_series_by_id(self, series_id: int):
        """
        Obtiene la información completa de una serie.
        """

        if series_id in self._series_cache:
            return self._series_cache[series_id]

        try:
            data = self._request(
                "GET",
                f"/tv/{series_id}"
            )
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                return None
            raise

        if data is None or "id" not in data:
            return None

        series = self._normalize_series(data)

        self._series_cache[series_id] = series

        return series

    def get_trending(
        self,
        limit: int = 20,
        min_score: float = 0.0,
        country: Optional[str] = None,
        languages: tuple[str, ...] = ("es", "en"),
        include_upcoming: bool = True,
        upcoming_ratio: float = 0.3,
        recent_days: int = 60,
        max_pages: int = 10
    ) -> list[dict]:
        """
        Series "trending" reales: popularidad PERO solo entre las que
        tienen actividad de emisión reciente (recent_days hacia atrás/adelante).
        Esto evita que series antiguas con popularidad alta pero inactivas
        dominen el resultado.
        """

        fetch_limit = limit * 6

        popular: list[dict] = []
        page = 1

        while len(popular) < fetch_limit and page <= max_pages:

            response = self._request(
                "GET",
                "/trending/tv/week",
                params={"page": page}
            )

            items = response.get("results") or []

            if not items:
                break

            for item in items:

                normalized = self._normalize_series(item)

                score = normalized.get("score") or 0
                if min_score and score < min_score:
                    continue

                if country and normalized.get("country") != country:
                    continue

                if languages and normalized.get("language") not in languages:
                    continue

                popular.append(normalized)

            total_pages = response.get("total_pages", page)
            if page >= total_pages:
                break

            page += 1

        popular = [
            item for item in popular
            if self._is_currently_active(item, recent_days)
        ]
        popular = popular[:limit]

        if not include_upcoming:
            return popular

        n_upcoming = max(1, int(limit * upcoming_ratio))

        upcoming = self.get_upcoming_premieres(
            limit=n_upcoming,
            country=country,
            languages=languages,
            days_ahead=recent_days,
            order_by="date"
        )

        seen_ids = {item["tmdb_id"] for item in popular}
        merged = list(popular)

        for item in upcoming:
            if item["tmdb_id"] in seen_ids:
                continue
            seen_ids.add(item["tmdb_id"])
            merged.append(item)
            if len(merged) >= limit:
                break

        return merged[:limit]

    def get_upcoming_premieres(
        self,
        limit: int = 20,
        country: Optional[str] = None,
        languages: tuple[str, ...] = ("es", "en"),
        days_ahead: int = 30,
        order_by: str = "score",  # "score" o "date"
        max_pages: int = 5
    ) -> list[dict]:

        today = date.today()
        window_end = today + timedelta(days=days_ahead)

        candidates_by_id: dict[int, dict] = {}

        for lang in languages:

            params = {
                "sort_by": "popularity.desc",
                "first_air_date.gte": today.isoformat(),
                "first_air_date.lte": window_end.isoformat(),
                "with_original_language": lang
            }

            if country:
                params["with_origin_country"] = country

            page = 1

            while page <= max_pages:

                response = self._request(
                    "GET",
                    "/discover/tv",
                    params={**params, "page": page}
                )

                items = response.get("results") or []
                if not items:
                    break

                for item in items:
                    normalized = self._normalize_series(item)
                    series_id = normalized.get("tmdb_id")
                    if series_id is not None:
                        candidates_by_id.setdefault(series_id, normalized)

                total_pages = response.get("total_pages", page)
                if page >= total_pages:
                    break

                page += 1

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

    def _is_currently_active(self, series: dict, recent_days: int) -> bool:
        """
        Determina si una serie tiene actividad de emisión reciente:
        - último episodio emitido dentro de la ventana, o
        - próximo episodio programado dentro de la ventana, o
        - estado "Returning Series" (equivalente TMDB de "continuing").
        """

        status = (series.get("status") or "").lower()

        if status == "returning series":
            return True

        today = date.today()
        window_start = today - timedelta(days=recent_days)
        window_end = today + timedelta(days=recent_days)

        for field in ("last_aired", "next_aired", "first_aired"):

            raw = series.get(field)

            if not raw:
                continue

            parsed = self._parse_date(raw)

            if parsed is None:
                continue

            if window_start <= parsed <= window_end:
                return True

        return False

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

    def _get_genre_map(self) -> dict[int, str]:
        """
        Obtiene y cachea el mapeo id -> nombre de género de series de TMDB.
        Necesario porque los resultados de /search/tv y /trending/tv/*
        solo devuelven `genre_ids`, no los nombres.
        """

        if self._genre_map is None:

            response = self._request(
                "GET",
                "/genre/tv/list"
            )

            self._genre_map = {
                genre["id"]: genre["name"]
                for genre in response.get("genres", [])
            }

        return self._genre_map

    def _slugify(self, name: Optional[str]) -> Optional[str]:
        """
        Genera un slug a partir del nombre, ya que TMDB no expone uno
        para series (a diferencia de TheTVDB).
        """

        if not name:
            return None

        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

        return slug or None

    def _extract_year(self, raw: Optional[str]) -> Optional[int]:

        if not raw:
            return None

        try:
            return int(raw[:4])
        except (ValueError, TypeError):
            return None

    def _image_url(self, path: Optional[str], size: Optional[str] = None) -> Optional[str]:

        if not path:
            return None

        return f"{self.IMAGE_BASE_URL}/{size or self.image_size}{path}"

    def _normalize_series(self, data: dict) -> dict:

        next_episode = data.get("next_episode_to_air") or {}

        if data.get("genres"):
            genres = [genre["name"] for genre in data["genres"]]
        elif data.get("genre_ids"):
            genre_map = self._get_genre_map()
            genres = [
                genre_map[genre_id]
                for genre_id in data["genre_ids"]
                if genre_id in genre_map
            ]
        else:
            genres = []

        name = data.get("name") or data.get("original_name")

        return {
            # TMDB no distingue entre "tvdb_id" e "id" como TheTVDB: todo
            # es simplemente `id`. Se expone como `tmdb_id` para que quede
            # claro el origen del identificador.
            "tmdb_id": data.get("id"),
            "name": name,
            "slug": self._slugify(name),
            "year": self._extract_year(data.get("first_air_date")),
            "overview": data.get("overview"),
            "image": self._image_url(data.get("poster_path")),
            "thumbnail": self._image_url(
                data.get("backdrop_path") or data.get("poster_path"),
                size=self.thumbnail_size
            ),
            "score": data.get("vote_average"),
            "runtime": (data.get("episode_run_time") or [None])[0],
            "first_aired": data.get("first_air_date"),
            "last_aired": data.get("last_air_date"),
            "country": (data.get("origin_country") or [None])[0],
            "language": data.get("original_language"),
            "genres": genres,
            "status": data.get("status"),
            "next_aired": next_episode.get("air_date"),
            # TMDB no expone días/hora de emisión de forma directa como
            # TheTVDB (airsDays / airsTime), por lo que quedan vacíos.
            "airsDays": {},
            "airsTime": None
        }

    def _normalize_episode(self, data: dict) -> dict:
        """
        Normaliza un episodio.
        """

        return {
            "id": data.get("id"),
            "name": data.get("name"),
            "overview": data.get("overview"),
            "season": data.get("season_number"),
            "number": data.get("episode_number"),
            "aired": data.get("air_date"),
            "runtime": data.get("runtime"),
            "image": self._image_url(data.get("still_path"), size=self.thumbnail_size)
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

        raw = self._request(
            "GET",
            f"/tv/{series_id}"
        )

        episodes = []

        for season in raw.get("seasons", []):

            season_number = season.get("season_number")

            if season_number is None:
                continue

            season_data = self._request(
                "GET",
                f"/tv/{series_id}/season/{season_number}"
            )

            for episode in season_data.get("episodes", []):
                episodes.append(
                    self._normalize_episode(episode)
                )

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

        raw = self._request(
            "GET",
            f"/tv/{series_id}"
        )

        seasons = []

        for season in raw.get("seasons", []):

            season_number = season.get("season_number")

            if season_number is None:
                continue

            seasons.append({
                "season": season_number,
                "episodes": season.get("episode_count", 0)
            })

        return sorted(seasons, key=lambda item: item["season"])

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