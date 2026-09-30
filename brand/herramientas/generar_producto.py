"""Gráfico de dimensiones y esquemas de aplicación de la varilla (SVG, texto vectorizado)."""
import os

import generar_logo as g

OUT = os.path.join(g.BRAND, "assets", "producto") + os.sep
os.makedirs(OUT + "aplicaciones", exist_ok=True)
MONO = g.Face(os.path.join(g.FONTS, "ChivoMono[wght].ttf"), {"wght": 500})
BOLD = g.Face(os.path.join(g.FONTS, "Archivo[wdth,wght].ttf"), {"wght": 700, "wdth": 100})


def text(face, s, x, y, size, fill, anchor="start"):
    """Texto vectorizado. y = línea base."""
    sc = size / face.upem
    glyphs = face.shape(s)
    w = sum(a for _, a, _, _ in glyphs) * sc
    x0 = x - (w / 2 if anchor == "middle" else w if anchor == "end" else 0)
    d, cx = [], x0
    for name, adv, xo, yo in glyphs:
        d.append(face.draw(name, cx + xo * sc, y - yo * sc, sc))
        cx += adv * sc
    return f'<path d="{"".join(d)}" fill="{fill}"/>'


def rod_h(x, y, length, t, fill, holes=0, bg="#fff"):
    """Varilla acostada, punta a la derecha. Perforaciones como huecos reales (evenodd)."""
    tip = t * 1.1
    d = f"M{x} {y}H{x + length - tip}L{x + length} {y + t / 2}L{x + length - tip} {y + t}H{x}Z"
    for i in range(holes):
        cx = x + (length - tip) * (i + 1) / (holes + 1)
        d += g.circle(round(cx, 1), y + t / 2, round(t * 0.2, 2))
    return f'<path d="{d}" fill="{fill}" fill-rule="evenodd"/>'


def rod_v(x, y, h, t, fill, holes=(), in_ground=0.25):
    """Varilla parada (vista de costado), con la punta abajo enterrada."""
    tip = t * 1.1
    d = f"M{x} {y}H{x + t}V{y + h - tip}L{x + t / 2} {y + h}L{x} {y + h - tip}Z"
    for fy in holes:
        d += g.circle(x + t / 2, round(y + fy, 1), round(t * 0.2, 2))
    return f'<path d="{d}" fill="{fill}" fill-rule="evenodd"/>'


def dim_h(x1, x2, y, label, ink, size=26):
    return (f'<path d="M{x1} {y}H{x2}M{x1} {y - 12}V{y + 12}M{x2} {y - 12}V{y + 12}" stroke="{ink}" stroke-width="2" fill="none"/>'
            + text(MONO, label, (x1 + x2) / 2, y - 18, size, ink, "middle"))


def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n')


def dimensiones(perforada, neg):
    ink = "#FFFFFF" if neg else "#1D2120"
    bg = "#1D2120" if neg else "#FFFFFF"
    muted = "#9AA39F" if neg else "#5D6562"
    body = [f'<rect width="1400" height="520" fill="{bg}"/>']
    body.append(dim_h(60, 1340, 96, "120 cm", ink, 30))
    body.append(rod_h(60, 128, 1280, 34, ink, holes=7 if perforada else 0))
    # Sección 3 × 3 ampliada
    sx, sy, ss = 60, 280, 150
    body.append(text(MONO, "SECCIÓN", sx, sy - 22, 20, muted))
    body.append(f'<rect x="{sx}" y="{sy}" width="{ss}" height="{ss}" fill="{ink}"/>')
    body.append(f'<path d="M{sx} {sy + ss + 26}H{sx + ss}M{sx} {sy + ss + 16}V{sy + ss + 36}M{sx + ss} {sy + ss + 16}V{sy + ss + 36}'
                f'M{sx + ss + 26} {sy}V{sy + ss}M{sx + ss + 16} {sy}H{sx + ss + 36}M{sx + ss + 16} {sy + ss}H{sx + ss + 36}" stroke="{ink}" stroke-width="2" fill="none"/>')
    body.append(text(MONO, "3 cm", sx + ss / 2, sy + ss + 64, 24, ink, "middle"))
    body.append(text(MONO, "3 cm", sx + ss + 44, sy + ss / 2 + 9, 24, ink))
    # Datos
    tx = 380
    rows = [("Largo", "120 cm"), ("Sección", "3 × 3 cm"), ("Material", "Polipropileno recuperado"),
            ("Terminación", "Perforada a medida" if perforada else "Lisa, sin perforar")]
    for i, (k, v) in enumerate(rows):
        y = 300 + i * 50
        body.append(text(MONO, k.upper(), tx, y, 18, muted))
        body.append(text(BOLD, v, tx + 190, y + 2, 26, ink))
        body.append(f'<path d="M{tx} {y + 18}H1340" stroke="{muted}" stroke-width="1" opacity=".5"/>')
    name = f"dimensiones-{'perforada' if perforada else 'lisa'}{'-negativo' if neg else ''}.svg"
    title = f"Varilla {'perforada' if perforada else 'lisa'}: 3 × 3 × 120 cm"
    open(OUT + name, "w", encoding="utf-8").write(svg(1400, 520, "".join(body), title))


