// Comparación con países reales (hoy) y con años concretos de la historia.
// Lee paises.json tal como lo genera scripts/actualizar_datos.js:
//   paises[].indicadores[clave] = { nombre, codigo, unidad, fuente, observaciones: [{ anio, valor, fuente }] }

// Qué indicador del Banco Mundial corresponde a cada tarjeta y cómo se mide el parecido
// ('log' = diferencia relativa, para cifras de dinero; 'simple' = diferencia absoluta, para porcentajes).
const MAPA = {
  pib:           { clave: 'pibNominal',           tipo: 'log',    unidad: 'dinero' },
  pibreal:       { clave: 'pibReal',              tipo: 'log',    unidad: 'dinero' },
  pibpersona:    { clave: 'pibPerCapita',         tipo: 'log',    unidad: 'dinero', persona: true },
  rentatrab:     { clave: 'rentaTrabajador',      tipo: 'log',    unidad: 'dinero', persona: true },
  desempleo:     { clave: 'desempleo',            tipo: 'simple', unidad: 'pct' },
  inflacion:     { clave: 'inflacion',            tipo: 'simple', unidad: 'pct' },
  crecimiento:   { clave: 'crecimientoReal',      tipo: 'simple', unidad: 'pct' },
  participacion: { clave: 'participacionLaboral', tipo: 'simple', unidad: 'pct' },
  exportaciones: { clave: 'exportaciones',        tipo: 'simple', unidad: 'pct' },
  importaciones: { clave: 'importaciones',        tipo: 'simple', unidad: 'pct' }
};

const observaciones = (pais, clave) => {
  const nodo = pais?.indicadores?.[clave];
  const obs = Array.isArray(nodo) ? nodo : nodo?.observaciones;
  return Array.isArray(obs) ? obs.filter(o => Number.isFinite(o.valor) && Number.isFinite(o.anio)) : [];
};
const dist = (tipo, a, b) => tipo === 'log' ? (a > 0 && b > 0 ? Math.abs(Math.log(a) - Math.log(b)) : Infinity) : Math.abs(a - b);

// Si el país no trae renta por trabajador, se estima como en el modelo:
// PIB por persona ÷ (población en edad de trabajar × participación × empleo).
function rentaEstimada(p) {
  const pc = observaciones(p, 'pibPerCapita');
  const part = new Map(observaciones(p, 'participacionLaboral').map(o => [o.anio, o.valor]));
  const des = new Map(observaciones(p, 'desempleo').map(o => [o.anio, o.valor]));
  return pc.filter(o => part.has(o.anio) && des.has(o.anio))
    .map(o => ({ anio: o.anio, valor: o.valor / (0.78 * part.get(o.anio) / 100 * (1 - des.get(o.anio) / 100)) }))
    .filter(o => Number.isFinite(o.valor));
}

/** Prepara una vez el índice: por indicador, el último dato de cada país y la serie completa. */
export function prepara(crudo) {
  const paises = crudo?.paises ?? crudo;
  if (!Array.isArray(paises) || !paises.length) return null;
  const indice = {};
  for (const [mia, { clave }] of Object.entries(MAPA)) {
    const ultimos = [], todas = [];
    for (const p of paises) {
      let obs = observaciones(p, clave), fuente = p.indicadores?.[clave]?.fuente || p.fuente?.nombre || 'Banco Mundial';
      if (!obs.length && clave === 'rentaTrabajador') { obs = rentaEstimada(p); fuente = 'Banco Mundial (estimado con PIB por persona, participación y empleo)'; }
      if (!obs.length) continue;
      const nombre = p.nombre || p.codigo, ord = [...obs].sort((a, b) => a.anio - b.anio), fin = ord[ord.length - 1];
      ultimos.push({ pais: nombre, valor: fin.valor, anio: fin.anio, fuente });
      for (const o of ord) todas.push({ pais: nombre, valor: o.valor, anio: o.anio, fuente });
    }
    if (ultimos.length) indice[mia] = { ultimos, todas };
  }
  return Object.keys(indice).length ? indice : null;
}

// El dato más parecido; a igual distancia, el más reciente.
const masCerca = (lista, valor, tipo) => lista.reduce((mejor, x) => {
  const d = dist(tipo, valor, x.valor);
  return !mejor || d < mejor._d || (d === mejor._d && x.anio > mejor.anio) ? { ...x, _d: d } : mejor;
}, null);

/** Para cada tarjeta: el país real más parecido hoy y el año concreto más parecido de la historia. */
export function comparaTodo(estado, indice) {
  if (!indice) return {};
  const ma = estado.macro, tr = estado.trabajo, real = ma.pibRealEncadenado ?? ma.pibReal;
  const pctPib = v => ma.pibNominal ? v / ma.pibNominal * 100 : 0;
  const mios = {
    pib: ma.pibNominal, pibreal: real, pibpersona: real / estado.pais.poblacion,
    rentatrab: real / (tr.ocupados / 100 * estado.pais.poblacion),
    desempleo: tr.desempleo, inflacion: ma.inflacion * 100, crecimiento: ma.crecimiento * 100, participacion: tr.participacion,
    exportaciones: pctPib(ma.exportaciones), importaciones: pctPib(ma.importaciones)
  };
  const salida = {};
  for (const [mia, cfg] of Object.entries(MAPA)) {
    const datos = indice[mia], mio = mios[mia];
    if (!datos || !Number.isFinite(mio)) { salida[mia] = null; continue; }
    const actual = masCerca(datos.ultimos, mio, cfg.tipo), historico = masCerca(datos.todas, mio, cfg.tipo);
    salida[mia] = {
      mio, tipo: cfg.unidad, persona: !!cfg.persona,
      pais: actual?.pais, valor: actual?.valor, anio: actual?.anio, fuente: actual?.fuente,
      historico: historico && (historico.pais !== actual?.pais || historico.anio !== actual?.anio) ? historico : null
    };
  }
  return salida;
}
