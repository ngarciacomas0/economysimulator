/**
 * MiniPaís — Agente 4: catálogo de eventos y director del cálculo.
 *
 * Une el trabajo de los demás agentes y devuelve el estado que dibuja la pantalla:
 *   Agente 1 · mercados.js   → crearMercado, equilibrio, curvas
 *   Agente 2 · trabajo.js    → crearTrabajo, actualizarTrabajo, curvasTrabajo
 *   Agente 3 · macro.js      → calcularMacro
 *
 * Exporta:
 *   crearEstado(poblacionMillones, perfil, nMercados, datosMercados?)
 *   aplicarEvento(estado, evento) → { evento, antes, despues, rondas, frases }
 *   sortearTamaño(evento)
 *
 * Orden del cálculo (sección 3): noticia → mercado → trabajo → ola → país.
 * Si algún módulo falta, aquí se aplican las mismas fórmulas del manual.
 */
const mod = async r => { try { return await import(r); } catch { return null; } };
const mercadosMod = await mod('./mercados.js');
const trabajoMod = await mod('./trabajo.js');
const macroMod = await mod('./macro.js');
const fn = (m, n) => (m && typeof m[n] === 'function' ? m[n] : null);
const crearMercado1 = fn(mercadosMod, 'crearMercado'), equilibrio1 = fn(mercadosMod, 'equilibrio'), curvas1 = fn(mercadosMod, 'curvas');
const crearTrabajo2 = fn(trabajoMod, 'crearTrabajo'), actualizar2 = fn(trabajoMod, 'actualizarTrabajo'), curvas2 = fn(trabajoMod, 'curvasTrabajo');
const calcularMacro3 = fn(macroMod, 'calcularMacro');

export const PARAMETROS = Object.freeze({
  mayores: 0.78, salariosDelPib: 0.55, empleoPorProduccion: 0.5, rigidezSalarial: 0.30,
  trasladoSalarial: 0.30, rondas: 3, desempleoMinimo: 0.02, topeGolpe: 40, topeCrecimiento: 0.0599
});

// [id, nombre, peso en el PIB, sensibilidad demanda, sensibilidad oferta, precio de partida, % importado, unidad]
const MERCADOS = [
  ['alimentos', 'Alimentos', 18, -0.3, 0.4, 5, 10, 'canastas'],
  ['energia', 'Energía', 12, -0.2, 0.3, 70, 25, 'megavatios hora'],
  ['vivienda', 'Vivienda', 20, -0.6, 0.6, 900, 2, 'alquileres mensuales'],
  ['ropa', 'Ropa y hogar', 12, -1.1, 1.5, 25, 45, 'prendas'],
  ['tecnologia', 'Tecnología', 14, -1.5, 1.2, 400, 60, 'aparatos'],
  ['salud', 'Salud y educación', 24, -0.25, 0.5, 120, 5, 'consultas'],
  ['auto', 'Automotriz y transporte', 12, -1.2, 1.0, 8000, 55, 'vehículos'],
  ['turismo', 'Turismo y ocio', 10, -1.3, 1.2, 150, 10, 'viajes']
];
const PERFILES = { emergente: [6000, 0.62, 0.09, 'emergente'], medio: [20000, 0.64, 0.06, 'medio_alto'], desarrollado: [45000, 0.66, 0.045, 'desarrollado'] };

// Demografía por perfil (cada evento = 1 año). Un país desarrollado crece poco en población
// pero su participación laboral (PEA) tiende a subir más; uno emergente, al revés.
//   g: crecimiento anual de la población · ruidoG: desviación ± · tend: cambio anual de la participación (puntos) · ruidoP: desviación ±
export const DEMOGRAFIA = {
  emergente:    { g: 0.016, ruidoG: 0.002, tend: 0.05, ruidoP: 0.30 },
  medio:        { g: 0.009, ruidoG: 0.002, tend: 0.10, ruidoP: 0.30 },
  desarrollado: { g: 0.003, ruidoG: 0.001, tend: 0.20, ruidoP: 0.25 }
};
const ruido = r => (Math.random() * 2 - 1) * r;
const copia = o => JSON.parse(JSON.stringify(o));
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
const recorta = v => limitar(v, -PARAMETROS.topeGolpe, PARAMETROS.topeGolpe);

// ---------------------------------------------------------------- mercados (Agente 1)
const puntosXY = lista => lista.map(p => ({ x: p.cantidad ?? p.x, y: p.precio ?? p.y }));

