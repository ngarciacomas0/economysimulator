
/**
 * MiniPaís — Agente 3: Motor macroeconómico
 *
 * Todas las tasas se expresan como fracciones:
 * 0.05 = 5 %.
 *
 * Requiere mercados con:
 * - precio: precio nuevo
 * - cantidad: cantidad nueva
 * - precioAnterior: precio antes del evento
 * - cantidadAnterior: cantidad antes del evento
 *
 * También admite porcentajes comerciales y golpes activos.
 */

const PARAMETROS = Object.freeze({
  gastoPublico: 0.18,
  inversionMultiplicador: 2,
  trasladoSalarial: 0.30,
  rondasMaximas: 3
});

function validarNumero(nombre, valor, minimo = 0) {
  if (!Number.isFinite(valor) || valor < minimo) {
    throw new RangeError(`${nombre} debe ser un número válido.`);
  }
}

function limitar(valor, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, valor));
}

function valorMercado(mercado, precio, cantidad) {
  return precio * cantidad;
}

/**
 * Suma los valores de los mercados.
 */
function sumarMercados(mercados, calculo) {
  return mercados.reduce((total, mercado) => {
    return total + calculo(mercado);
  }, 0);
}

/**
 * Calcula las exportaciones e importaciones de un mercado.
 *
 * Los porcentajes comerciales se expresan como fracciones.
 * Ejemplo: 0.20 significa 20 %.
 *
 * Los golpes de importaciones se expresan en puntos porcentuales.
 * Ejemplo: +5 significa que aumentan 5 puntos.
 */
function calcularComercio(mercados) {
  let exportaciones = 0;
  let importaciones = 0;

  const detalle = mercados.map((mercado) => {
    const ingreso = mercado.precio * mercado.cantidad;

    let porcentajeExportaciones =
      mercado.porcentajeExportaciones ?? 0;

    let porcentajeImportaciones =
      mercado.porcentajeImportaciones ?? 0;

    const golpes = mercado.golpesActivos ?? [];

    for (const golpe of golpes) {
      if (golpe.tipo === "exportaciones") {
        porcentajeExportaciones *= 1 + golpe.valor / 100;
      }

      if (golpe.tipo === "importaciones") {
        porcentajeImportaciones += golpe.valor / 100;
      }
    }

    porcentajeExportaciones = limitar(
      porcentajeExportaciones, 0, 1
    );

    porcentajeImportaciones = limitar(
      porcentajeImportaciones, 0, 1
    );

    const exportacionMercado =
      ingreso * porcentajeExportaciones;

    const importacionMercado =
      ingreso * porcentajeImportaciones;

    exportaciones += exportacionMercado;
    importaciones += importacionMercado;

    return {
      mercado: mercado.id,
      exportaciones: exportacionMercado,
      importaciones: importacionMercado,
      porcentajeExportaciones,
      porcentajeImportaciones
    };
  });

  return {
    exportaciones,
    importaciones,
    balanzaComercial: exportaciones - importaciones,
    detalle
  };
}

/**
 * Calcula la macroeconomía de un país.
 *
 * pibInicial: PIB nominal antes de la simulación.
 * pibRealAnterior: PIB real del periodo anterior.
 * inflacionAnterior: inflación anterior opcional.
 */
