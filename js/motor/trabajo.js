/**
 * MiniPaís — Agente 2: Economista laboral y demógrafo
 *
 * Unidades:
 * - Población y trabajadores: personas.
 * - Tasas y crecimientoRealPIB: fracciones (0.02 = 2 %).
 * - salario: índice relativo al salario inicial (1 = salario inicial).
 * - salarioPromedio y masaSalarial: unidades monetarias del PIB inicial.
 *
 * API pública:
 *   crearTrabajo(config)
 *   actualizarTrabajo(trabajo, crecimientoRealPIB)
 *   curvasTrabajo(trabajo, opciones)
 *
 * Importante: actualizarTrabajo recibe el crecimiento del PIB entre el estado
 * actual y el siguiente. Si se aplican varios cambios, cada llamada recibe
 * la variación incremental de ese paso, no el crecimiento acumulado desde el
 * inicio.
 */

export const PARAMETROS = Object.freeze({
  menores: 0.22,
  edadTrabajo: 0.78,
  respuestaEmpleo: 0.7,
  rigidezSalarios: 0.30,
  desempleoMinimo: 0.02,
  desempleoMaximo: 0.40,
  exponenteDemanda: -0.5,
  exponenteOferta: 0.3
});

export const PERFILES = Object.freeze({
  emergente: Object.freeze({ participacion: 0.62, desempleo: 0.09 }),
  medio_alto: Object.freeze({ participacion: 0.64, desempleo: 0.06 }),
  desarrollado: Object.freeze({ participacion: 0.66, desempleo: 0.045 })
});

function exigirNumero(nombre, valor, minimo = -Infinity, maximo = Infinity) {
  if (!Number.isFinite(valor) || valor < minimo || valor > maximo) {
    throw new RangeError(`${nombre} debe ser un número entre ${minimo} y ${maximo}.`);
  }
}

function limitar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}

/** Distribuye 100 puntos usando el método de restos mayores. */
function porcentajesExactos(grupos) {
  const claves = ["menores", "inactivos", "ocupados", "desocupados"];
  const total = claves.reduce((suma, clave) => suma + grupos[clave], 0);

  if (!(total > 0)) {
    throw new RangeError("La población debe ser positiva.");
  }

  const partes = claves.map((clave) => {
    const exacto = (grupos[clave] / total) * 100;

    return {
      clave,
      valor: Math.floor(exacto),
      resto: exacto - Math.floor(exacto)
    };
  });

  let asignados = partes.reduce((suma, parte) => suma + parte.valor, 0);

  partes.sort((a, b) => b.resto - a.resto);

  for (let i = 0; asignados < 100; i += 1, asignados += 1) {
    partes[i % partes.length].valor += 1;
  }

  return Object.fromEntries(
    partes.map(({ clave, valor }) => [clave, valor])
  );
}

function crearPuntosPoblacion(porcentajes) {
  const etiquetas = {
    menores: "menores de 15 años",
    inactivos: "inactivos",
    ocupados: "ocupados",
    desocupados: "desocupados"
  };

  return Object.entries(etiquetas).flatMap(([clave, etiqueta]) =>
    Array.from({ length: porcentajes[clave] }, () => etiqueta)
  );
}

function indicadoresPoblacionales(poblacion, grupos) {
  const poblacionEdadTrabajo = poblacion * PARAMETROS.edadTrabajo;
  const fuerzaLaboral = grupos.ocupados + grupos.desocupados;

  return {
    poblacionEdadTrabajo,
    fuerzaLaboral,
    participacion: fuerzaLaboral / poblacionEdadTrabajo,
    desempleo: grupos.desocupados / fuerzaLaboral,
    tasaOcupacion: grupos.ocupados / poblacionEdadTrabajo
  };
}

