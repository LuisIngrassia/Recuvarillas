"""QR que abre el chat de WhatsApp de Recuvarilla con un mensaje ya escrito.

Si cambia el número o el mensaje, se edita acá y se vuelve a correr.
"""
import os

import segno

NUMERO = "5491123958302"
MENSAJE = "Hola%2C%20quiero%20un%20presupuesto%20de%20varillas"

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "qr")
os.makedirs(OUT, exist_ok=True)
q = segno.make(f"https://wa.me/{NUMERO}?text={MENSAJE}", error="m")
q.save(os.path.join(OUT, "qr-whatsapp.svg"), scale=10, border=2, dark="#1D2120", light="#FFFFFF")
q.save(os.path.join(OUT, "qr-whatsapp-negativo.svg"), scale=10, border=2, dark="#FFFFFF", light="#1D2120")
q.save(os.path.join(OUT, "qr-whatsapp.png"), scale=20, border=2, dark="#1D2120", light="#FFFFFF")
print("QR listo en", OUT)
