import { formatProximaFecha, parseNota, getNotaClass } from './format.js'

const W = 1080
const H = 570
const FONT = '-apple-system, system-ui, "Segoe UI", Roboto, sans-serif'

const css = (name, fallback = '#888') =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}

function loadImage(src) {
    return new Promise((resolve) => {
        if (!src) return resolve(null)
        const img = new Image()
        // Si el servidor remoto no permite CORS, falla y caemos al placeholder
        // (así el canvas nunca queda "tainted" y toBlob siempre funciona).
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = src
    })
}

async function loadPoster(serie) {
    return (await loadImage(serie.poster_path)) || (await loadImage(serie.image_url))
}

function drawCover(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

function wrapText(ctx, text, maxWidth, maxLines) {
    const words = String(text).split(/\s+/)
    const lines = []
    let current = ''
    for (const word of words) {
        const test = current ? `${current} ${word}` : word
        if (ctx.measureText(test).width <= maxWidth || !current) {
            current = test
        } else {
            lines.push(current)
            current = word
        }
    }
    if (current) lines.push(current)

    if (lines.length > maxLines) {
        const kept = lines.slice(0, maxLines)
        let last = kept[maxLines - 1]
        while (last.length && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1)
        kept[maxLines - 1] = last + '…'
        return kept
    }
    return lines
}

/** Dibuja una "pastilla" y devuelve su ancho (para encadenar badges) */
function drawBadge(ctx, text, x, y, bg, fg, size = 24) {
    ctx.font = `700 ${size}px ${FONT}`
    const padX = 14
    const w = ctx.measureText(text).width + padX * 2
    const h = size + 16
    ctx.fillStyle = bg
    roundRectPath(ctx, x, y, w, h, 8)
    ctx.fill()
    ctx.fillStyle = fg
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x + padX, y + h / 2 + 1)
    ctx.textBaseline = 'alphabetic'
    return w
}

const ESTADOS = {
    viendo: 'VIENDO',
    enCola: 'EN COLA',
    completada: 'COMPLETADA',
    dropeada: 'DROPEADA'
}

/** Descripción del progreso según en qué colección esté la serie */
function describe(serie) {
    const T = serie.temporada
    const C = serie.capitulo
    const año = serie.vistoEn || serie.año || serie.anio
    const caps = serie.capitulosPorTemporada || serie.capitulos_por_temporada || {}
    const totalTemp = Number(caps[T]) || 0
    const base = { badges: [], extra: '', progress: null }

    switch (serie.estado) {
        case 'viendo': {
            const vistos = Math.max(0, (Number(C) || 0) - (serie.pendiente ? 1 : 0))
            return {
                ...base,
                main: `T${T} • E${C}`,
                pendiente: Boolean(serie.pendiente),
                acumulados: Number(serie.acumulados) || 0,
                finTemporada: totalTemp > 0 && Number(C) >= totalTemp,
                extra: serie.proxima_fecha
                    ? `Próximo episodio: ${formatProximaFecha(serie.proxima_fecha)}`
                    : '',
                progress: totalTemp ? Math.min(1, vistos / totalTemp) : 0,
                progressKind: 'accent'
            }
        }
        case 'enCola':
            return {
                ...base,
                main: `Por empezar • Temporada ${T || 1}`,
                extra: serie.proxima_fecha ? `Estreno: ${formatProximaFecha(serie.proxima_fecha)}` : ''
            }
        case 'completada':
            return {
                ...base,
                main: `Finalizada en ${año}`,
                nota: serie.nota,
                progress: 1,
                progressKind: 'good'
            }
        case 'dropeada': {
            const vistos = Number(C) || 0
            return {
                ...base,
                main: `Abandonada en ${año}`,
                extra: `Me quedé en T${T} · E${C}`,
                progress: totalTemp ? Math.min(1, vistos / totalTemp) : 0,
                progressKind: 'bad'
            }
        }
        default:
            return { ...base, main: '' }
    }
}

