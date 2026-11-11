/**
 * MiniPaís · Mercado laboral.
 *
 * Demanda de trabajo  Ld = A · w^-0,5   (puestos que ofrecen las empresas)
 * Oferta de trabajo   Ls = B · w^0,3    (gente que quiere trabajar)
 * w es el salario como índice (1 = salario inicial). Personas en personas; tasas en fracciones.
 */
export const PARAMETROS = Object.freeze({
  edadTrabajo: 0.78,       // parte de la población con 15 años o más
  salariosDelPib: 0.55,    // parte del PIB que se paga en salarios
  exponenteDemanda: -0.5,
  exponenteOferta: 0.3,
  desempleoMinimo: 0.02,
  desempleoMaximo: 0.40
});

export const PERFILES = Object.freeze({
  emergente:    { participacion: 0.62, desempleo: 0.09 },
  medio_alto:   { participacion: 0.64, desempleo: 0.06 },
  desarrollado: { participacion: 0.66, desempleo: 0.045 }
});

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
function exigir(nombre, v, min = -Infinity, max = Infinity) {
  if (!Number.isFinite(v) || v < min || v > max) throw new RangeError(`${nombre} debe ser un número entre ${min} y ${max}.`);
}

/**
 * Resuelve el mercado laboral para unos A y B dados. El salario es rígido (w = 1 salvo que se indique),
 * así que el desempleo es la distancia entre quienes quieren trabajar y los puestos que hay.
 */
export function resolverTrabajo({ A, B, poblacion, salarioBase, salario = 1 }) {
  exigir('A', A, 0); exigir('B', B, 1e-6); exigir('poblacion', poblacion, 1); exigir('salario', salario, 0.01);
  const edadTrabajo = poblacion * PARAMETROS.edadTrabajo;
  const fuerzaLaboral = Math.min(B * salario ** PARAMETROS.exponenteOferta, edadTrabajo);
  const puestos = A * salario ** PARAMETROS.exponenteDemanda;
  const desempleo = limitar((fuerzaLaboral - puestos) / fuerzaLaboral, PARAMETROS.desempleoMinimo, PARAMETROS.desempleoMaximo);
  const desocupados = fuerzaLaboral * desempleo, ocupados = fuerzaLaboral - desocupados;
  return {
    poblacion, A, B, salario, salarioBase,
    fuerzaLaboral, ocupados, desocupados, desempleo,
    participacion: fuerzaLaboral / edadTrabajo,
    masaSalarial: salarioBase * salario * ocupados
  };
}

/** Estado laboral inicial. A y B se calibran para que, con w = 1, reproduzcan el desempleo del perfil. */
export function crearTrabajo({ poblacion = 10_000_000, perfil = 'medio_alto', participacion, desempleo, pib } = {}) {
  const p = PERFILES[perfil];
  if (!p) throw new Error(`Perfil desconocido: ${perfil}. Válidos: ${Object.keys(PERFILES).join(', ')}.`);
  participacion ??= p.participacion; desempleo ??= p.desempleo; pib ??= poblacion * 20_000;
  exigir('poblacion', poblacion, 1); exigir('participacion', participacion, 1e-6, 1);
  exigir('desempleo', desempleo, PARAMETROS.desempleoMinimo, PARAMETROS.desempleoMaximo); exigir('pib', pib, 1e-6);

  const fuerzaLaboral = poblacion * PARAMETROS.edadTrabajo * participacion;
  const ocupados = fuerzaLaboral * (1 - desempleo);
  return resolverTrabajo({ A: ocupados, B: fuerzaLaboral, poblacion, salarioBase: PARAMETROS.salariosDelPib * pib / ocupados });
}

/** Puntos {trabajadores, salario} de las dos curvas, en una rejilla de salarios. */
export function curvasTrabajo({ A, B }, { salarioMinimo = 0.5, salarioMaximo = 1.5, cantidadPuntos = 40 } = {}) {
  exigir('A', A, 0); exigir('B', B, 0); exigir('cantidadPuntos', cantidadPuntos, 2, 500);
  const demanda = [], oferta = [];
  for (let i = 0; i < cantidadPuntos; i++) {
    const salario = salarioMinimo + (salarioMaximo - salarioMinimo) * i / (cantidadPuntos - 1);
    demanda.push({ trabajadores: A * salario ** PARAMETROS.exponenteDemanda, salario });
    oferta.push({ trabajadores: B * salario ** PARAMETROS.exponenteOferta, salario });
  }
  return { demanda, oferta };
}
