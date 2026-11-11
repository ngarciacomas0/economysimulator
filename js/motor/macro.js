/**
 * MiniPaís · Indicadores del país a partir de sus mercados.
 *
 * Tasas en fracciones (0,05 = 5 %). Cada fila de mercado trae:
 *   precio, cantidad              → de ahora
 *   precioAnterior, cantidadAnterior → de antes del evento
 *   porcentajeExportaciones, porcentajeImportaciones (fracciones) y golpesActivos (opcional)
 */
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

/** Exportaciones e importaciones en dinero. Un golpe de exportaciones es un % del nivel; uno de importaciones, puntos. */
function comercio(mercados) {
  let exportaciones = 0, importaciones = 0;
  for (const m of mercados) {
    let pe = m.porcentajeExportaciones ?? 0, pi = m.porcentajeImportaciones ?? 0;
    for (const g of m.golpesActivos ?? []) {
      if (g.tipo === 'exportaciones') pe *= 1 + g.valor / 100;
      if (g.tipo === 'importaciones') pi += g.valor / 100;
    }
    const ingreso = m.precio * m.cantidad;
    exportaciones += ingreso * limitar(pe, 0, 1);
    importaciones += ingreso * limitar(pi, 0, 1);
  }
  return { exportaciones, importaciones };
}

/**
 * PIB nominal y real, crecimiento, inflación y comercio exterior.
 * pibInicial: PIB nominal de antes. pibRealAnterior: con qué se compara el PIB real (por defecto, pibInicial).
 */
export function calcularMacro(mercados, { poblacion = 1, pibInicial, pibRealAnterior } = {}) {
  if (!Array.isArray(mercados) || !mercados.length) throw new Error('Debes proporcionar al menos un mercado.');
  if (!(poblacion >= 1)) throw new RangeError('poblacion debe ser un número válido.');
  const suma = f => mercados.reduce((s, m) => s + f(m), 0);

  pibInicial ??= suma(m => m.precioAnterior * m.cantidadAnterior);
  pibRealAnterior ??= pibInicial;
  const pibNominal = suma(m => m.precio * m.cantidad);          // cantidades nuevas a precios de hoy
  const pibReal = suma(m => m.precioAnterior * m.cantidad);     // cantidades nuevas a precios de antes

  // Inflación: cambio de precio de cada mercado, ponderado por su peso en el PIB inicial.
  const inflacion = pibInicial > 0
    ? suma(m => (m.precioAnterior * m.cantidadAnterior / pibInicial) * (m.precioAnterior > 0 ? m.precio / m.precioAnterior - 1 : 0))
    : 0;

  const { exportaciones, importaciones } = comercio(mercados);
  return {
    pibNominal, pibReal,
    crecimientoReal: pibRealAnterior > 0 ? pibReal / pibRealAnterior - 1 : 0,
    inflacion,
    pibPorPersona: pibNominal / poblacion,
    exportaciones, importaciones,
    balanzaComercial: exportaciones - importaciones
  };
}
