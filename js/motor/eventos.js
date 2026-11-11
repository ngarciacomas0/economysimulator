/**
 * MiniPaís · Director del cálculo: une mercados, trabajo y país.
 *
 *   crearEstado(poblacionMillones, perfil, nMercados, datosMercados?)
 *   aplicarEvento(estado, evento) → { evento, antes, despues, rondas }
 *
 * Cada evento es un año: demografía → mercado golpeado → empleo → ola en los demás mercados → país.
 */
import { crearMercado, equilibrio, curvas } from './mercados.js';
import { crearTrabajo, resolverTrabajo, curvasTrabajo } from './trabajo.js';
import { calcularMacro } from './macro.js';

export const PARAMETROS = Object.freeze({
  empleoPorProduccion: 0.5,   // cuánto responde el empleo al PIB real
  trasladoSalarial: 0.30,     // de cada peso de salario ganado, cuánto se gasta en los demás mercados
  rondas: 3,                  // vueltas máximas de la ola
  topeGolpe: 40,              // ningún golpe pasa de ±40 %
  topeCrecimiento: 0.0599,
  exportaciones: 0.15         // parte de cada mercado que se vende al extranjero
});

// Respaldo si no se puede leer js/datos/mercados.json.
const MERCADOS = [
  { id: 'alimentos', nombre: 'Alimentos', peso: 18, sd: -0.3, so: 0.4, P0: 5, imp: 10, unidad: 'canastas' },
  { id: 'energia', nombre: 'Energía', peso: 12, sd: -0.5, so: 0.8, P0: 70, imp: 25, unidad: 'megavatios hora' },
  { id: 'vivienda', nombre: 'Vivienda', peso: 20, sd: -0.6, so: 0.6, P0: 900, imp: 2, unidad: 'alquileres mensuales' },
  { id: 'ropa', nombre: 'Ropa y hogar', peso: 12, sd: -1.1, so: 1.5, P0: 25, imp: 45, unidad: 'prendas' },
  { id: 'tecnologia', nombre: 'Tecnología', peso: 14, sd: -1.5, so: 1.2, P0: 400, imp: 60, unidad: 'aparatos' },
  { id: 'salud', nombre: 'Salud y educación', peso: 24, sd: -0.25, so: 0.5, P0: 120, imp: 5, unidad: 'consultas' },
  { id: 'auto', nombre: 'Automotriz y transporte', peso: 12, sd: -1.2, so: 1.0, P0: 8000, imp: 55, unidad: 'vehículos' },
  { id: 'turismo', nombre: 'Turismo y ocio', peso: 10, sd: -1.3, so: 1.2, P0: 150, imp: 10, unidad: 'viajes' }
];
const PERFILES = {
  emergente:    { ingreso: 6000, trabajo: 'emergente' },
  medio:        { ingreso: 20000, trabajo: 'medio_alto' },
  desarrollado: { ingreso: 45000, trabajo: 'desarrollado' }
};
// Demografía anual por perfil: g = crecimiento de la población; tend = cambio de la participación (puntos); ruido = desviación ±.
const DEMOGRAFIA = {
  emergente:    { g: 0.016, ruidoG: 0.002, tend: 0.05, ruidoP: 0.30 },
  medio:        { g: 0.009, ruidoG: 0.002, tend: 0.10, ruidoP: 0.30 },
  desarrollado: { g: 0.003, ruidoG: 0.001, tend: 0.20, ruidoP: 0.25 }
};

const ruido = r => (Math.random() * 2 - 1) * r;
const copia = o => JSON.parse(JSON.stringify(o));
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
const recorta = v => limitar(v, -PARAMETROS.topeGolpe, PARAMETROS.topeGolpe);

// ---------------------------------------------------------------- mercados
function resolver(m) {
  const r = equilibrio(m.base, m.golpes);
  m.precio = r.precio; m.cantidad = r.cantidad;
  m.curvas = curvas(m.base, m.golpes);
}

// Al cerrar el año las rectas se rehacen desde el precio y la cantidad de ahora, con las mismas
// pendientes: la curva que no recibió golpe queda donde estaba y el próximo evento parte de aquí.
function reanclar(m) {
  const P0 = m.precio, Q0 = m.cantidad;
  if (P0 > 0 && Q0 > 0) {
    const { b, d } = m.base;
    m.base = { ...m.base, precioInicial: P0, cantidadInicial: Q0, a: Q0 + b * P0, c: Q0 - d * P0 };
    m.P0 = P0; m.Q0 = Q0;
  }
  m.golpes = [];
  m.curvas = curvas(m.base, []);
}

