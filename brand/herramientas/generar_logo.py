"""Genera los SVG vectorizados del logo de Recuvarilla (sin depender de fuentes).

Unidades: 1 em = 1000. La varilla y la bajada se construyen con la misma
geometría aprobada en la exploración HTML.
"""
import math
import os
import sys

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

BRAND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(BRAND, "assets", "fonts")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BRAND, "assets", "logo")


GRAFITO = "#1D2120"
CELESTE = "#74ACDF"
BLANCO = "#FFFFFF"

WM_AXES = {"wght": 800, "wdth": 72}
TAG_AXES = {"wght": 600}
TRACK_WM = 12          # .012em
ROD_W = 150            # .15em
ROD_ML, ROD_MR = 35, 45
ROD_TIP = 240          # baja .24em de la línea base
HOLE_R = 30
TAG_SIZE = 200         # .2em del logo
TAG_TRACK = 0.22       # em de la bajada
TAG_GAP = 100          # .5em de la bajada
BAR_H = 100            # .5em de la bajada
TAG_TOP = ROD_TIP + 70  # tope de mayúsculas de la bajada, debajo de la punta (y SVG hacia abajo)


class Face:
    def __init__(self, path, axes):
        blob = hb.Blob.from_file_path(path)
        self.hbface = hb.Face(blob)
        self.hbfont = hb.Font(self.hbface)
        self.hbfont.set_variations(axes)
        self.upem = self.hbface.upem
        tt = TTFont(path)
        self.tt = instancer.instantiateVariableFont(tt, axes)
        self.gs = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()
        self.cap = self.tt["OS/2"].sCapHeight

    def shape(self, text):
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hbfont, buf, {"kern": True, "liga": False})
        return [(self.order[i.codepoint], p.x_advance, p.x_offset, p.y_offset)
                for i, p in zip(buf.glyph_infos, buf.glyph_positions)]

    def draw(self, name, dx, dy, scale=1.0):
        pen = SVGPathPen(self.gs)
        # Fuente: y hacia arriba. SVG: y hacia abajo -> espejamos.
        self.gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, dx, dy)))
        return pen.getCommands()


def circle(cx, cy, r):
    # Sentido antihorario para que evenodd lo recorte siempre.
    return (f"M{cx + r:.1f} {cy:.1f}A{r} {r} 0 1 0 {cx - r:.1f} {cy:.1f}"
            f"A{r} {r} 0 1 0 {cx + r:.1f} {cy:.1f}Z")


def rod_path(x, cap, tip=ROD_TIP):
    """Varilla: de la altura de mayúsculas hasta la punta, con 3 perforaciones."""
    top, bottom = -cap, tip           # coordenadas SVG (línea base en y=0)
    h = bottom - top
    shoulder = top + h * 0.84
    cx = x + ROD_W / 2
    body = (f"M{x:.1f} {top:.1f}H{x + ROD_W:.1f}V{shoulder:.1f}"
            f"L{cx:.1f} {bottom:.1f}L{x:.1f} {shoulder:.1f}Z")
    holes = "".join(circle(cx, top + h * f, HOLE_R) for f in (0.16, 0.38, 0.60))
    return body + holes


def wordmark(face):
    """Devuelve (path_d, ancho) de RECUVARILLA con la I como varilla."""
    parts, x = [], 0.0
    for chunk_i, chunk in enumerate(("RECUVAR", "LLA")):
        if chunk_i == 1:
            x += ROD_ML
            parts.append(rod_path(x, face.cap))
            x += ROD_W + ROD_MR
        for name, adv, xo, yo in face.shape(chunk):
            parts.append(face.draw(name, x + xo, -yo))
            x += adv + TRACK_WM
    width = x - TRACK_WM
    # Recorte de los lados según el contorno real (sin el sangrado lateral de la R y la A)
    return "".join(parts), width


def tagline(face, width, bar_color, text_color):
    s = TAG_SIZE / face.upem
    glyphs = face.shape("100% ARGENTINA")
    track = TAG_TRACK * TAG_SIZE
    text_w = sum(adv * s + track for _, adv, _, _ in glyphs) - track
    x0 = (width - text_w) / 2
    base = TAG_TOP + face.cap * s      # línea base de la bajada (y SVG, hacia abajo)
    d, x = [], x0
    for name, adv, xo, yo in glyphs:
        d.append(face.draw(name, x + xo * s, base - yo * s, s))
        x += adv * s + track
    mid = TAG_TOP + face.cap * s / 2
    bar_w = x0 - TAG_GAP
    y = mid - BAR_H / 2
    bars = (f'<rect x="0" y="{y:.1f}" width="{bar_w:.1f}" height="{BAR_H}" fill="{bar_color}"/>'
            f'<rect x="{width - bar_w:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{BAR_H}" fill="{bar_color}"/>')
    text = f'<path d="{"".join(d)}" fill="{text_color}"/>'
    bottom = TAG_TOP + face.cap * s
    return bars + text, bottom


