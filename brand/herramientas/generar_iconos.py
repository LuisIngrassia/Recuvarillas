"""Etapa 6: íconos, íconos técnicos, sello de distribuidor y logo animado (SVG)."""
import os
import re
import unicodedata

import generar_logo as g

B = os.path.join(g.BRAND, "assets") + os.sep
G, C, W, WIRE = "#1D2120", "#74ACDF", "#FFFFFF", "#9AA39F"
for d in ("iconos", "iconos/tecnicos", "sello", "motion"):
    os.makedirs(B + d, exist_ok=True)

BOLD = g.Face(os.path.join(g.FONTS, "Archivo[wdth,wght].ttf"), {"wght": 700, "wdth": 100})
MONO = g.Face(os.path.join(g.FONTS, "ChivoMono[wght].ttf"), {"wght": 600})


def text(face, s, x, y, size, fill, track=0.0):
    sc = size / face.upem
    d, cx = [], x
    for name, adv, xo, yo in face.shape(s):
        d.append(face.draw(name, cx + xo * sc, y - yo * sc, sc))
        cx += adv * sc + track * size
    return f'<path d="{"".join(d)}" fill="{fill}"/>', cx - x - track * size


# ---------- Íconos: grilla de 48, trazo 3,5 recto, la varilla siempre como forma llena ----------
S = 'fill="none" stroke="{c}" stroke-width="3.5" stroke-linecap="square" stroke-linejoin="miter"'
ROD_V = "M20.5 7H27.5V37L24 43L20.5 37Z"  # varilla parada, punta abajo

ICONS = {
    # Botella -> varilla: el material de origen y el producto. Sin flechas circulares.
    "reciclado": lambda c: f'<path d="M12 5H16V10L20 14V42H8V14L12 10Z" {S.format(c=c)}/>'
                           f'<path d="M24 26H30M27 22L31 26L27 30" {S.format(c=c)}/>'
                           f'<path d="M36 7H43V37L39.5 43L36 37Z" fill="{c}"/>',
    # Varilla bajo la lluvia, clavada: aguanta la intemperie.
    "resistencia": lambda c: f'<path d="M7 6L4 13M14 4L11 11M37 6L34 13M44 4L41 11" {S.format(c=c)}/>'
                             f'<path d="M4 36H16M32 36H44" {S.format(c=c)}/><path d="{ROD_V}" fill="{c}"/>',
    # La tapita vista de costado, con su estriado: plástico que ya existía.
    "sustentabilidad": lambda c: f'<circle cx="24" cy="24" r="19" fill="{c}"/><circle cx="24" cy="24" r="13" fill="none" stroke="#FFFFFF" stroke-width="2.5"/>'
                                 + "".join(f'<path d="M24 5V9" stroke="#FFFFFF" stroke-width="1.6" transform="rotate({a} 24 24)"/>' for a in range(0, 360, 15))
                                 if c != "#FFFFFF" else
                                 f'<circle cx="24" cy="24" r="19" fill="{c}"/><circle cx="24" cy="24" r="13" fill="none" stroke="#1D2120" stroke-width="2.5"/>'
                                 + "".join(f'<path d="M24 5V9" stroke="#1D2120" stroke-width="1.6" transform="rotate({a} 24 24)"/>' for a in range(0, 360, 15)),
    # Sección 3 × 3 con cotas.
    "medidas": lambda c: f'<rect x="12" y="10" width="22" height="22" fill="{c}"/>'
                         f'<path d="M12 40H34M12 37V43M34 37V43M41 10V32M38 10H44M38 32H44" {S.format(c=c)}/>',
    # Largo: la varilla acostada con la cota encima.
    "largo": lambda c: f'<path d="M4 13H44M4 9V17M44 9V17" {S.format(c=c)}/>'
                       f'<path d="M4 26H37L44 30.5L37 35H4Z" fill="{c}"/>',
    # Varilla con tres perforaciones.
    "agujereado": lambda c: f'<path d="M4 19H37L44 24L37 29H4Z{g.circle(12, 24, 2.6)}{g.circle(22, 24, 2.6)}{g.circle(32, 24, 2.6)}" fill="{c}" fill-rule="evenodd"/>',
    # El alambrado: dos varillas, dos hilos, la línea del suelo.
    "campo": lambda c: f'<path d="M4 18H44M4 27H44" fill="none" stroke="{c}" stroke-width="2"/>'
                       f'<path d="M4 38H44" {S.format(c=c)}/>'
                       f'<path d="M9 7H15V38L12 43L9 38Z{g.circle(12, 18, 1.6)}{g.circle(12, 27, 1.6)}M33 7H39V38L36 43L33 38Z{g.circle(36, 18, 1.6)}{g.circle(36, 27, 1.6)}" fill="{c}" fill-rule="evenodd"/>',
    # Camioneta con varillas en la caja.
    "entrega": lambda c: f'<path d="M4 34V24L10 15H20V24H44V34Z" {S.format(c=c)}/>'
                         f'<path d="M23 18H45V22H23Z" fill="{c}"/>'
                         f'<circle cx="13" cy="36" r="4.5" fill="{c}"/><circle cx="36" cy="36" r="4.5" fill="{c}"/>',
    # Cerco eléctrico: la varilla y el rayo.
    "electrico": lambda c: f'<path d="M12.5 7H19.5V37L16 43L12.5 37Z" fill="{c}"/>'
                           f'<path d="M36 5L28 22H37L30 40" {S.format(c=c)}/>',
}