function nuevoMercado(cfg, poblacion, PIB) {
  if (crearMercado1) return crearMercado1(cfg, poblacion, PIB);
  const P0 = cfg.precioInicial, Q0 = (PIB * cfg.pesoPIB / 100) / P0;
  const b = Math.abs(cfg.sensibilidadDemanda) * Q0 / P0, d = cfg.sensibilidadOferta * Q0 / P0;
  return { ...cfg, precioInicial: P0, cantidadInicial: Q0, a: Q0 + b * P0, b, c: Q0 - d * P0, d };
}
function equilibrioDe(base, golpes) {
  if (equilibrio1) {
    try {
      const r = equilibrio1(base, golpes);
      // Corrección: mercados.js calcula la cantidad con Q = c + d·P y se deja fuera el
      // desplazamiento de la oferta, así que un subsidio bajaba precio Y cantidad. La oferta
      // desplazada es Q = c + S·Q0 + d·P, y S viene en el propio resultado (golpesAplicados).
      const S = r.golpesAplicados?.oferta ?? 0;
      const cantidad = Math.max(0, base.c + S * base.cantidadInicial + base.d * r.precio);
      return { ...r, cantidad };
    } catch (e) { console.warn('MiniPaís · mercados.js rechazó un golpe:', e.message); }
  }
  let D = 0, S = 0;
  for (const g of golpes) {
    const v = limitar(g.valor, -40, 40) / 100;
    if (g.tipo === 'demanda' || g.tipo === 'exportaciones') D += v;
    else if (g.tipo === 'importaciones') D -= limitar(g.valor, -20, 20) / 100;
    else if (g.tipo === 'oferta') S += v;
    else if (g.tipo === 'impuesto') S -= limitar(g.valor, -20, 20) / 100 * base.sensibilidadOferta;
  }
  D = limitar(D, -.4, .4); S = limitar(S, -.4, .4);
  const precio = Math.max(0, (base.a - base.c + (D - S) * base.cantidadInicial) / (base.b + base.d));
  return { precio, cantidad: Math.max(0, base.c + base.d * precio) };
}
function curvasDe(base, golpes) {
  if (curvas1) { try { const c = curvas1(base, golpes); return { demanda: puntosXY(c.despues.demanda), oferta: puntosXY(c.despues.oferta) }; }
    catch (e) { console.warn('MiniPaís · curvas de mercados.js:', e.message); } }
  const eq = equilibrioDe(base, golpes), P0 = base.precioInicial;
  // Rectas que pasan por el equilibrio con las mismas pendientes.
  const pts = f => Array.from({ length: 21 }, (_, i) => { const P = 2 * P0 * i / 20; return { x: Math.max(0, f(P)), y: P }; });
  return { demanda: pts(P => eq.cantidad + base.b * (eq.precio - P)), oferta: pts(P => eq.cantidad + base.d * (P - eq.precio)) };
}
// Vuelve a resolver todos los mercados con los golpes que lleven acumulados.
function resolver(mercados) {
  for (const m of mercados) {
    const r = equilibrioDe(m.base, m.golpes);
    m.precio = r.precio; m.cantidad = r.cantidad;
    m.curvas = curvasDe(m.base, m.golpes);
  }
}

// Rehace las rectas tomando como punto de partida el precio y la cantidad de ahora.
// Mantiene las sensibilidades, así que la elasticidad en el nuevo punto es la misma.
function reanclar(m) {
  const P0 = m.precio, Q0 = m.cantidad;
  if (!(P0 > 0) || !(Q0 > 0)) return;
  // Las pendientes NO cambian: así la curva que no recibió el golpe queda exactamente donde estaba
  // y en el evento siguiente se mueve solo la que toca.
  const { b, d } = m.base;
  m.base = { ...m.base, precioInicial: P0, cantidadInicial: Q0, a: Q0 + b * P0, c: Q0 - d * P0 };
  m.P0 = P0; m.Q0 = Q0; m.golpes = [];
}