def svg(content, x, y, w, h, title, px_w=None):
    pw = f' width="{px_w}" height="{px_w * h / w:.0f}"' if px_w else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:.1f} {y:.1f} {w:.1f} {h:.1f}"{pw} '
            f'role="img" aria-label="{title}"><title>{title}</title>{content}</svg>\n')


def icon_content(mono=False, negative=False):
    """Isotipo en una caja de 64: franjas de la bandera y la varilla clavada.

    En color las franjas son tercios, como la bandera. En una sola tinta las
    franjas se afinan: si no, la varilla se funde con ellas y a 16px desaparece.
    """
    field, band, rod = BLANCO, CELESTE, GRAFITO
    if mono:
        band = GRAFITO
    if negative:
        field, band, rod = GRAFITO, (BLANCO if mono else CELESTE), BLANCO
    holes = "".join(circle(32, cy, 2.6) for cy in (14, 27, 40))
    rod_d = f"M25.5 4H38.5V51L32 60L25.5 51Z{holes}"
    if mono:
        t = 12  # alto de cada franja en una tinta
        bands = (f'<path d="M0 6a6 6 0 0 1 6-6h52a6 6 0 0 1 6 6v{t - 6}H0z" fill="{band}"/>'
                 f'<path d="M0 {64 - t}h64v{t - 6}a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6z" fill="{band}"/>')
        keyline = (f'<path d="M25.5 4H38.5V51L32 60L25.5 51Z" fill="none" stroke="{field}" '
                   f'stroke-width="4" stroke-linejoin="round"/>')
    else:
        bands = (f'<path d="M0 6a6 6 0 0 1 6-6h52a6 6 0 0 1 6 6v15.33H0z" fill="{band}"/>'
                 f'<path d="M0 42.67h64V58a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6z" fill="{band}"/>')
        keyline = ""
    return (f'<rect width="64" height="64" rx="6" fill="{field}"/>{bands}'
            f'{keyline}<path d="{rod_d}" fill="{rod}" fill-rule="evenodd"/>')


def main():
    os.makedirs(OUT, exist_ok=True)
    wmf = Face(os.path.join(FONTS, "Archivo[wdth,wght].ttf"), WM_AXES)
    tgf = Face(os.path.join(FONTS, "ChivoMono[wght].ttf"), TAG_AXES)
    d, width = wordmark(wmf)
    cap = wmf.cap
    pad = 0  # el área de protección se documenta aparte; los archivos van al ras

    variants = {
        "color": (GRAFITO, CELESTE, GRAFITO),
        "negativo": (BLANCO, CELESTE, BLANCO),
        "negro": (GRAFITO, GRAFITO, GRAFITO),
        "blanco": (BLANCO, BLANCO, BLANCO),
    }
    top = -cap
    for name, (ink, bar, txt) in variants.items():
        wm = f'<path d="{d}" fill="{ink}" fill-rule="evenodd"/>'
        # Solo palabra: la caja llega hasta la punta de la varilla.
        with open(os.path.join(OUT, f"recuvarilla-palabra-{name}.svg"), "w", encoding="utf-8") as f:
            f.write(svg(wm, -pad, top - pad, width + 2 * pad, cap + ROD_TIP + 2 * pad, "Recuvarilla"))
        tg, bottom = tagline(tgf, width, bar, txt)
        with open(os.path.join(OUT, f"recuvarilla-principal-{name}.svg"), "w", encoding="utf-8") as f:
            f.write(svg(wm + tg, -pad, top - pad, width + 2 * pad, bottom - top + 2 * pad, "Recuvarilla, 100% Argentina"))

        # Vertical: isotipo centrado arriba del logo principal.
        icon_size = cap * 1.6
        gap = cap * 0.55
        ix = (width - icon_size) / 2
        iy = top - gap - icon_size
        mono = name in ("negro", "blanco")
        neg = name in ("negativo", "blanco")
        icon = (f'<svg x="{ix:.1f}" y="{iy:.1f}" width="{icon_size:.1f}" height="{icon_size:.1f}" viewBox="0 0 64 64">'
                f'{icon_content(mono=mono, negative=neg)}</svg>')
        with open(os.path.join(OUT, f"recuvarilla-vertical-{name}.svg"), "w", encoding="utf-8") as f:
            f.write(svg(icon + wm + tg, 0, iy, width, bottom - iy, "Recuvarilla, 100% Argentina"))

    for name, mono, neg in (("color", False, False), ("negativo", False, True),
                            ("negro", True, False), ("blanco", True, True)):
        with open(os.path.join(OUT, f"recuvarilla-isotipo-{name}.svg"), "w", encoding="utf-8") as f:
            f.write(svg(icon_content(mono, neg), 0, 0, 64, 64, "Recuvarilla"))

    print(f"ancho palabra={width:.0f}u cap={cap} -> relación {width / (cap + ROD_TIP):.2f}:1")
    print("archivos:", len(os.listdir(OUT)))


if __name__ == "__main__":
    main()