def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n')


NOMBRES = {"reciclado": "Plástico reciclado", "resistencia": "Resistencia", "sustentabilidad": "Sustentabilidad",
           "medidas": "Sección 3 × 3 cm", "largo": "Largo 120 cm", "agujereado": "Agujereado",
           "campo": "Campo", "entrega": "Entrega a campo", "electrico": "Cerco eléctrico"}
for k, f in ICONS.items():
    open(B + f"iconos/{k}.svg", "w", encoding="utf-8").write(svg(48, 48, f(G), NOMBRES[k]))
    open(B + f"iconos/{k}-blanco.svg", "w", encoding="utf-8").write(svg(48, 48, f(W), NOMBRES[k]))

# ---------- Íconos técnicos: ficha de producto ----------
TEC = [("largo", "120 cm", MONO), ("medidas", "3 × 3 cm", MONO),
       ("reciclado", "Plástico reciclado", BOLD), ("agujereado", "Agujereado disponible", BOLD)]
for icon, label, face in TEC:
    txt, tw = text(face, label, 76, 43, 26, G)
    w = int(76 + tw + 24)
    body = (f'<rect x="1" y="1" width="{w - 2}" height="62" rx="4" fill="{W}" stroke="{G}" stroke-width="2"/>'
            f'<svg x="16" y="12" width="40" height="40" viewBox="0 0 48 48">{ICONS[icon](G)}</svg>{txt}')
    slug = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", label.lower().replace("×", "x")).encode("ascii", "ignore").decode()).strip("-")
    open(B + f"iconos/tecnicos/{slug}.svg", "w", encoding="utf-8").write(svg(w, 64, body, label))


# ---------- Sello de distribuidor ----------
def inner(path):
    s = open(path, encoding="utf-8").read()
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    return re.sub(r"<title>.*?</title>", "", re.sub(r"^<svg[^>]*>|</svg>\s*$", "", s.strip())), vb


pal, pal_vb = inner(B + "logo/recuvarilla-palabra-color.svg")
iso, _ = inner(B + "logo/recuvarilla-isotipo-color.svg")
lab, lw = text(MONO, "DISTRIBUIDOR OFICIAL", 116, 44, 18, "#5D6562", track=0.12)
sello = (f'<rect x="1" y="1" width="438" height="118" rx="6" fill="{W}" stroke="{G}" stroke-width="2"/>'
         f'<svg x="20" y="20" width="80" height="80" viewBox="0 0 64 64">{iso}</svg>{lab}'
         f'<svg x="116" y="58" width="300" height="42" viewBox="{pal_vb}" preserveAspectRatio="xMinYMid meet">{pal}</svg>')
open(B + "sello/distribuidor-oficial.svg", "w", encoding="utf-8").write(svg(440, 120, sello, "Distribuidor oficial Recuvarilla"))