// ---------------------------------------------------------------- trabajo (Agente 2)
// trabajo.js cuenta personas; la pantalla usa % de la población. Aquí se traduce.
function adaptaTrabajo(t, poblacion) {
  const pct = v => v / poblacion * 100;
  let cur = null;
  if (curvas2) { try { cur = curvas2(t); } catch { cur = null; } }
  const curvas = cur
    ? { demanda: cur.demanda.map(p => ({ x: pct(p.trabajadores), y: p.salario })), oferta: cur.oferta.map(p => ({ x: pct(p.trabajadores), y: p.salario })) }
    : { demanda: [], oferta: [] };
  return { _t: t, A: t.A, B: t.B, salario: t.salario, w: t.salario,
    ocupados: pct(t.grupos.ocupados), fuerzaLaboral: pct(t.fuerzaLaboral), desocupados: pct(t.grupos.desocupados),
    desempleo: t.desempleo * 100, participacion: t.participacion * 100, masaSalarial: t.masaSalarial,
    curvas, grupos: t.porcentajes };
}
function trabajoInicial(poblacion, perfilNombre, PIB, participacion, desempleo) {
  if (crearTrabajo2) return adaptaTrabajo(crearTrabajo2({ poblacion, perfil: perfilNombre, pib: PIB }), poblacion);
  const mayores = poblacion * PARAMETROS.mayores, fuerza = mayores * participacion;
  const desoc = fuerza * desempleo, ocup = fuerza - desoc, pct = v => v / poblacion * 100;
  const A = ocup, B = fuerza, base = (0.55 * PIB) / ocup;
  const pts = f => Array.from({ length: 21 }, (_, i) => { const s = 0.5 + i * 0.05; return { x: pct(f(s)), y: s }; });
  return { _t: { A, B, salario: 1, salarioBase: base, poblacion, pib: PIB, salarioEquilibrioInicial: (A / B) ** 1.25 },
    A, B, salario: 1, w: 1, ocupados: pct(ocup), fuerzaLaboral: pct(fuerza), desocupados: pct(desoc),
    desempleo: desempleo * 100, participacion: participacion * 100, masaSalarial: base * ocup,
    curvas: { demanda: pts(s => A * s ** -0.5), oferta: pts(s => B * s ** 0.3) }, grupos: {} };
}
// El salario es un mínimo (índice 1 = US$ 1.000 al mes) que sube lo mismo que los precios, así que en términos reales no se mueve.
// El nivel de precios acumulado vive en trabajo.indicePrecios; las curvas se calculan en términos reales.
// Lo que cambia es la demanda de trabajo (A). Con el salario quieto, el desempleo es la distancia
// entre la gente que quiere trabajar a ese salario (B) y los puestos que ofrecen las empresas (A).
function trabajoTras(inicial, crecimiento, poblacion, dem = { fA: 1, fB: 1 }) {
  const c = limitar(crecimiento, -PARAMETROS.topeCrecimiento, PARAMETROS.topeCrecimiento);
  // fA: las empresas crecen con la tendencia de la población activa; fB: la población activa real (tendencia + desviación).
  const t = inicial._t, A = t.A * dem.fA * (1 + PARAMETROS.empleoPorProduccion * c), B = t.B * dem.fB, w = 1;
  const Ls = B, Ld = A * w ** -0.5;
  const desoc = Math.max(Ls - Ld, PARAMETROS.desempleoMinimo * Ls), ocup = Ls - desoc, pct = v => v / poblacion * 100;
  const pts = f => Array.from({ length: 21 }, (_, i) => { const s = 0.5 + i * 0.05; return { x: pct(f(s)), y: s }; });
  return { _t: { ...t, A, B, salario: w }, A, B, salario: w, w, ocupados: pct(ocup), fuerzaLaboral: pct(Ls), desocupados: pct(desoc),
    desempleo: desoc / Ls * 100, participacion: Ls / (poblacion * PARAMETROS.mayores) * 100, masaSalarial: (t.salarioBase ?? 1) * w * ocup,
    curvas: { demanda: pts(s => A * s ** -0.5), oferta: pts(s => B * s ** 0.3) }, grupos: {} };
}