function construirResultado(datos) {
  const {
    poblacion,
    grupos,
    salario,
    salarioBase,
    pib,
    A,
    B,
    salarioEquilibrioInicial,
    salarioEquilibrio,
    crecimientoRealPIB = 0,
    demandaTeorica,
    ofertaTeorica
  } = datos;

  const porcentajes = porcentajesExactos(grupos);
  const indicadores = indicadoresPoblacionales(poblacion, grupos);

  const salarioPromedio = salarioBase * salario;
  const masaSalarial = salarioPromedio * grupos.ocupados;

  return {
    poblacion,
    poblacionEdadTrabajo: indicadores.poblacionEdadTrabajo,
    grupos: { ...grupos },
    porcentajes,
    puntosPoblacion: crearPuntosPoblacion(porcentajes),

    fuerzaLaboral: indicadores.fuerzaLaboral,
    participacion: indicadores.participacion,
    desempleo: indicadores.desempleo,
    tasaOcupacion: indicadores.tasaOcupacion,

    salario,
    salarioPromedio,
    salarioBase,
    masaSalarial,
    pib,

    A,
    B,
    salarioEquilibrio,
    salarioEquilibrioInicial,
    crecimientoRealPIB,

    demandaTeorica,
    ofertaTeorica,

    ocupadosEfectivos: grupos.ocupados,
    fuerzaLaboralEfectiva: indicadores.fuerzaLaboral,
    desocupadosEfectivos: grupos.desocupados,

    parametros: { ...PARAMETROS }
  };
}

/**
 * Inicializa el mercado laboral.
 *
 * config = {
 *   poblacion: 10_000_000,
 *   perfil: "medio_alto" | "emergente" | "desarrollado",
 *   participacion: 0.64,
 *   desempleo: 0.06,
 *   pib: 200_000_000_000
 * }
 */
export function crearTrabajo(config = {}) {
  const poblacion = config.poblacion ?? 10_000_000;

  exigirNumero("poblacion", poblacion, 1, 100_000_000);

  const nombrePerfil = config.perfil ?? "medio_alto";
  const perfil = PERFILES[nombrePerfil];

  if (!perfil) {
    throw new Error(
      `Perfil desconocido: ${nombrePerfil}. Perfiles válidos: ${Object.keys(PERFILES).join(", ")}.`
    );
  }

  const participacion = config.participacion ?? perfil.participacion;
  const desempleo = config.desempleo ?? perfil.desempleo;
  const pib = config.pib ?? poblacion * 20_000;

  exigirNumero("participacion", participacion, 0.000001, 1);

  exigirNumero(
    "desempleo",
    desempleo,
    PARAMETROS.desempleoMinimo,
    PARAMETROS.desempleoMaximo
  );

  exigirNumero("pib", pib, 0.000001);

  const poblacionEdadTrabajo = poblacion * PARAMETROS.edadTrabajo;
  const fuerzaLaboral = poblacionEdadTrabajo * participacion;

  const desocupados = fuerzaLaboral * desempleo;
  const ocupados = fuerzaLaboral - desocupados;
  const inactivos = poblacionEdadTrabajo - fuerzaLaboral;
  const menores = poblacion * PARAMETROS.menores;

  const grupos = {
    menores,
    inactivos,
    ocupados,
    desocupados
  };

  // A y B se calibran para que, con salario índice w = 1,
  // Ld = A y Ls = B reproduzcan el desempleo del perfil.
  const B = fuerzaLaboral;
  const A = ocupados;

  const salarioEquilibrioInicial = Math.pow(A / B, 1.25);
  const salarioBase = (0.55 * pib) / ocupados;

  return construirResultado({
    poblacion,
    grupos,
    salario: 1,
    salarioBase,
    pib,
    A,
    B,
    salarioEquilibrioInicial,
    salarioEquilibrio: salarioEquilibrioInicial,
    demandaTeorica: A,
    ofertaTeorica: B
  });
}

/**
 * Aplica un cambio incremental del PIB real al mercado laboral.
 *
 * Ejemplo:
 * -0.02 significa que el PIB real cae 2 % respecto al estado recibido.
 *
 * Devuelve un objeto nuevo y conserva el estado anterior sin mutarlo.
 */