export async function renderSerieImage(serie) {
    const scale = 2 // nitidez en pantallas retina
    const canvas = document.createElement('canvas')
    canvas.width = W * scale
    canvas.height = H * scale
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)

    const c = {
        bg: css('--bg', '#f8fafc'),
        surface: css('--surface', '#ffffff'),
        border: css('--border', '#e2e8f0'),
        text: css('--text', '#1f2937'),
        muted: css('--text-muted', '#64748b'),
        accent: css('--accent', '#2563eb'),
        accentSoft: css('--accent-soft', 'rgba(37,99,235,.1)'),
        accentStrong: css('--accent-strong', '#1d4ed8'),
        goodBg: css('--note-good-bg', '#ecfdf5'),
        goodText: css('--note-good-text', '#059669'),
        goodBorder: css('--note-good-border', '#a7f3d0'),
        mediumBg: css('--note-medium-bg', '#fffbeb'),
        mediumText: css('--note-medium-text', '#d97706'),
        badBg: css('--note-bad-bg', '#fef2f2'),
        badText: css('--note-bad-text', '#dc2626'),
        warnBg: css('--warning-bg', '#dc2626'),
        warnText: css('--warning-text', '#fff'),
        finalBg: css('--final-status-bg', '#0f766d'),
        finalText: css('--final-status-text', '#f0fdfa'),
        estrenoBg: css('--estreno-bg', 'rgba(39,174,96,.15)'),
        estrenoText: css('--estreno-text', '#256a41')
    }

    const poster = await loadPoster(serie)
    const info = describe(serie)

    // --- Fondo: igual que .serie-card (superficie + póster difuminado + velo del tema) ---
    ctx.fillStyle = c.surface
    ctx.fillRect(0, 0, W, H)
    if (poster) {
        ctx.save()
        ctx.globalAlpha = serie.estado === 'viendo' && serie.pendiente ? 1 : 0.4
        drawCover(ctx, poster, 0, 0, W, H)
        ctx.restore()
    }
    const veil = ctx.createLinearGradient(0, 0, 0, H)
    veil.addColorStop(0, c.bg)
    veil.addColorStop(1, c.bg)
    ctx.save()
    ctx.globalAlpha = 0.72
    ctx.fillStyle = veil
    ctx.fillRect(0, 0, W, H)
    ctx.restore()

    // Borde lateral de "pendiente" como en la card
    if (serie.estado === 'viendo' && serie.pendiente) {
        ctx.fillStyle = c.accent
        ctx.fillRect(0, 0, 10, H)
    }

    // --- Póster ---
    const px = 60, py = 60, pw = 300, ph = 450
    ctx.save()
    roundRectPath(ctx, px, py, pw, ph, 16)
    ctx.clip()
    if (poster) {
        drawCover(ctx, poster, px, py, pw, ph)
    } else {
        ctx.fillStyle = c.surface
        ctx.fillRect(px, py, pw, ph)
        ctx.fillStyle = c.muted
        ctx.font = `700 120px ${FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((serie.titulo || '?').charAt(0).toUpperCase(), px + pw / 2, py + ph / 2)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
    }
    ctx.restore()
    ctx.strokeStyle = c.border
    ctx.lineWidth = 2
    roundRectPath(ctx, px, py, pw, ph, 16)
    ctx.stroke()

    // --- Texto ---
    const tx = 410
    const maxW = W - tx - 60
    let y = 60

    // Chip de estado
    const kindColors = {
        viendo: [c.accentSoft, c.accentStrong],
        enCola: [c.estrenoBg, c.estrenoText],
        completada: [c.goodBg, c.goodText],
        dropeada: [c.badBg, c.badText]
    }
    const [chipBg, chipFg] = kindColors[serie.estado] || [c.accentSoft, c.accentStrong]
    drawBadge(ctx, ESTADOS[serie.estado] || 'SERIE', tx, y, chipBg, chipFg, 22)
    y += 80

    // Título
    ctx.fillStyle = c.text
    ctx.font = `700 54px ${FONT}`
    const lines = wrapText(ctx, serie.titulo || 'Sin título', maxW, 2)
    for (const line of lines) {
        ctx.fillText(line, tx, y)
        y += 62
    }

    // Año de estreno
    const año = serie.año || serie.anio
    if (año) {
        ctx.fillStyle = c.muted
        ctx.font = `400 28px ${FONT}`
        ctx.fillText(`Estreno ${año}`, tx, y - 6)
    }
    y += 54

    // Línea principal de progreso
    ctx.fillStyle = c.text
    ctx.font = `600 44px ${FONT}`
    ctx.fillText(info.main, tx, y)
    y += 26

    // Badges
    let bx = tx
    const by = y + 8
    if (serie.estado === 'viendo') {
        bx += drawBadge(
            ctx,
            info.pendiente ? 'PENDIENTE' : 'VISTO',
            bx, by,
            info.pendiente ? c.accentSoft : c.goodBg,
            info.pendiente ? c.accentStrong : c.goodText
        ) + 12
        if (info.acumulados > 0) {
            bx += drawBadge(ctx, `+${info.acumulados} caps`, bx, by, c.warnBg, c.warnText) + 12
        }
        if (info.finTemporada) {
            bx += drawBadge(ctx, 'FIN TEMP.', bx, by, c.finalBg, c.finalText) + 12
        }
    }
    if (info.nota && parseNota(info.nota) !== null) {
        const clase = getNotaClass(info.nota)
        const [nbg, nfg] = clase === 'good'
            ? [c.goodBg, c.goodText]
            : clase === 'medium'
                ? [c.mediumBg, c.mediumText]
                : [c.badBg, c.badText]
        bx += drawBadge(ctx, `★ ${info.nota}`, bx, by, nbg, nfg, 28) + 12
    }
    if (serie.rewatch) {
        bx += drawBadge(ctx, `REWATCH x${serie.veces || 1}`, bx, by, c.accentSoft, c.accentStrong) + 12
    }
    y = by + 64

    // Línea extra (próximo episodio / dónde me quedé)
    if (info.extra) {
        ctx.fillStyle = serie.estado === 'dropeada' ? c.badText : c.estrenoText
        ctx.font = `600 30px ${FONT}`
        ctx.fillText(info.extra, tx, y)
    }

    // Marca
    ctx.fillStyle = c.muted
    ctx.font = `600 22px ${FONT}`
    ctx.textAlign = 'right'
    ctx.fillText('Viendo · Series Tracker', W - 60, H - 36)
    ctx.textAlign = 'left'

    // --- Barra de progreso inferior (como .progress-bar-container) ---
    if (info.progress !== null) {
        const barColor = info.progressKind === 'good'
            ? c.goodText
            : info.progressKind === 'bad' ? c.badText : c.accent
        ctx.fillStyle = c.border
        ctx.fillRect(0, H - 12, W, 12)
        ctx.fillStyle = barColor
        ctx.fillRect(0, H - 12, W * info.progress, 12)
    }

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))), 'image/png')
    })
}

const slug = (t) =>
    String(t || 'serie')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || 'serie'

/** Devuelve 'shared' | 'downloaded' | 'cancelled' */
export async function shareSerieImage(serie) {
    const blob = await renderSerieImage(serie)
    const filename = `${slug(serie.titulo)}.png`
    const file = new File([blob], filename, { type: 'image/png' })

    if (navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: serie.titulo })
            return 'shared'
        } catch (e) {
            if (e?.name === 'AbortError') return 'cancelled'
            // Cualquier otro fallo: seguimos con la descarga
        }
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return 'downloaded'
}