// ---------------------------------------------------------------- país (Agente 3)
function bloqueMacro(mercados, antes, poblacion, pibInicial, pibRealAnterior) {
  const filas = mercados.map((m, i) => ({ id: m.id, precio: m.precio, cantidad: m.cantidad,
    precioAnterior: antes[i].precio, cantidadAnterior: antes[i].cantidad,
    porcentajeExportaciones: m.exp, porcentajeImportaciones: m.imp,
    golpesActivos: m.golpes.map(g => ({ tipo: g.tipo, valor: g.valor })) }));
  if (calcularMacro3) {
    const r = calcularMacro3(filas, { poblacion, pibInicial, pibRealAnterior });
    const g = r.composicionGasto, pct = x => (r.pibNominal ? x / r.pibNominal * 100 : 0);
    return { pibNominal: r.pibNominal, pibReal: r.pibReal, crecimiento: r.crecimientoReal, inflacion: r.inflacion,
      pibPorPersona: r.pibPorPersona, exportaciones: r.exportaciones, importaciones: r.importaciones,
      composicion: { consumo: pct(g.consumo), inversion: pct(g.inversion), gasto: pct(g.gastoPublico), comercio: pct(g.comercioNeto) } };
  }
  const nom = filas.reduce((s, m) => s + m.precio * m.cantidad, 0);
  const real = filas.reduce((s, m) => s + m.precioAnterior * m.cantidad, 0);
  const infl = filas.reduce((s, m) => s + (m.precioAnterior * m.cantidadAnterior / pibInicial) * (m.precio / m.precioAnterior - 1), 0);
  const exp = filas.reduce((s, m) => s + m.precio * m.cantidad * m.porcentajeExportaciones, 0);
  const imp = filas.reduce((s, m) => s + m.precio * m.cantidad * m.porcentajeImportaciones, 0);
  const cre = pibRealAnterior ? real / pibRealAnterior - 1 : 0, inv = pibInicial * .2 * (1 + 2 * cre), gas = pibInicial * .18, com = exp - imp;
  return { pibNominal: nom, pibReal: real, crecimiento: cre, inflacion: infl, pibPorPersona: nom / poblacion, exportaciones: exp, importaciones: imp,
    composicion: { consumo: (nom - inv - gas - com) / nom * 100, inversion: inv / nom * 100, gasto: gas / nom * 100, comercio: com / nom * 100 } };
}

// ---------------------------------------------------------------- el estado del país
export function crearEstado(poblacionMillones = 10, perfil = 'medio', nMercados = 6, datosMercados = null) {
  const [ingreso, participacion, desempleo, perfilTrabajo] = PERFILES[perfil] || PERFILES.medio;
  const poblacion = poblacionMillones * 1e6, PIB = poblacion * ingreso;
  const tabla = (datosMercados?.length
    ? datosMercados.map(x => [x.id, x.nombre, x.peso, x.sd, x.so, x.P0 || 10, x.imp ?? 15, x.unidad || 'unidades'])
    : MERCADOS).slice(0, limitar(nMercados, 4, 8));
  const total = tabla.reduce((s, x) => s + x[2], 0);                     // los pesos se normalizan a 100 %
  const mercados = tabla.map(([id, nombre, peso, sd, so, P0, imp, unidad]) => {
    const pesoPIB = peso / total * 100;
    const base = nuevoMercado({ id, nombre, unidad, precioInicial: P0, cantidadInicial: (PIB * pesoPIB / 100) / P0,
      pesoPIB, sensibilidadDemanda: sd, sensibilidadOferta: so, porcentajeImportado: imp }, poblacion, PIB);
    return { id, nombre, unidad, base, peso: pesoPIB / 100, P0: base.precioInicial, Q0: base.cantidadInicial,
      precio: base.precioInicial, cantidad: base.cantidadInicial, golpes: [], imp: imp / 100, exp: 0.15,
      curvas: curvasDe(base, []) };
  });
  const trabajo = trabajoInicial(poblacion, perfilTrabajo, PIB, participacion, desempleo); trabajo.indicePrecios = 1;
  const macro = bloqueMacro(mercados, mercados, poblacion, PIB, PIB);
  macro.pibRealEncadenado = macro.pibNominal;
  return { pais: { nombre: 'MiniPaís', poblacion, perfil, ingreso, participacion: trabajo.participacion ?? participacion * 100, anio: 0 }, mercados, trabajo, macro, historia: [macro.pibNominal] };
}

// ---------------------------------------------------------------- el evento
export function sortearTamaño(evento) {
  return { ...evento, efectos: (evento.efectos || []).map(g => {
    if (Number.isFinite(g.valor)) return { ...g, valor: recorta(g.valor) };
    const r = Array.isArray(g.rango) ? g.rango : [g.min, g.max];
    const [a, b] = [Math.min(...r), Math.max(...r)];
    return { ...g, valor: recorta(Math.round((a + Math.random() * (b - a)) * 10) / 10) };
  }) };
}