export function actualizarTrabajo(trabajo, crecimientoRealPIB) {
  if (!trabajo || typeof trabajo !== "object") {
    throw new TypeError("Debes proporcionar un estado laboral válido.");
  }

  exigirNumero("crecimientoRealPIB", crecimientoRealPIB, -0.06, 0.06);
  exigirNumero("trabajo.A", trabajo.A, 0);
  exigirNumero("trabajo.B", trabajo.B, 0.000001);
  exigirNumero("trabajo.poblacion", trabajo.poblacion, 1);

  const factorDemanda =
    1 + PARAMETROS.respuestaEmpleo * crecimientoRealPIB;

  const A = trabajo.A * factorDemanda;
  const B = trabajo.B;

  // Se conserva la referencia de equilibrio del estado inicial.
  const salarioEquilibrioInicial = trabajo.salarioEquilibrioInicial;

  const salarioEquilibrio = Math.pow(A / B, 1.25);

  const salario = Math.max(
    0.01,
    1 + PARAMETROS.rigidezSalarios *
      (salarioEquilibrio - salarioEquilibrioInicial)
  );

  const demandaTeorica =
    A * Math.pow(salario, PARAMETROS.exponenteDemanda);

  const ofertaTeorica =
    B * Math.pow(salario, PARAMETROS.exponenteOferta);

  const poblacionEdadTrabajo =
    trabajo.poblacion * PARAMETROS.edadTrabajo;

  // La fuerza laboral efectiva no puede superar a la población de 15 años o más.
  const fuerzaLaboral = Math.min(
    ofertaTeorica,
    poblacionEdadTrabajo
  );

  const desempleoTeorico =
    (fuerzaLaboral - demandaTeorica) / fuerzaLaboral;

  const desempleo = limitar(
    desempleoTeorico,
    PARAMETROS.desempleoMinimo,
    PARAMETROS.desempleoMaximo
  );

  // Aplicar los límites puede hacer que los ocupados efectivos
  // difieran de la demanda teórica.
  const desocupados = fuerzaLaboral * desempleo;
  const ocupados = fuerzaLaboral - desocupados;
  const inactivos = poblacionEdadTrabajo - fuerzaLaboral;
  const menores = trabajo.poblacion * PARAMETROS.menores;

  const grupos = {
    menores,
    inactivos,
    ocupados,
    desocupados
  };

  const salarioBase = trabajo.salarioBase;
  const pib = trabajo.pib * (1 + crecimientoRealPIB);

  return construirResultado({
    poblacion: trabajo.poblacion,
    grupos,
    salario,
    salarioBase,
    pib,
    A,
    B,
    salarioEquilibrioInicial,
    salarioEquilibrio,
    crecimientoRealPIB,
    demandaTeorica,
    ofertaTeorica
  });
}

/**
 * Genera puntos para las curvas.
 * Eje X = trabajadores; eje Y = salario.
 *
 * opciones = {
 *   salarioMinimo: 0.5,
 *   salarioMaximo: 1.5,
 *   cantidadPuntos: 40
 * }
 */
export function curvasTrabajo(trabajo, opciones = {}) {
  if (!trabajo || typeof trabajo !== "object") {
    throw new TypeError("Debes proporcionar un estado laboral válido.");
  }

  const salarioMinimo = opciones.salarioMinimo ?? 0.5;
  const salarioMaximo = opciones.salarioMaximo ?? 1.5;
  const cantidadPuntos = opciones.cantidadPuntos ?? 40;

  exigirNumero("salarioMinimo", salarioMinimo, 0.001);
  exigirNumero("salarioMaximo", salarioMaximo, salarioMinimo);
  exigirNumero("cantidadPuntos", cantidadPuntos, 2, 500);

  if (!Number.isInteger(cantidadPuntos)) {
    throw new RangeError("cantidadPuntos debe ser un entero.");
  }

  const demanda = [];
  const oferta = [];

  for (let i = 0; i < cantidadPuntos; i += 1) {
    const proporcion = i / (cantidadPuntos - 1);

    const salario =
      salarioMinimo +
      proporcion * (salarioMaximo - salarioMinimo);

    demanda.push({
      trabajadores:
        trabajo.A * Math.pow(
          salario,
          PARAMETROS.exponenteDemanda
        ),
      salario
    });

    oferta.push({
      trabajadores:
        trabajo.B * Math.pow(
          salario,
          PARAMETROS.exponenteOferta
        ),
      salario
    });
  }

  return {
    demanda,
    oferta,

    // Brecha efectiva: coincide con los desocupados que muestra la población.
    brecha: {
      trabajadores: trabajo.desocupadosEfectivos,
      salario: trabajo.salario,
      desde: trabajo.ocupadosEfectivos,
      hasta: trabajo.fuerzaLaboralEfectiva
    },

    // Brecha teórica: permite comparar Ld y Ls sin aplicar límites estadísticos.
    brechaTeorica: {
      trabajadores: Math.max(
        0,
        trabajo.ofertaTeorica - trabajo.demandaTeorica
      ),
      salario: trabajo.salario,
      desde: Math.min(
        trabajo.demandaTeorica,
        trabajo.ofertaTeorica
      ),
      hasta: Math.max(
        trabajo.demandaTeorica,
        trabajo.ofertaTeorica
      )
    }
  };
}