// ---------------------------------------------------------------- trabajo
// El motor cuenta personas; la pantalla usa % de la población y salario como índice.
function trabajoEnPantalla(t) {
  const pct = v => v / t.poblacion * 100;
  const enPct = lista => lista.map(p => ({ x: pct(p.trabajadores), y: p.salario }));
  const c = curvasTrabajo(t);
  return {
    _t: t, A: t.A, B: t.B, salario: t.salario, w: t.salario, masaSalarial: t.masaSalarial,
    ocupados: pct(t.ocupados), fuerzaLaboral: pct(t.fuerzaLaboral), desocupados: pct(t.desocupados),
    desempleo: t.desempleo * 100, participacion: t.participacion * 100,
    curvas: { demanda: enPct(c.demanda), oferta: enPct(c.oferta) }
  };
}

// Un año después: las empresas contratan según el PIB real (A) y la población activa cambia (B).
function trabajoTras(previo, crecimiento, poblacion, dem) {
  const c = limitar(crecimiento, -PARAMETROS.topeCrecimiento, PARAMETROS.topeCrecimiento);
  const t = previo._t;
  return trabajoEnPantalla(resolverTrabajo({
    A: t.A * dem.fA * (1 + PARAMETROS.empleoPorProduccion * c),
    B: t.B * dem.fB,
    poblacion, salarioBase: t.salarioBase
  }));
}

// ---------------------------------------------------------------- país
function bloqueMacro(mercados, antes, poblacion, pibInicial) {
  const filas = mercados.map((m, i) => ({
    id: m.id, precio: m.precio, cantidad: m.cantidad,
    precioAnterior: antes[i].precio, cantidadAnterior: antes[i].cantidad,
    porcentajeExportaciones: m.exp, porcentajeImportaciones: m.imp, golpesActivos: m.golpes
  }));
  // El PIB real usa los precios de antes, así que se compara con el PIB nominal de antes (mismos precios).
  const r = calcularMacro(filas, { poblacion, pibInicial, pibRealAnterior: pibInicial });
  return {
    pibNominal: r.pibNominal, pibReal: r.pibReal, crecimiento: r.crecimientoReal, inflacion: r.inflacion,
    pibPorPersona: r.pibPorPersona, exportaciones: r.exportaciones, importaciones: r.importaciones
  };
}

// ---------------------------------------------------------------- estado inicial
export function crearEstado(poblacionMillones = 10, perfil = 'medio', nMercados = 6, datosMercados = null) {
  const p = PERFILES[perfil] || PERFILES.medio;
  const poblacion = poblacionMillones * 1e6, PIB = poblacion * p.ingreso;
  const tabla = (datosMercados?.length ? datosMercados : MERCADOS).slice(0, limitar(nMercados, 4, 8));
  const total = tabla.reduce((s, x) => s + x.peso, 0);           // los pesos se normalizan a 100 %

  const mercados = tabla.map(x => {
    const pesoPIB = x.peso / total * 100;
    const base = crearMercado({
      id: x.id, nombre: x.nombre, unidad: x.unidad || 'unidades', precioInicial: x.P0 || 10,
      pesoPIB, sensibilidadDemanda: x.sd, sensibilidadOferta: x.so, porcentajeImportado: x.imp ?? 15
    }, poblacion, PIB);
    return {
      id: x.id, nombre: x.nombre, unidad: base.unidad, base, peso: pesoPIB / 100,
      P0: base.precioInicial, Q0: base.cantidadInicial, precio: base.precioInicial, cantidad: base.cantidadInicial,
      golpes: [], imp: base.porcentajeImportado / 100, exp: PARAMETROS.exportaciones, curvas: curvas(base, [])
    };
  });

  const trabajo = trabajoEnPantalla(crearTrabajo({ poblacion, perfil: p.trabajo, pib: PIB }));
  trabajo.indicePrecios = 1;                                      // nivel de precios acumulado (1 = al inicio)
  const macro = bloqueMacro(mercados, mercados, poblacion, PIB);
  macro.pibRealEncadenado = macro.pibNominal;
  return {
    pais: { nombre: 'MiniPaís', poblacion, perfil, ingreso: p.ingreso, participacion: trabajo.participacion, anio: 0 },
    mercados, trabajo, macro, historia: [macro.pibNominal]
  };
}