export function calcularMacro(
  mercados,
  opciones = {}
) {
  if (!Array.isArray(mercados) || mercados.length === 0) {
    throw new Error("Debes proporcionar al menos un mercado.");
  }

  const poblacion = opciones.poblacion ?? 1;
  validarNumero("poblacion", poblacion, 1);

  const pibInicial = opciones.pibInicial ??
    sumarMercados(mercados, m =>
      m.precioAnterior * m.cantidadAnterior
    );

  validarNumero("pibInicial", pibInicial, 0);

  // PIB nominal: precios y cantidades nuevos.
  const pibNominal = sumarMercados(
    mercados,
    m => valorMercado(m, m.precio, m.cantidad)
  );

  // PIB real: precios anteriores y cantidades nuevas.
  const pibReal = sumarMercados(
    mercados,
    m => valorMercado(m, m.precioAnterior, m.cantidad)
  );

  const pibRealAnterior =
    opciones.pibRealAnterior ?? pibInicial;

  validarNumero("pibRealAnterior", pibRealAnterior, 0);

  const crecimientoReal = pibRealAnterior > 0
    ? (pibReal - pibRealAnterior) / pibRealAnterior
    : 0;

  const crecimientoNominal = pibInicial > 0
    ? (pibNominal - pibInicial) / pibInicial
    : 0;

  // Inflación ponderada por el peso de cada mercado
  // en el PIB inicial.
  let inflacion = 0;

  for (const mercado of mercados) {
    const valorAnterior =
      mercado.precioAnterior * mercado.cantidadAnterior;

    const peso = pibInicial > 0
      ? valorAnterior / pibInicial
      : 0;

    const cambioPrecio = mercado.precioAnterior > 0
      ? mercado.precio / mercado.precioAnterior - 1
      : 0;

    inflacion += peso * cambioPrecio;
  }

  const pibPorPersona = pibNominal / poblacion;

  // Comercio exterior.
  const comercio = calcularComercio(mercados);

  // Composición del gasto.
  const gastoPublico = pibInicial * PARAMETROS.gastoPublico;

  const inversionInicial =
    opciones.inversionInicial ?? pibInicial * 0.20;

  // La inversión reacciona el doble que el PIB real.
  const inversion = Math.max(
    0,
    inversionInicial * (1 + 2 * crecimientoReal)
  );

  const comercioNeto = comercio.balanzaComercial;

  // El consumo es el componente residual.
  // Esto garantiza que la identidad del gasto cierre.
  const consumo =
    pibNominal - inversion - gastoPublico - comercioNeto;

  const composicionGasto = {
    consumo,
    inversion,
    gastoPublico,
    comercioNeto,
    pib: consumo + inversion + gastoPublico + comercioNeto
  };

  return {
    pibNominal,
    pibReal,
    pibRealAnterior,
    crecimientoReal,
    crecimientoNominal,
    inflacion,
    pibPorPersona,
    poblacion,
    exportaciones: comercio.exportaciones,
    importaciones: comercio.importaciones,
    balanzaComercial: comercio.balanzaComercial,
    detalleComercio: comercio.detalle,
    composicionGasto,
    parametros: PARAMETROS
  };
}

/**
 * Calcula el efecto en cadena de la masa salarial.
 *
 * Reparte el 30 % del cambio salarial entre los demás
 * mercados, según su peso económico.
 *
 * recalcular debe ser una función que reciba los mercados
 * actualizados y devuelva el nuevo estado macroeconómico.
 */
export function calcularOla(
  mercados,
  cambioMasaSalarial,
  recalcular
) {
  validarNumero(
    "cambioMasaSalarial",
    Math.abs(cambioMasaSalarial),
    0
  );

  if (typeof recalcular !== "function") {
    throw new TypeError("recalcular debe ser una función.");
  }

  let mercadosActuales = mercados.map(m => ({ ...m }));
  const rondas = [];

  for (
    let ronda = 1;
    ronda <= PARAMETROS.rondasMaximas;
    ronda++
  ) {
    const totalPeso = mercadosActuales.reduce(
      (suma, m) => suma + m.precio * m.cantidad,
      0
    );

    const efectoTotal =
      cambioMasaSalarial * PARAMETROS.trasladoSalarial;

    const cambios = [];

    mercadosActuales = mercadosActuales.map(mercado => {
      const peso = totalPeso > 0
        ? mercado.precio * mercado.cantidad / totalPeso
        : 0;

      const cambioDemanda = efectoTotal * peso;

      cambios.push({
        mercado: mercado.id,
        peso,
        cambioDemanda
      });

      // El cambio se acumula en la demanda del mercado.
      return {
        ...mercado,
        demandaAdicional:
          (mercado.demandaAdicional ?? 0) + cambioDemanda
      };
    });

    const resultado = recalcular(mercadosActuales);

    rondas.push({
      numero: ronda,
      cambios,
      mercados: mercadosActuales.map(m => ({ ...m })),
      resultado
    });
  }

  return {
    mercados: mercadosActuales,
    rondas
  };
}
