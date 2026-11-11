## Eventos con IA (opcional)
 
Sin clave, MiniPaís funciona completo con los eventos del catálogo. La IA solo agrega **noticias distintas cada vez**.
 
> **Regla de oro:** la IA escribe la noticia y propone el tamaño del golpe. Las matemáticas del proyecto calculan precios, empleo y PIB. La IA nunca los calcula.
 
### Cómo activarla (3 pasos)
 
1. Copia el archivo de ejemplo: `cp .env.example .env`
2. Abre `.env` y escribe tu clave después de `DEEPSEEK_API_KEY=` (sin comillas ni espacios). La consigues en https://platform.deepseek.com
3. Reinicia con `npm start`. El botón «Evento con IA» deja de verse gris.
El modelo se cambia en `.env` (`DEEPSEEK_MODEL`, por defecto `deepseek-flash`). Verifica su nombre vigente en la documentación oficial de DeepSeek (https://api-docs.deepseek.com): los nombres viejos `deepseek-chat` y `deepseek-reasoner` están en retirada.
 
### Cómo cuidamos la clave
 
- Vive **solo** en `.env`. El servidor la lee y la usa; nunca llega al navegador.
- `.env` está en `.gitignore`. Si alguna vez la subes por error, **bórrala en la consola de DeepSeek y crea otra**: borrar el archivo del repositorio no basta, porque queda en el historial.
- Para que la IA responda rápido, el servidor le pide el modo JSON y sin «razonamiento». Si la API rechazara esos ajustes, reintenta sin ellos.
- El servidor solo publica `index.html`, `css/` y `js/`. Pedir `/.env` o `/server/servidor.js` por la web da «no existe».
- Por defecto el servidor solo escucha en tu computadora (`127.0.0.1`).
- No se guarda nada de lo que escribe la IA ni de lo que se envía, y los errores no muestran datos sensibles.
### Qué pasa si algo falla
 
El servidor revisa todo lo que responde la IA: formato correcto, mercados que existen, tipos de golpe permitidos y valores recortados a los límites (±40 %, ±20 puntos, etc.). Si no sirve, reintenta **una vez**. Si sigue mal, no hay clave, no hay internet, pasan 15 segundos o se superan **10 eventos por minuto**, devuelve un evento del catálogo con `origen: "catalogo"` y la app sigue como si nada.
 
### Para quien programa la pantalla
 
- `GET /api/estado` → `{ "ia": true|false, "mensaje": "..." }`. Si `ia` es `false`, el botón sale gris con «Agrega tu clave en .env para activarlo».
- `POST /api/evento` con `{ "mercados": ["alimentos", ...], "recientes": ["titular 1", ...] }` (de 4 a 8 ids de mercados activos; hasta 3 temas recientes).
  Responde `{ "evento": {...}, "aviso": null | { "codigo": "sin_clave" | "limite" | "ia_fallo", "texto": "..." } }`.
  El `evento` tiene el formato de la sección 5 del manual y se pasa tal cual a `aplicarEvento(estado, evento)`. En `valor`, 12 significa +12 % (o +12 puntos en `importaciones`).
- Si se agrega una carpeta pública nueva (por ejemplo `img/`), se anota en `CARPETAS_PUBLICAS` de `server/servidor.js`.
 