// ---------------------------------------------------------------- el evento
/** El catálogo trae rangos [mín, máx]: cada simulación sortea un valor dentro (el signo no cambia). */
export function sortearTamaño(evento) {
  return { ...evento, efectos: (evento.efectos || []).map(g => {
    if (Number.isFinite(g.valor)) return { ...g, valor: recorta(g.valor) };
    const [a, b] = [Math.min(...g.rango), Math.max(...g.rango)];
    return { ...g, valor: recorta(Math.round((a + Math.random() * (b - a)) * 10) / 10) };
  }) };
}

export function aplicarEvento(estado, evento) {
  const ev = sortearTamaño(evento);
  const antes = copia(estado), e = copia(estado);
  const pibInicial = antes.macro.pibNominal;

  // ① Pasa un año: la población crece y la participación laboral se desvía un poco de su tendencia.
  const D = DEMOGRAFIA[e.pais.perfil] || DEMOGRAFIA.medio;
  const part0 = antes.pais.participacion ?? antes.trabajo.participacion;
  const g = D.g + ruido(D.ruidoG), partT = part0 + D.tend, part1 = limitar(partT + ruido(D.ruidoP), 40, 80);
  const poblacion = antes.pais.poblacion * (1 + g);
  e.pais.poblacion = poblacion; e.pais.participacion = part1; e.pais.anio = (antes.pais.anio ?? 0) + 1;
  // fA: las empresas siguen la tendencia de la población activa; fB: la población activa real.
  const dem = { fA: (1 + g) * partT / part0, fB: (1 + g) * part1 / part0 };

  // ② Mercado: cada golpe se guarda en su mercado y las curvas se mueven.
  const golpeados = new Set();
  for (const m of e.mercados) m.golpes = [];
  for (const gol of ev.efectos) {
    if (!Number.isFinite(gol.valor)) continue;
    if (gol.mercado === 'todos' && !['demanda', 'exportaciones'].includes(gol.tipo)) continue;
    for (const m of e.mercados) {
      if (gol.mercado !== 'todos' && m.id !== gol.mercado) continue;
      m.golpes.push({ mercado: m.id, tipo: gol.tipo, valor: gol.valor }); golpeados.add(m.id);
    }
  }
  e.mercados.forEach(resolver);

  // ③ Trabajo: las ventas mueven el empleo.
  const crecimiento = () => e.mercados.reduce((s, m, i) => s + antes.mercados[i].precio * m.cantidad, 0) / pibInicial - 1;
  e.trabajo = trabajoTras(antes.trabajo, crecimiento(), poblacion, dem);

  // ④ Ola: por cada peso de salario ganado o perdido, una parte se compra en los demás mercados.
  const rondas = [];
  let masaPrevia = antes.trabajo.masaSalarial;
  for (let r = 1; r <= PARAMETROS.rondas; r++) {
    const cambio = e.trabajo.masaSalarial - masaPrevia;
    if (!Number.isFinite(cambio) || Math.abs(cambio) < pibInicial * 1e-6) break;
    const intensidad = {};
    for (const m of e.mercados) {
      if (golpeados.has(m.id)) continue;                        // el mercado del golpe no recibe la ola
      const extra = PARAMETROS.trasladoSalarial * cambio * m.peso / (m.P0 * m.Q0) * 100;   // en %
      m.golpes.push({ mercado: m.id, tipo: 'demanda', valor: recorta(extra) });
      intensidad[m.id] = Math.abs(extra);
    }
    masaPrevia = e.trabajo.masaSalarial;
    e.mercados.forEach(resolver);
    e.trabajo = trabajoTras(antes.trabajo, crecimiento(), poblacion, dem);
    rondas.push({ n: r, intensidad });
  }

  // ⑤ País.
  e.macro = bloqueMacro(e.mercados, antes.mercados, poblacion, pibInicial);
  // Encadenado: cada evento multiplica el anterior por su crecimiento real, así las cifras se comparan entre sí.
  e.macro.pibRealEncadenado = (antes.macro.pibRealEncadenado ?? antes.macro.pibNominal) * (1 + e.macro.crecimiento);
  // El salario mínimo nominal sube con la inflación; las curvas se dibujan en términos reales.
  e.trabajo.indicePrecios = (antes.trabajo.indicePrecios ?? 1) * (1 + (e.macro.inflacion || 0));
  e.historia = [...(antes.historia || []), e.macro.pibNominal];

  e.mercados.forEach(reanclar);
  return { evento: ev, antes, despues: e, rondas };
}
