
/**
 * MiniPaís — Agente 3: Comparador internacional
 *
 * Lee datos/paises.json.
 *
 * Los indicadores de países reales deben tener:
 * {
 *   anio: 2024,
 *   valor: 123,
 *   fuente: "Banco Mundial"
 * }
 */

function obtenerUltimoDato(serie) {
  if (!Array.isArray(serie)) return null;

  const disponibles = serie
    .filter(d =>
      Number.isFinite(d.valor) &&
      Number.isFinite(d.anio)
    )
    .sort((a, b) => b.anio - a.anio);

  return disponibles[0] ?? null;
}

function distanciaSimple(a, b) {
  return Math.abs(a - b);
}

/**
 * Distancia logarítmica:
 * mide diferencias relativas y no absolutas.
 */
function distanciaLogaritmica(a, b) {
  if (a <= 0 || b <= 0) return Infinity;

  return Math.abs(Math.log(a) - Math.log(b));
}

function obtenerIndicador(pais, indicador) {
  return obtenerUltimoDato(
    pais.indicadores?.[indicador]
  );
}

function buscarPaisCercano(
  valor,
  paises,
  indicador,
  tipoDistancia = "simple"
) {
  const distancia = tipoDistancia === "log"
    ? distanciaLogaritmica
    : distanciaSimple;

  let mejor = null;
  let menorDistancia = Infinity;

  for (const pais of paises) {
    const dato = obtenerIndicador(pais, indicador);

    if (!dato || !Number.isFinite(dato.valor)) {
      continue;
    }

    const diferencia = distancia(valor, dato.valor);

    if (diferencia < menorDistancia) {
      menorDistancia = diferencia;

      mejor = {
        pais: pais.nombre,
        codigo: pais.codigo,
        valor: dato.valor,
        anio: dato.anio,
        fuente: dato.fuente,
        distancia: diferencia
      };
    }
  }

  return mejor;
}

/**
 * Devuelve comparaciones con países reales.
 *
 * Estado esperado:
 * {
 *   macro: {
 *     pibNominal,
 *     pibPorPersona,
 *     crecimientoReal,
 *     inflacion
 *   },
 *   trabajo: {
 *     desempleo,
 *     participacion
 *   }
 * }
 */
export function compararPais(
  estado,
  datosPaises
) {
  const paises = datosPaises.paises ?? datosPaises;

  if (!Array.isArray(paises)) {
    throw new Error("El archivo de países no tiene una lista válida.");
  }

  const macro = estado.macro;
  const trabajo = estado.trabajo;

  const comparaciones = {
    pib: buscarPaisCercano(
      macro.pibNominal,
      paises,
      "pibNominal",
      "log"
    ),

    pibPorPersona: buscarPaisCercano(
      macro.pibPorPersona,
      paises,
      "pibPorPersona",
      "log"
    ),

    desempleo: buscarPaisCercano(
      trabajo.desempleo,
      paises,
      "desempleo"
    ),

    participacion: buscarPaisCercano(
      trabajo.participacion,
      paises,
      "participacion"
    ),

    inflacion: buscarPaisCercano(
      macro.inflacion,
      paises,
      "inflacion"
    ),

    crecimiento: buscarPaisCercano(
      macro.crecimientoReal,
      paises,
      "crecimiento"
    )
  };

  const frases = [];

  const pib = comparaciones.pib;
  if (pib) {
    frases.push(
      `Tu PIB se parece al de ${pib.pais} (${pib.anio}).`
    );
  }

  const pibPersona = comparaciones.pibPorPersona;
  if (pibPersona) {
    frases.push(
      `Tu PIB por persona se parece al de ${pibPersona.pais} (${pibPersona.anio}).`
    );
  }

  const desempleo = comparaciones.desempleo;
  if (desempleo) {
    frases.push(
      `Tu desempleo es como el de ${desempleo.pais} (${desempleo.anio}).`
    );
  }

  const participacion = comparaciones.participacion;
  if (participacion) {
    frases.push(
      `La participación laboral se parece a la de ${participacion.pais} (${participacion.anio}).`
    );
  }

  const inflacion = comparaciones.inflacion;
  if (inflacion) {
    frases.push(
      `La inflación se parece a la de ${inflacion.pais} (${inflacion.anio}).`
    );
  }

  const crecimiento = comparaciones.crecimiento;
  if (crecimiento) {
    frases.push(
      `El crecimiento económico se parece al de ${crecimiento.pais} (${crecimiento.anio}).`
    );
  }

  return {
    comparaciones,
    frases
  };
}

/**
 * Compara una caída con las crisis históricas.
 *
 * Las crisis deben estar en datosPaises.crisisHistoricas.
 */
export function compararCrisis(
  crecimiento,
  datosPaises
) {
  const crisis = datosPaises.crisisHistoricas ?? [];

  let mejor = null;
  let menorDistancia = Infinity;

  for (const evento of crisis) {
    if (!Number.isFinite(evento.crecimiento)) continue;

    const diferencia = distanciaSimple(
      crecimiento,
      evento.crecimiento
    );

    if (diferencia < menorDistancia) {
      menorDistancia = diferencia;

      mejor = {
        pais: evento.pais,
        anio: evento.anio,
        indicador: evento.indicador,
        valor: evento.crecimiento,
        fuente: evento.fuente,
        distancia: diferencia
      };
    }
  }

  if (!mejor) return null;

  return {
    ...mejor,
    frase:
      `Esta variación es similar a la de ${mejor.pais} en ${mejor.anio}.`
  };
}