export function aplicarEvento(estado, evento) {
  const ev = sortearTamaño(evento);
  const antes = copia(estado), e = copia(estado);
  // La copia pierde las funciones, pero no las necesitamos: base es solo números.
  const pibInicial = antes.macro.pibNominal;
  // ① Pasa un año: la población crece y la participación laboral se desvía un poco de su tendencia.
  const D = DEMOGRAFIA[e.pais.perfil] || DEMOGRAFIA.medio;
  const pob0 = antes.pais.poblacion, part0 = antes.pais.participacion ?? antes.trabajo.participacion;
  const g = D.g + ruido(D.ruidoG), partT = part0 + D.tend, part1 = limitar(partT + ruido(D.ruidoP), 40, 80);
  e.pais.poblacion = pob0 * (1 + g); e.pais.participacion = part1; e.pais.anio = (antes.pais.anio ?? 0) + 1;
  const dem = { fA: (1 + g) * partT / part0, fB: (1 + g) * part1 / part0 };
  const poblacion = e.pais.poblacion;

  // ② Mercado: cada golpe se guarda y las curvas se mueven.
  for (const m of e.mercados) m.golpes = [];
  const golpeados = new Set();
  for (const g of ev.efectos || []) {
    if (!Number.isFinite(g.valor)) continue;
    // El manual: el mercado «todos» solo admite demanda y exportaciones.
    if (g.mercado === 'todos' && !['demanda', 'exportaciones'].includes(g.tipo)) continue;
    for (const m of e.mercados) {
      if (g.mercado !== 'todos' && m.id !== g.mercado) continue;
      m.golpes.push({ mercado: m.id, tipo: g.tipo, valor: g.valor }); golpeados.add(m.id);
    }
  }
  resolver(e.mercados);

  // ③ Trabajo: las ventas mueven el empleo y el salario.
  const pibReal = () => e.mercados.reduce((s, m, i) => s + antes.mercados[i].precio * m.cantidad, 0);
  const crecer = () => pibReal() / pibInicial - 1;
  e.trabajo = trabajoTras(antes.trabajo, crecer(), poblacion, dem);

  // ④ Ola: por cada peso de salarios ganado o perdido, 0,30 de compras en los demás mercados.
  const rondas = [];
  let masaPrevia = antes.trabajo.masaSalarial;
  for (let r = 1; r <= PARAMETROS.rondas; r++) {
    const cambio = e.trabajo.masaSalarial - masaPrevia;
    if (!Number.isFinite(cambio) || Math.abs(cambio) < pibInicial * 1e-6) break;
    const intensidad = {};
    for (const m of e.mercados) {
      if (golpeados.has(m.id)) continue;                                  // el mercado del golpe no recibe la ola
      const extra = PARAMETROS.trasladoSalarial * cambio * m.peso / (m.P0 * m.Q0) * 100;   // en %
      m.golpes.push({ mercado: m.id, tipo: 'demanda', valor: recorta(extra) });
      intensidad[m.id] = Math.abs(extra);
    }
    masaPrevia = e.trabajo.masaSalarial;
    resolver(e.mercados);
    e.trabajo = trabajoTras(antes.trabajo, crecer(), poblacion, dem);
    rondas.push({ n: r, numero: r, intensidad });
  }

  // ⑤ País.
  // El PIB real se mide con los precios de ANTES, así que hay que compararlo con el PIB nominal
  // de antes, que usa esos mismos precios. Mezclar bases daba crecimientos con el signo cambiado.
  e.macro = bloqueMacro(e.mercados, antes.mercados, poblacion, pibInicial, pibInicial);
  // Encadenado: cada evento multiplica el anterior por su crecimiento real, así las cifras se comparan entre sí.
  e.macro.pibRealEncadenado = (antes.macro.pibRealEncadenado ?? antes.macro.pibNominal) * (1 + e.macro.crecimiento);
  // El salario mínimo nominal se ajusta con la inflación del evento.
  e.trabajo.indicePrecios = (antes.trabajo.indicePrecios ?? 1) * (1 + (e.macro.inflacion || 0));
  e.historia = [...(antes.historia || []), e.macro.pibNominal];

  for (const m of e.mercados) reanclar(m);          // el próximo evento parte de aquí
  for (const m of e.mercados) m.curvas = curvasDe(m.base, []);

  const frases = e.mercados.filter(m => golpeados.has(m.id)).map(m => {
    const a = antes.mercados.find(x => x.id === m.id);
    return `${m.nombre}: ${m.precio >= a.precio ? 'ganan los productores y pierden los compradores' : 'ganan los compradores y pierden los productores'}.`;
  });
  return { evento: ev, antes, despues: e, rondas, frases };
}

export const nuevo = crearEstado;
