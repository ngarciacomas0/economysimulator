// Agente 7 · Comparación con países reales y con años concretos de la historia.
// Lee datos/paises.json tal como lo genera scripts/actualizar_datos.js:
//   paises[].indicadores[clave] = { nombre, codigo, unidad, fuente, observaciones: [{anio, valor, fuente}] }
// Acepta también que el indicador sea directamente el array de observaciones.

// Qué indicador del Banco Mundial corresponde a cada tarjeta, y cómo se mide el parecido.
const MAPA = {
  pib:            { clave: 'pibNominal',     tipo: 'log',   unidad: 'dinero' },
  pibreal:        { clave: 'pibReal',        tipo: 'log',   unidad: 'dinero' },
  pibpersona:     { clave: 'pibPerCapita',   tipo: 'log',   unidad: 'dinero' },
  desempleo:      { clave: 'desempleo',      tipo: 'simple', unidad: 'pct' },
  inflacion:      { clave: 'inflacion',      tipo: 'simple', unidad: 'pct' },
  crecimiento:    { clave: 'crecimientoReal', tipo: 'simple', unidad: 'pct' },
  participacion:  { clave: 'participacionLaboral', tipo: 'simple', unidad: 'pct' },
  exportaciones:  { clave: 'exportaciones',  tipo: 'simple', unidad: 'pctPib' },
  importaciones:  { clave: 'importaciones',  tipo: 'simple', unidad: 'pctPib' },
  rentatrab:      { clave: 'rentaTrabajador', tipo: 'log',  unidad: 'dinero' }
};

const observaciones = (pais, clave) => {
  const nodo = pais?.indicadores?.[clave];
  const obs = Array.isArray(nodo) ? nodo : nodo?.observaciones;
  return Array.isArray(obs) ? obs.filter(o => Number.isFinite(o.valor) && Number.isFinite(o.anio)) : [];
};
const dist = (tipo, a, b) => tipo === 'log'
  ? (a > 0 && b > 0 ? Math.abs(Math.log(a) - Math.log(b)) : Infinity)
  : Math.abs(a - b);

// Prepara una vez el índice: por indicador, el último dato de cada país y la serie completa.
export function prepara(crudo) {
  const paises = crudo?.paises ?? crudo;
  if (!Array.isArray(paises) || !paises.length) return null;
  const indice = {};
  for (const [mia, { clave }] of Object.entries(MAPA)) {
    const ultimos = [], todas = [];
    for (const p of paises) {
      const obs = observaciones(p, clave); if (!obs.length) continue;
      const nombre = p.nombre || p.codigo;
      const fuente = p.indicadores?.[clave]?.fuente || p.fuente?.nombre || 'Banco Mundial';
      const ord = [...obs].sort((a, b) => a.anio - b.anio), fin = ord[ord.length - 1];
      ultimos.push({ pais: nombre, valor: fin.valor, anio: fin.anio, fuente });
      for (const o of ord) todas.push({ pais: nombre, valor: o.valor, anio: o.anio, fuente });
    }
    if (ultimos.length) indice[mia] = { ultimos, todas };
  }
  indice._meta = crudo?.metadata || null;
  return Object.keys(indice).length > 1 ? indice : null;
}

const masCerca = (lista, valor, tipo) => lista.reduce((mejor, x) => {
  const d = dist(tipo, valor, x.valor);
  return !mejor || d < mejor._d || (d === mejor._d && x.anio > mejor.anio) ? { ...x, _d: d } : mejor;
}, null);

// Devuelve, para cada tarjeta: el país real más parecido hoy y el año concreto más parecido.
export function comparaTodo(estado, indice) {
  if (!indice) return {};
  const ma = estado.macro, tr = estado.trabajo;
  const mios = {
    pib: ma.pibNominal, pibreal: ma.pibRealEncadenado ?? ma.pibReal,
    pibpersona: (ma.pibRealEncadenado ?? ma.pibReal) / estado.pais.poblacion,
    rentatrab: (ma.pibRealEncadenado ?? ma.pibReal) / (tr.ocupados / 100 * estado.pais.poblacion),
    desempleo: tr.desempleo, inflacion: ma.inflacion * 100, crecimiento: ma.crecimiento * 100,
    participacion: tr.participacion,
    exportaciones: ma.pibNominal ? ma.exportaciones / ma.pibNominal * 100 : 0,
    importaciones: ma.pibNominal ? ma.importaciones / ma.pibNominal * 100 : 0
  };
  const salida = {};
  for (const [mia, cfg] of Object.entries(MAPA)) {
    const datos = indice[mia]; if (!datos) { salida[mia] = null; continue; }
    const mio = mios[mia];
    if (!Number.isFinite(mio)) { salida[mia] = null; continue; }
    const actual = masCerca(datos.ultimos, mio, cfg.tipo);
    const historico = masCerca(datos.todas, mio, cfg.tipo);
    salida[mia] = { persona: mia === 'pibpersona' || mia === 'rentatrab', mio, unidad: cfg.unidad, tipo: cfg.unidad === 'dinero' ? 'dinero' : cfg.unidad === 'indice' ? 'indice' : 'pct',
      pais: actual?.pais, valor: actual?.valor, anio: actual?.anio, fuente: actual?.fuente,
      historico: historico && (historico.pais !== actual?.pais || historico.anio !== actual?.anio) ? historico : null };
  }
  salida.deflactor = null;
  return salida;
}