# ---------- Logo animado: grupos separados para animar cada parte ----------
wmf = g.Face(os.path.join(g.FONTS, "Archivo[wdth,wght].ttf"), g.WM_AXES)
tgf = g.Face(os.path.join(g.FONTS, "ChivoMono[wght].ttf"), g.TAG_AXES)
letters, x = [], 0.0
rod_x = None
for i, chunk in enumerate(("RECUVAR", "LLA")):
    if i == 1:
        x += g.ROD_ML
        rod_x = x
        x += g.ROD_W + g.ROD_MR
    for name, adv, xo, yo in wmf.shape(chunk):
        letters.append(wmf.draw(name, x + xo, -yo))
        x += adv + g.TRACK_WM
width = x - g.TRACK_WM
cap = wmf.cap
rod = g.rod_path(rod_x, cap)
h = cap + g.ROD_TIP
cx = rod_x + g.ROD_W / 2
tapas = "".join(f'<circle class="tapa t{i}" cx="{cx}" cy="{-cap + h * f:.1f}" r="{g.HOLE_R + 1}" fill="{G}" opacity="0"/>'
                for i, f in enumerate((0.16, 0.38, 0.60)))
tag, bottom = g.tagline(tgf, width, C, G)
bars = re.findall(r"<rect[^>]*/>", tag)
tagtext = re.search(r"<path[^>]*/>", tag).group(0)
anim = (f'<g class="letras"><path d="{"".join(letters)}" fill="{G}"/></g>'
        f'<g class="varilla"><path d="{rod}" fill="{G}" fill-rule="evenodd"/>{tapas}</g>'
        f'<g class="barra izq">{bars[0]}</g><g class="barra der">{bars[1]}</g><g class="bajada">{tagtext}</g>')
open(B + "motion/logo-animable.svg", "w", encoding="utf-8").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {-cap:.1f} {width:.1f} {bottom + cap:.1f}">{anim}</svg>\n')
print("íconos", len(ICONS), "· técnicos", len(TEC), "· rod_x", round(rod_x), "ancho", round(width))

KEY = """
.letras, .varilla, .barra, .bajada { transform-box: fill-box; }
.letras { animation: entra 420ms cubic-bezier(.2,.7,.2,1) both; }
.varilla { transform-origin: 50% 0; animation: clava 520ms cubic-bezier(.2,.7,.2,1) 380ms both; }
.tapa { animation: perfora 90ms ease-in both; }
.t0 { animation-delay: 960ms; } .t1 { animation-delay: 1080ms; } .t2 { animation-delay: 1200ms; }
.barra.izq { transform-origin: 100% 50%; animation: crece 360ms cubic-bezier(.2,.7,.2,1) 1320ms both; }
.barra.der { transform-origin: 0 50%; animation: crece 360ms cubic-bezier(.2,.7,.2,1) 1320ms both; }
.bajada { animation: aparece 300ms ease-out 1480ms both; }
@keyframes entra { from { opacity: 0; transform: translateY(6%); } }
@keyframes clava { from { opacity: 0; transform: translateY(-140%); } 60% { opacity: 1; } }
@keyframes perfora { from { opacity: 1; } to { opacity: 0; } }
@keyframes crece { from { transform: scaleX(0); } }
@keyframes aparece { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
"""
VB = f'viewBox="0 {-cap:.1f} {width:.1f} {bottom + cap:.1f}"'
open(B + "motion/logo-animado.svg", "w", encoding="utf-8").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" {VB} role="img" aria-label="Recuvarilla, 100% Argentina"><style>{KEY}</style>{anim}</svg>\n')
FRAMES = {
    1: ".varilla, .barra, .bajada { opacity: 0; }",
    2: ".varilla { transform: translateY(-38%); } .tapa { opacity: 1; } .barra, .bajada { opacity: 0; }",
    3: ".t2 { opacity: 1; } .barra { transform: scaleX(.35); } .bajada { opacity: 0; }",
    4: "",
}
for n, css in FRAMES.items():
    open(B + f"motion/cuadro-{n}.svg", "w", encoding="utf-8").write(
        f'<svg xmlns="http://www.w3.org/2000/svg" {VB}><style>.varilla, .barra {{ transform-box: fill-box; }} .barra.izq {{ transform-origin: 100% 50%; }} .barra.der {{ transform-origin: 0 50%; }} {css}</style>{anim}</svg>\n')
print("motion ok")
