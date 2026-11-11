/**
 * MiniPaís · Motor de mercados (micro).
 *
 * Cada mercado tiene una demanda lineal  Q = a − b·P  y una oferta lineal  Q = c + d·P.
 * Los golpes de un evento desplazan las curvas como fracción de la cantidad inicial (0,10 = 10 %).
 */
const POBLACION_BASE = 10_000_000;
const TIPOS = new Set(['demanda', 'oferta', 'importaciones', 'exportaciones', 'impuesto']);
const TIPOS_TODOS = ['demanda', 'exportaciones'];   // el mercado «todos» solo admite estos

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
const positivo = v => Number.isFinite(v) && v > 0;

function validarConfig(c) {
  if (!c || typeof c !== 'object') throw new Error('La configuración del mercado no es válida.');
  for (const campo of ['id', 'nombre', 'precioInicial', 'pesoPIB', 'sensibilidadDemanda', 'sensibilidadOferta']) {
    if (!(campo in c)) throw new Error(`Falta el campo ${campo}.`);
  }
  if (!positivo(c.precioInicial)) throw new Error('El precio inicial debe ser positivo.');
  if (c.sensibilidadDemanda >= 0 || c.sensibilidadOferta <= 0) throw new Error('Las sensibilidades tienen signos incorrectos.');
}

function validarMercado(m) {
  if (!m || ![m.a, m.b, m.c, m.d].every(Number.isFinite) || m.b + m.d <= 0) {
    throw new Error('Mercado inválido. Usa crearMercado() primero.');
  }
}

/** Crea un mercado. Con pibInicial, la cantidad sale del peso del mercado; si no, escala con la población. */
export function crearMercado(config, poblacion = POBLACION_BASE, pibInicial = null) {
  validarConfig(config);
  if (!positivo(poblacion)) throw new Error('La población debe ser positiva.');
  if (pibInicial !== null && !positivo(pibInicial)) throw new Error('El PIB inicial debe ser positivo.');

  const P0 = config.precioInicial;
  const Q0 = pibInicial === null
    ? config.cantidadInicial * poblacion / POBLACION_BASE
    : pibInicial * config.pesoPIB / 100 / P0;
  if (!positivo(Q0)) throw new Error('La cantidad inicial debe ser positiva.');

  // Pendientes calibradas para que las sensibilidades valgan en el punto inicial.
  const b = Math.abs(config.sensibilidadDemanda) * Q0 / P0;
  const d = config.sensibilidadOferta * Q0 / P0;
  return {
    id: config.id, nombre: config.nombre, unidad: config.unidad,
    pesoPIB: config.pesoPIB, porcentajeImportado: config.porcentajeImportado,
    sensibilidadDemanda: config.sensibilidadDemanda, sensibilidadOferta: config.sensibilidadOferta,
    precioInicial: P0, cantidadInicial: Q0,
    a: Q0 + b * P0, b, c: Q0 - d * P0, d
  };
}

/** Convierte los golpes del evento en desplazamientos de demanda (D) y oferta (S), ya acotados a ±40 %. */
function desplazamientos(mercado, golpes) {
  if (!Array.isArray(golpes)) throw new Error('Los golpes deben ser una lista.');
  let D = 0, S = 0;
  for (const g of golpes) {
    if (!g || !TIPOS.has(g.tipo)) throw new Error(`Tipo de golpe inválido: ${g?.tipo}`);
    if (!Number.isFinite(g.valor)) throw new Error('El valor del golpe debe ser numérico.');
    if (g.mercado !== mercado.id && g.mercado !== 'todos') continue;
    if (g.mercado === 'todos' && !TIPOS_TODOS.includes(g.tipo)) throw new Error('El mercado «todos» solo admite demanda y exportaciones.');

    switch (g.tipo) {
      case 'demanda':
      case 'exportaciones': D += limitar(g.valor, -40, 40) / 100; break;
      case 'importaciones': D -= limitar(g.valor, -20, 20) / 100; break;             // sustituyen producción nacional
      case 'oferta': S += limitar(g.valor, -40, 40) / 100; break;
      case 'impuesto': S -= limitar(g.valor, -20, 20) / 100 * mercado.sensibilidadOferta; break;  // negativo = subsidio
    }
  }
  return { D: limitar(D, -0.4, 0.4), S: limitar(S, -0.4, 0.4) };
}

/** Precio y cantidad de equilibrio con las curvas desplazadas por los golpes. */
export function equilibrio(mercado, golpes = []) {
  validarMercado(mercado);
  const { D, S } = desplazamientos(mercado, golpes);
  const { a, b, c, d, cantidadInicial: Q0 } = mercado;
  const precio = Math.max(0, (a - c + (D - S) * Q0) / (b + d));
  const cantidad = Math.max(0, c + S * Q0 + d * precio);   // oferta desplazada, evaluada en el precio nuevo
  return { precio, cantidad, golpesAplicados: { demanda: D, oferta: S } };
}

/** Puntos {x: cantidad, y: precio} de las curvas desplazadas, entre P = 0 y P = 2·P0. */
export function curvas(mercado, golpes = [], numeroPuntos = 21) {
  validarMercado(mercado);
  if (!Number.isInteger(numeroPuntos) || numeroPuntos < 2) throw new Error('Se necesitan al menos dos puntos.');
  const { D, S } = desplazamientos(mercado, golpes);
  const { a, b, c, d, cantidadInicial: Q0, precioInicial: P0 } = mercado;
  const demanda = [], oferta = [];
  for (let i = 0; i < numeroPuntos; i++) {
    const P = 2 * P0 * i / (numeroPuntos - 1);
    demanda.push({ x: Math.max(0, a + D * Q0 - b * P), y: P });
    oferta.push({ x: Math.max(0, c + S * Q0 + d * P), y: P });
  }
  return { demanda, oferta };
}
