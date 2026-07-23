from __future__ import annotations

from pathlib import Path
from typing import Optional

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

    ####################################################################
    # Normalización
    ####################################################################

    def _normalize_series(self, data: dict) -> dict:

        return {
            "id": data.get("tvdb_id"),
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