# ---------- Esquemas de aplicación (vista de costado, mismo lenguaje del sistema) ----------
G, W, WIRE, GROUND, WOOD = "#1D2120", "#FFFFFF", "#9AA39F", "#C9CEC9", "#B9BEB9"
AW, AH, BASE = 600, 360, 300


def ground():
    return f'<rect x="0" y="{BASE}" width="{AW}" height="{AH - BASE}" fill="{GROUND}"/>'


def fence(xs, wire_ys, rod_h_px=200, t=14, fill=G, skip=()):
    out = []
    for y in wire_ys:
        out.append(f'<path d="M0 {y}H{AW}" stroke="{WIRE}" stroke-width="2.5"/>')
    for i, x in enumerate(xs):
        if i in skip:
            continue
        top = BASE - rod_h_px * 0.8
        holes = [y - top for y in wire_ys]
        out.append(rod_v(x - t / 2, top, rod_h_px, t, fill, holes=holes))
    return "".join(out)


def aplicacion(name, body, title):
    open(OUT + "aplicaciones/" + name, "w", encoding="utf-8").write(
        svg(AW, AH, f'<rect width="{AW}" height="{AH}" fill="{W}"/>' + body, title))


xs = [60, 180, 300, 420, 540]
aplicacion("alambrado.svg", ground() + fence(xs, [150, 180, 210, 240, 270]), "Alambrado: varillas con cinco hilos")
aplicacion("cerco-electrico.svg", ground() + fence(xs, [170, 235]), "Cerco eléctrico: dos hilos, la varilla no conduce")
aplicacion("division.svg", ground() + fence([70, 150, 230, 310, 390, 470, 550], [185, 225, 265], rod_h_px=170), "División: varillas más juntas y tres hilos")
# Instalación: tramo con tranquera (los hilos cortan en los esquineros dobles)
wires = [170, 210, 250]
seg = lambda x1, x2: "".join(f'<path d="M{x1} {y}H{x2}" stroke="{WIRE}" stroke-width="2.5"/>' for y in wires)
gate = (f'<rect x="318" y="160" width="124" height="118" fill="none" stroke="{WIRE}" stroke-width="5"/>'
        f'<path d="M318 200H442M318 240H442M318 278L442 160" stroke="{WIRE}" stroke-width="5"/>')
inst = ground() + seg(0, 300) + seg(460, AW) + gate + "".join(
    rod_v(x - 7, 140, 200, 14, G, holes=[30, 70, 110]) for x in (60, 170, 280, 300, 460, 480, 580))
aplicacion("instalacion.svg", inst, "Instalación rural: tramos y esquinas")
# Reparación: alambrado viejo (varillas grises con contorno) y una varilla nueva en el medio
old = "".join(f'<rect x="{x - 8}" y="{BASE - 160}" width="16" height="200" fill="{WOOD}"/>' for x in (60, 180, 420, 540))
rep = ground() + "".join(f'<path d="M0 {y}H{AW}" stroke="{WIRE}" stroke-width="2.5"/>' for y in (170, 210, 250)) + old + \
    rod_v(293, 140, 200, 14, G, holes=[30, 70, 110]) + \
    f'<path d="M300 {BASE + 30}' + f'l0 0" stroke="none"/>'
aplicacion("reparacion.svg", rep, "Reparación: una varilla nueva reemplaza la que se rompió")

for p, n in ((False, False), (True, False), (False, True), (True, True)):
    dimensiones(p, n)
print(sorted(os.listdir(OUT)), sorted(os.listdir(OUT + "aplicaciones")))
