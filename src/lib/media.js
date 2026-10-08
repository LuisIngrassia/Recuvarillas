/**
 * La ruta de una foto o video de las tarjetas.
 *
 * Las fijas viven en `public/` y se escriben relativas (`varilla-sa.jpg`); las
 * que se suben desde el ERP son una URL completa de Supabase. Pegarle una
 * barra adelante a esas la rompería.
 */
export const rutaDeMedio = (src) =>
  src && /^(https?:)?\/\//.test(src) ? src : `/${src}`
