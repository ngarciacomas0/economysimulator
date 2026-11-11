// Agente 7 · Director de orquesta. Un solo estado; todo se dibuja con render(estado, informe).
import { identidad, globito, resumen, etiquetaNivel, textoPaso, tipoDe, nombreTipo, explicaMercado } from './ui/narrativa.js';
import { graficoMercado, graficoTrabajo, reiniciaGrafica, setMonopolio, monopolioDe } from './ui/graficos.js';
import { renderKpis, detalleKpi } from './ui/kpis.js';
import { conectar } from './conector.js';
import { prepara, comparaTodo } from './ui/comparar.js';

const $ = s => document.querySelector(s);
const sinMov = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esperar = ms => new Promise(r => setTimeout(r, sinMov ? 0 : ms));

// ---------- DATOS DE MENTIRA (mismo formato de la sección 5) ----------
// Cuando existan los motores reales (motor/eventos.js, mercados.js...), se usan solos.
const PERFILES = { emergente: [6000, 62, 9], medio: [20000, 64, 6], desarrollado: [45000, 66, 4.5] };
const MK = [   // respaldo; si existe datos/mercados.json, se reemplaza por esos mercados
  ['alimentos', 'Alimentos', 18, -.3, .4, 5, 10], ['energia', 'Energía', 12, -.5, .8, 70, 25], ['vivienda', 'Vivienda', 20, -.6, .6, 900, 2], ['ropa', 'Ropa y hogar', 12, -1.1, 1.5, 25, 45], ['tecnologia', 'Tecnología', 14, -1.5, 1.2, 400, 60], ['salud', 'Salud y educación', 24, -.25, .5, 120, 5], ['auto', 'Automotriz y transporte', 12, -1.2, 1, 8000, 55], ['turismo', 'Turismo y ocio', 10, -1.3, 1.2, 150, 10]];
// Respaldo mínimo: el catálogo completo vive en js/datos/eventos.json y es el que se usa normalmente.
const EVENTOS = [
  { id: 'moda', categoria: 'gustos', titular: 'Los consumidores se vuelcan a la ropa importada', explicacion: 'Una nueva moda llega de afuera. Las tiendas locales venden menos.', efectos: [{ mercado: 'ropa', tipo: 'importaciones', valor: 25 }] },
  { id: 'sequia', categoria: 'clima', titular: 'Sequía golpea los cultivos del país', explicacion: 'Llovió muy poco. Cultivar cuesta más y se cosecha menos.', efectos: [{ mercado: 'alimentos', tipo: 'oferta', valor: -30 }] },
  { id: 'chips', categoria: 'tecnologia', titular: 'Celulares y laptops se abaratan', explicacion: 'Una nueva fábrica baja los costos. Todos pueden comprar más.', efectos: [{ mercado: 'tecnologia', tipo: 'oferta', valor: 30 }] },
  { id: 'vejez', categoria: 'politica', titular: 'El país envejece y pide más salud', explicacion: 'Hay más personas mayores. Los hospitales tienen más pacientes.', efectos: [{ mercado: 'salud', tipo: 'demanda', valor: 20 }] },
  { id: 'recesion', categoria: 'crisis', titular: 'Recesión en los países vecinos', explicacion: 'Los vecinos compran menos. Las ventas al extranjero se frenan.', efectos: [{ mercado: 'todos', tipo: 'exportaciones', valor: -15 }] }
];

const clon = o => JSON.parse(JSON.stringify(o));
function curvas(m) {
  const pts = f => Array.from({ length: 11 }, (_, i) => { const P = m.P0 * i / 5; return { x: f(P), y: P }; });
  return { demanda: pts(P => m.a + m.D * m.Q0 - m.b * P), oferta: pts(P => m.c + m.S * m.Q0 + m.d * P) };
}
function macroCon(mercados, antes, poblacion, pibInicial, pibRealAnterior) {
  const filas = mercados.map((m, i) => ({ id: m.id, precio: m.precio, cantidad: m.cantidad,
    precioAnterior: antes[i].precio, cantidadAnterior: antes[i].cantidad,
    porcentajeExportaciones: m.exp ?? .15, porcentajeImportaciones: m.imp ?? .15, golpesActivos: m.golpes ?? [] }));
  if (puente.calcularMacro) {
    const r = puente.calcularMacro(filas, { poblacion, pibInicial, pibRealAnterior });
    const g = r.composicionGasto, pct = x => r.pibNominal ? x / r.pibNominal * 100 : 0;
    return { pibNominal: r.pibNominal, pibReal: r.pibReal, crecimiento: r.crecimientoReal, inflacion: r.inflacion,
      pibPorPersona: r.pibPorPersona, exportaciones: r.exportaciones, importaciones: r.importaciones,
      composicion: { consumo: pct(g.consumo), inversion: pct(g.inversion), gasto: pct(g.gastoPublico), comercio: pct(g.comercioNeto) } };
  }
  const nom = filas.reduce((s, m) => s + m.precio * m.cantidad, 0);
  const real = filas.reduce((s, m) => s + m.precioAnterior * m.cantidad, 0);
  const infl = filas.reduce((s, m) => s + (m.precioAnterior * m.cantidadAnterior / pibInicial) * (m.precio / m.precioAnterior - 1), 0);
  const exp = filas.reduce((s, m) => s + m.precio * m.cantidad * m.porcentajeExportaciones, 0);
  const imp = filas.reduce((s, m) => s + m.precio * m.cantidad * m.porcentajeImportaciones, 0);
  const cre = pibRealAnterior ? real / pibRealAnterior - 1 : 0, inv = pibInicial * .2 * (1 + 2 * cre), gas = pibInicial * .18;
  return { pibNominal: nom, pibReal: real, crecimiento: cre, inflacion: infl, pibPorPersona: nom / poblacion,
    exportaciones: exp, importaciones: imp,
    composicion: { consumo: (nom - inv - gas - (exp - imp)) / nom * 100, inversion: inv / nom * 100, gasto: gas / nom * 100, comercio: (exp - imp) / nom * 100 } };
}

function trabajoDe(T) {
  const { A, B, w } = T, Ld = A * w ** -.5, Ls = B * w ** .3, des = Math.max(Ls - Ld, .02 * Ls), pts = f => Array.from({ length: 11 }, (_, i) => { const x = .5 + i * .1; return { x: f(x), y: x }; });
  return { ...T, ocupados: Ls - des, fuerzaLaboral: Ls, desocupados: des, desempleo: des / Ls * 100, curvas: { demanda: pts(x => A * x ** -.5), oferta: pts(x => B * x ** .3) },
    grupos: { menores: 22, inactivos: 78 - Ls, ocupados: Ls - des, desocupados: des } };
}
function crearEstadoMock(pobM, perfil, n) {
  const [ing, part, desemp] = PERFILES[perfil], PIB = pobM * 1e6 * ing, act = MK.slice(0, n), tot = act.reduce((s, k) => s + k[2], 0);
  const mercados = act.map(([id, nombre, w, sd, so, P0, imp = 15]) => { const peso = w / tot, Q0 = peso * PIB / P0, b = -sd * Q0 / P0, d = so * Q0 / P0;
    const m = { id, nombre, peso, P0, Q0, a: Q0 + b * P0, b, c: Q0 - d * P0, d, D: 0, S: 0, precio: P0, cantidad: Q0, imp: imp / 100, exp: .15, golpes: [] }; m.curvas = curvas(m); return m; });
  const B = .78 * part, trabajo = trabajoDe({ A: B * (1 - desemp / 100), B, w: 1, A0: B * (1 - desemp / 100) });
  const macro = macroCon(mercados, mercados, pobM * 1e6, PIB, PIB);
  macro.pibRealEncadenado = macro.pibNominal;
  return { pais: { nombre: 'MiniPaís', poblacion: pobM * 1e6, perfil }, mercados, trabajo, macro, historia: [PIB] };
}
function aplicarEventoMock(estado, ev) {
  const e = clon(estado), antes = clon(estado), neto = [];
  e.mercados.forEach(m => { m.D = 0; m.S = 0; m.golpes = []; });
  ev.efectos.forEach(g => e.mercados.filter(m => g.mercado === 'todos' || m.id === g.mercado).forEach(m => {
    const v = Number(g.valor) / 100; if (!Number.isFinite(v)) return;          // un golpe sin valor se ignora
    m.golpes.push({ tipo: g.tipo, valor: Number(g.valor) });                   // macro.js los usa para el comercio
    if (g.tipo === 'demanda' || g.tipo === 'exportaciones') m.D += v; if (g.tipo === 'importaciones') m.D -= v * .5;
    if (g.tipo === 'oferta') m.S += v; if (g.tipo === 'impuesto') m.S -= v * m.d * m.P0 / m.Q0; }));
  const resolver = () => { e.mercados.forEach(m => { m.precio = (m.a - m.c + (m.D - m.S) * m.Q0) / (m.b + m.d); m.cantidad = Math.max(0, m.c + m.S * m.Q0 + m.d * m.precio); m.curvas = curvas(m); }); };
  const crec = () => e.mercados.reduce((s, m) => s + antes.mercados.find(x => x.id === m.id).precio * m.cantidad, 0) / antes.macro.pibNominal - 1;
  resolver(); const rondas = [];
  for (let r = 1; r <= 2; r++) { const x = .3 * .55 * crec() * .5 ** (r - 1), inten = {};
    e.mercados.forEach(m => { if (!ev.efectos.some(g => g.mercado === m.id)) { m.D += x; inten[m.id] = Math.abs(x) * 100; } }); resolver(); rondas.push({ n: r, intensidad: inten }); }
  const g = crec();
  e.trabajo = trabajoDe({ ...e.trabajo, ...(() => { const A = antes.trabajo.A * (1 + .7 * g), B = antes.trabajo.B, ws = x => (x.A / x.B) ** 1.25; return { A, w: 1 + .3 * (ws({ A, B }) - ws({ A: antes.trabajo.A0, B })) }; })() });
  e.macro = macroCon(e.mercados, antes.mercados, e.pais.poblacion, antes.macro.pibNominal, antes.macro.pibNominal);
  e.macro.pibRealEncadenado = (antes.macro.pibRealEncadenado ?? antes.macro.pibNominal) * (1 + e.macro.crecimiento);
  e.historia = [...e.historia, e.macro.pibNominal];
  return { evento: ev, antes, despues: e, rondas, frases: [] };
}
// Se toma de los motores reales lo que exista; lo que falte sigue viniendo de los datos de prueba.
const puente = await conectar();
// Aunque el motor no esté completo, los mercados salen de datos/mercados.json si existe.
if (puente.mercados?.length) { MK.length = 0; MK.push(...puente.mercados.map(x => [x.id, x.nombre, x.peso, x.sd, x.so, x.P0 || 10, x.imp ?? 15])); }
const completo = !!(puente.aplicarEvento && puente.nuevo);
if (puente.aplicarEvento && !puente.nuevo)
  console.warn('MiniPaís · el motor real trae aplicarEvento pero no una función que cree el estado inicial (nuevo / crearEstado / estadoInicial). Mezclarlo con el estado de prueba da NaN, así que por ahora se usa el motor de prueba completo.');
const motor = {
  aplicarEvento: completo ? puente.aplicarEvento : aplicarEventoMock,
  nuevo: completo ? puente.nuevo : crearEstadoMock,
  eventos: puente.eventos?.length ? puente.eventos : EVENTOS,
  real: completo
};
// Red de seguridad: si el estado del motor real no trae lo que la pantalla necesita, se avisa
// en la consola y se sigue con los datos de prueba, en vez de dejar la pantalla en blanco.
function revisa(e) {
  const falla = [];
  if (!Array.isArray(e?.mercados) || !e.mercados.length) falla.push('mercados');
  else if (!e.mercados[0].curvas?.demanda) falla.push('mercados[].curvas.demanda');
  if (!e?.trabajo?.curvas?.demanda) falla.push('trabajo.curvas');
  if (typeof e?.macro?.pibNominal !== 'number') falla.push('macro.pibNominal');
  return falla;
}
function estadoSeguro(...args) {
  const e = motor.nuevo(...args, puente.mercados), falla = revisa(e);
  if (!falla.length) return e;
  console.error('MiniPaís · el motor real no devolvió:', falla.join(', '), '→ se usan los datos de prueba. Revisa el formato de la sección 5 del manual.');
  motor.aplicarEvento = aplicarEventoMock; motor.nuevo = crearEstadoMock; motor.eventos = EVENTOS; motor.real = false;
  return crearEstadoMock(...args);
}

function aPrueba(motivo) {
  console.error('MiniPaís ·', motivo, '→ se sigue con el motor de prueba. Revisa el formato de la sección 5 del manual.');
  motor.real = false; motor.aplicarEvento = aplicarEventoMock; motor.nuevo = crearEstadoMock;
}
// Igual que el estado inicial, el informe de cada evento se revisa antes de dibujarlo.
function aplicarSeguro(e, ev) {
  if (motor.real) {
    try {
      const inf = motor.aplicarEvento(e, ev);
      const falla = [...revisa(inf?.antes), ...revisa(inf?.despues)];
      if (!falla.length) { inf.rondas = Array.isArray(inf.rondas) ? inf.rondas : []; return inf; }
      aPrueba('aplicarEvento devolvió un informe sin ' + falla.join(', '));
    } catch (err) { aPrueba('aplicarEvento lanzó un error: ' + err.message); }
    reiniciar();
  }
  return aplicarEventoMock(estado, ev);
}

// Si el motor real no trae comparación propia, se arma aquí con paises.json.
// Comparación con países reales: se lee datos/paises.json tal como lo deja actualizar_datos.js.
const indicePaises = prepara(puente.paisesCrudo);
if (puente.paisesCrudo && !indicePaises) console.warn('MiniPaís · paises.json se cargó pero no se pudo leer ningún indicador. Se esperaba paises[].indicadores[clave].observaciones.');
function conComparacion(e) {
  if (!e?.macro || !e?.trabajo) return e;
  if (indicePaises) { try { e.comparacion = comparaTodo(e, indicePaises); return e; }
    catch (err) { console.warn('MiniPaís · no se pudo comparar:', err.message); } }
  if (!e.comparacion) e.comparacion = {};
  return e;
}

// ---------- PANTALLA ----------
let estado, selId, previo, ocupado = false, ultimo = [], guiado = false, sig = null, iaOk = false, ident;
let noticia = null, informe = null, historial = [];          // el último evento, para no perder el «antes» al cambiar de mercado

const fl = x => x >= 0 ? '▲' : '▼', coma = x => x.toFixed(1).replace('.', ',');
function vista(v) { document.body.classList.remove('vista-micro', 'vista-macro'); document.body.classList.add('vista-' + v); document.querySelectorAll('.pestanas button').forEach(x => x.classList.toggle('act', x.dataset.v === v)); }
const fich = (t, c) => `<span class="chip ${c}">${t}</span>`;
const marcarSel = id => document.querySelectorAll('.mchip').forEach(el => el.classList.toggle('sel', el.dataset.id === id));
const chipsMercados = e => $('#mercados').innerHTML = [...e.mercados, { id: TRABAJO, nombre: 'Mercado laboral' }]
  .map(x => `<button class="mchip ${x.id === selId ? 'sel' : ''}" data-id="${x.id}">${EMOJI[x.id] || ''} ${x.nombre}<b></b></button>`).join('');
function deltaChip(id, pct) { const b = document.querySelector(`.mchip[data-id="${id}"] b`); if (b) { b.className = pct >= 0 ? 'sube' : 'baja'; b.textContent = `${fl(pct)} ${coma(Math.abs(pct))} %`; } }
function calcShift(g) {
  const v = g.valor, s = v > 0 ? '+' : '', t = g.tipo;
  if (t === 'demanda') return { curva: 'demanda', dir: Math.sign(v), txt: `Demanda ${s}${v} %` };
  if (t === 'exportaciones') return { curva: 'demanda', dir: Math.sign(v), txt: `Exportaciones ${s}${v} %` };
  if (t === 'importaciones') return { curva: 'demanda', dir: -Math.sign(v), txt: `Importaciones ${s}${v} pts` };
  if (t === 'oferta') return { curva: 'oferta', dir: Math.sign(v), txt: `Oferta ${s}${v} %` };
  return { curva: 'oferta', dir: -Math.sign(v), txt: `Impuesto ${s}${v} %` };
}
const TRABAJO = '__trabajo';
const EMOJI = { [TRABAJO]: '👷', alimentos: '🍞', energia: '⚡', vivienda: '🏠', ropa: '👕', tecnologia: '💻', salud: '🏥', auto: '🚗', turismo: '🏖️' };
// Telón oscuro con el sector: marca el corte entre un mercado y otro.
async function telon(m) {
  const f = $('#flash'); f.querySelector('.emo').textContent = EMOJI[m.id] || '📈'; f.querySelector('.nom').textContent = m.nombre;
  f.classList.remove('sale'); f.hidden = false; await esperar(650);
  f.classList.add('sale'); await esperar(300); f.hidden = true;
}
// ¿Esta curva cambió de sitio? Se compara la cantidad a un mismo precio.
function enPrecio(pts, P) {
  for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i];
    if ((P >= p.y && P <= q.y) || (P <= p.y && P >= q.y)) return p.x + (q.x - p.x) * ((P - p.y) / ((q.y - p.y) || 1)); }
  const p = pts[0], q = pts[pts.length - 1];
  return p.x + (q.x - p.x) * ((P - p.y) / ((q.y - p.y) || 1));
}
const movio = (antes, ahora, P) => Math.abs(enPrecio(ahora, P) - enPrecio(antes, P)) > Math.abs(enPrecio(antes, P)) * 1e-4;
const golpeadoPor = id => informe?.evento.efectos.find(g => g.mercado === id || g.mercado === 'todos');

// Muestra un mercado en tres tiempos: se ve el «antes», las curvas se trasladan solas dejando su
// rastro punteado, y al final quedan los dos puntos de equilibrio. Vale igual para el mercado
// golpeado y para los que solo recibieron la ola, así el evento se puede repasar mercado por mercado.
let seq = 0, monoOn = false;
async function verMercado(id, { animar = false, pausa = 1250 } = {}) {
  const mio = ++seq;
  if (animar) monoOn = false;
  const esTrabajo = id === TRABAJO;
  const m = esTrabajo ? { id: TRABAJO, nombre: 'Mercado laboral' } : (estado.mercados.find(x => x.id === id) || estado.mercados[0]);
  selId = m.id; marcarSel(m.id);
  $('#chips').innerHTML = '';
  const tm = esTrabajo ? null : tipoDe(m.id);
  $('#t-mercado').innerHTML = `${m.nombre} ${globito(esTrabajo ? 'trabajo' : 'sensibilidad')}`
    + (tm ? ` <button class="tipo-m ${tm.tipo}" type="button" title="Ver las características de este mercado">${tm.tipo === 'monopolio' ? '🏛️' : '🏪'} ${nombreTipo(tm.tipo)}</button>` : '');
  const bt = $('#t-mercado .tipo-m'); if (bt) bt.onclick = () => abrirTipo(m);
  if (m.id === 'energia' && !esTrabajo) {
    const bm = document.createElement('button'); bm.type = 'button'; bm.className = 'mono-btn' + (monoOn ? ' on' : '');
    bm.textContent = monoOn ? '↩ Volver al evento' : '📈 Ver monopolio sin restricciones';
    bm.onclick = () => { if (ocupado) return; monoOn = !monoOn; verMercado(m.id, { animar: false }); };
    $('#t-mercado').appendChild(bm);
  }
  setMonopolio(monoOn && m.id === 'energia' && !esTrabajo);
  const pinta = esTrabajo
    ? (a, t, o) => graficoTrabajo($('#c-mercado'), a, t, o)
    : (a, t, o) => graficoMercado($('#c-mercado'), a, t, { ...o, evento: !!informe });

  const a = esTrabajo ? (informe?.antes.trabajo || estado.trabajo) : (informe?.antes.mercados.find(x => x.id === m.id) || m);
  const t = esTrabajo ? estado.trabajo : m;
  const dQ = esTrabajo ? t.ocupados / a.ocupados * 100 - 100 : (t.cantidad / a.cantidad - 1) * 100;
  const dP = esTrabajo ? t.desempleo - a.desempleo : (t.precio / a.precio - 1) * 100;
  const hayCambio = Math.abs(dQ) > .01 || Math.abs(dP) > .01;
  const g = esTrabajo ? null : golpeadoPor(m.id);
  const shift = !hayCambio ? null : esTrabajo
    ? (dQ >= 0 ? 'Las empresas contratan más gente' : 'Las empresas contratan menos gente')
    : (g ? calcShift(g) : { curva: 'demanda', dir: Math.sign(dQ), txt: dQ >= 0 ? 'Más sueldos → más compras aquí' : 'Menos sueldos → menos compras aquí' });

  if (monoOn && m.id === 'energia' && !esTrabajo) {                  // vista de monopolio: sin animación, con explicación en los avisos
    pinta(a, t, { fase: 'antes' });
    const k = monopolioDe(t);
    if (k) $('#chips').innerHTML = fich(`Regulado: ${fPrecio(k.Pe)}`, 'dem') + fich(`Monopolio: ${fPrecio(k.Pm)}  ▲ ${coma((k.Pm / k.Pe - 1) * 100)} %`, 'baja') + fich(`Cantidad  ▼ ${coma((1 - k.Qm / k.Qe) * 100)} %`, 'baja');
    return;
  }
  if (!hayCambio) { if (animar) { reiniciaGrafica($('#c-mercado')); await telon(m); if (mio !== seq) return; }
    pinta(a, t, { fase: 'fin', rastro: false }); return; }
  // La gráfica ya queda lista en el «antes» detrás del telón; al levantarse, se ve el traslado.
  if (animar) reiniciaGrafica($('#c-mercado'));
  pinta(a, t, { fase: 'antes', shift });
  if (animar) { await telon(m); if (mio !== seq) return; }
  await esperar(pausa); if (mio !== seq) return;
  // Si el evento mueve las dos curvas, primero viaja la demanda y después la oferta.
  if (!esTrabajo && movio(a.curvas.demanda, t.curvas.demanda, a.precio) && movio(a.curvas.oferta, t.curvas.oferta, a.precio)) {
    pinta(a, t, { fase: 'mueve', shift, solo: 'demanda' }); await esperar(1700); if (mio !== seq) return;
  }
  pinta(a, t, { fase: 'mueve', shift });                               // la curva se traslada
  await esperar(2000); if (mio !== seq) return;
  pinta(a, t, { fase: 'fin', shift });                                 // quedan el rastro y los dos puntos
  $('#chips').innerHTML = esTrabajo
    ? fich(shift, 'dem') + fich(`Sin empleo ${coma(a.desempleo)} % → ${coma(t.desempleo)} %  ${fl(dP)} ${coma(Math.abs(dP))} puntos`, dP <= 0 ? 'sube' : 'baja')
      + fich(`Con empleo ${fl(dQ)} ${coma(Math.abs(dQ))} %`, dQ >= 0 ? 'sube' : 'baja')
    : (g ? fich(shift.txt, 'dem') : fich('Efecto indirecto: nadie golpeó este mercado', 'dem'))
      + fich(`Precio ${a.precio.toFixed(2)} → ${t.precio.toFixed(2)}  ${fl(dP)} ${coma(Math.abs(dP))} %`, dP >= 0 ? 'sube' : 'baja')
      + fich(`Cantidad ${fl(dQ)} ${coma(Math.abs(dQ))} %`, dQ >= 0 ? 'sube' : 'baja');
}

const fPrecio = v => '$ ' + v.toLocaleString('es', { maximumFractionDigits: v < 100 ? 1 : 0 });

// ----- el periódico: pop-up y después una línea en la barra -----
function abrirNoticia(ev, alCerrar) {
  noticia = ev; $('#m-diario').textContent = ident.periodico; $('#m-etq').textContent = etiquetaNivel(ev);
  $('#m-tit').textContent = ev.titular; $('#m-exp').textContent = ev.explicacion;
  $('#modal').hidden = false; $('#btn-ver').textContent = alCerrar ? 'Ver qué pasa ▶' : 'Cerrar'; $('#btn-ver').focus();
  const cerrar = () => { $('#modal').hidden = true; $('#chip-noticia').hidden = false; $('#chip-txt').textContent = ev.titular; $('#chip-noticia').title = ev.explicacion; alCerrar?.(); };
  $('#btn-ver').onclick = cerrar; $('#m-x').onclick = cerrar;
  $('#modal').onclick = e => { if (e.target.id === 'modal') cerrar(); };
}

// ----- panel lateral de un indicador -----
const rotuloAnio = () => { $('.rotulo').textContent = `Indicadores macroeconómicos · Año ${historial.length - 1}`; };
function abrirTipo(m) {
  $('#cj-tit').textContent = 'Tipo de mercado'; $('#cj-cuerpo').innerHTML = explicaMercado(m.id, m.nombre, m.id === 'energia' ? monopolioDe(estado.mercados.find(x => x.id === 'energia') || m) : null); $('#cajon').hidden = false;
  document.querySelectorAll('.kpi').forEach(k => k.classList.remove('abierto')); $('#cj-x').focus();
}
function abrirCajon(clave) {
  const { titulo, cuerpo } = detalleKpi(clave, estado, previo, historial);
  $('#cj-tit').textContent = titulo; $('#cj-cuerpo').innerHTML = cuerpo; $('#cajon').hidden = false;
  document.querySelectorAll('.kpi').forEach(k => k.classList.toggle('abierto', k.dataset.k === clave));
  $('#cj-x').focus();
}
const cerrarCajon = () => { $('#cajon').hidden = true; document.querySelectorAll('.kpi').forEach(k => k.classList.remove('abierto')); };

// Lo que antes se mostraba en una franja arriba ahora se guarda como una secuencia que se lee en el botón 💬.
let secuencia = [], textoResumen = '';
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
function pintaRes() {
  const pasos = secuencia.map(t => { const i = t.indexOf(':'); return i > 0 && i < 40
    ? `<li><b>${esc(t.slice(0, i))}</b><span>${esc(t.slice(i + 1).trim())}</span></li>` : `<li><span>${esc(t)}</span></li>`; }).join('');
  $('#resumen').innerHTML = !pasos && !textoResumen ? '<p class="vacio">Todavía no ha pasado ningún evento. Cuando simules uno, aquí verás la secuencia paso a paso.</p>' : (pasos ? `<h3>Qué pasó, paso a paso</h3><ol class="secuencia">${pasos}</ol>` : '')
    + (textoResumen ? `<h3>En resumen</h3><p>${esc(textoResumen)}</p>` : '');
}
const narrar = (txt = '') => { if (txt) { secuencia.push(txt); pintaRes(); } };
async function siguiente(ms) { if (guiado) { $('#btn-sig').hidden = false; await new Promise(r => sig = r); $('#btn-sig').hidden = true; } else await esperar(ms); }
const bloquear = on => { $('#btn-sim').disabled = on; $('#btn-reset').disabled = on; $('#btn-ia').disabled = on; };

function simular(ev) { cerrarMenu(); if (!ocupado) abrirNoticia(ev, () => correr(ev)); }

async function correr(ev) {
  ocupado = true; bloquear(true); cerrarCajon(); $('#btn-sim').textContent = 'Simular siguiente evento';
  ultimo = [...ultimo, ev.id].slice(-3);
  const inf = aplicarSeguro(estado, ev); conComparacion(inf.antes); conComparacion(inf.despues); previo = estado;
  secuencia = []; textoResumen = ''; pintaRes();
  document.querySelectorAll('.mchip b').forEach(b => b.textContent = '');
  const g = ev.efectos[0], id = g.mercado === 'todos' ? inf.despues.mercados[0].id : g.mercado, A = inf.antes, D = inf.despues;
  const m0 = A.mercados.find(m => m.id === id), m1 = D.mercados.find(m => m.id === id);
  const dP = (m1.precio / m0.precio - 1) * 100, dQ = (m1.cantidad / m0.cantidad - 1) * 100, dU = D.trabajo.desempleo - A.trabajo.desempleo;
  const d = { nombre: m0.nombre.toLowerCase(), dP, dQ, dU };

  // El mercado golpeado.
  if (matchMedia('(max-width:860px)').matches) vista('micro');
  informe = inf; estado = D;
  narrar(textoPaso(1, ev, d)); narrar(textoPaso(2, ev, d)); narrar(textoPaso(3, ev, d));
  // Los porcentajes de cada mercado aparecen en sus botones; no hay parpadeos ni esperas extra.
  D.mercados.forEach((m, i) => deltaChip(m.id, (m.precio / A.mercados[i].precio - 1) * 100));
  deltaChip(TRABAJO, A.trabajo.desempleo - D.trabajo.desempleo);
  await verMercado(id, { animar: true });

  // Cuando termina el cambio en el mercado, los indicadores se actualizan al instante.
  narrar(textoPaso(4, ev, d)); historial.push(estado); renderKpis($('#kpis'), estado, previo, abrirCajon, historial); rotuloAnio();
  textoResumen = resumen(inf); pintaRes();
  ocupado = false; bloquear(false);
}

function reiniciar() {
  $('#btn-sim').textContent = 'Simular evento';
  ident = identidad(); $('#nombre').textContent = ident.nombre; $('#bandera').innerHTML = ident.bandera;
  estado = conComparacion(estadoSeguro(+$('#sel-pob').value, $('#sel-perfil').value, +$('#sel-n').value));
  estado.pais.nombre = ident.nombre; previo = null; informe = null; noticia = null; ultimo = []; selId = estado.mercados[0].id;
  $('#chip-noticia').hidden = true; secuencia = []; textoResumen = ''; pintaRes(); cerrarCajon();
  chipsMercados(estado); reiniciaGrafica($('#c-mercado')); verMercado(selId);
  historial = [estado]; renderKpis($('#kpis'), estado, null, abrirCajon, historial); rotuloAnio();
  document.querySelectorAll('[data-g]').forEach(s => s.innerHTML = globito(s.dataset.g));
}
const sirve = ev => Array.isArray(ev?.efectos) && ev.efectos.length
  && ev.efectos.every(g => (Number.isFinite(g.valor) || Array.isArray(g.rango)) && (g.mercado === 'todos' || estado.mercados.some(m => m.id === g.mercado)));
// El catálogo guarda un rango de tamaño; cada simulación sortea dentro de él y el signo no cambia.
const sortea = ev => ({ ...ev, efectos: ev.efectos.map(g => {
  if (Number.isFinite(g.valor)) return g;
  const [a, b] = g.rango; return { ...g, valor: Math.round((a + Math.random() * (b - a)) * 10) / 10 };
}) });
function azar() {
  let ok = motor.eventos.filter(ev => sirve(ev) && !ultimo.includes(ev.id));
  if (!ok.length) ok = motor.eventos.filter(sirve);
  if (!ok.length) { console.warn('MiniPaís · ningún evento del catálogo encaja con estos mercados; se usan los de prueba.'); ok = EVENTOS.filter(sirve); }
  return sortea(ok[Math.floor(Math.random() * ok.length)]);
}

// ----- menús desplegables (opciones y resumen) -----
const abrirMenu = () => { $('#menu-lat').hidden = false; $('#menu-x').focus(); };
const cerrarMenu = () => { $('#menu-lat').hidden = true; };
$('#btn-menu').onclick = abrirMenu; $('#menu-x').onclick = cerrarMenu; $('#menu-velo').onclick = cerrarMenu;
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return;
  if (!$('#modal').hidden) $('#btn-ver').click(); else if (!$('#menu-lat').hidden) cerrarMenu(); else if (!$('#cajon').hidden) cerrarCajon(); });

$('#btn-sim').onclick = () => { cerrarMenu(); simular(azar()); };
// Modo presentación: pantalla completa y letra más grande para proyectar el tablero en una sola diapositiva.
function presentar(on = !document.documentElement.classList.contains('presentar')) {
  document.documentElement.classList.toggle('presentar', on);
  $('#btn-pres').textContent = on ? '🖥 Salir del modo presentación' : '🖥 Modo presentación';
  if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
}
$('#btn-pres').onclick = () => { cerrarMenu(); presentar(); };
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.documentElement.classList.contains('presentar')) presentar(false); });
document.addEventListener('keydown', e => {
  if (e.target.closest?.('input,select,textarea')) return;
  if (e.key === 'p' || e.key === 'P') presentar();
  else if ((e.key === ' ' || e.key === 'ArrowRight') && document.documentElement.classList.contains('presentar') && !ocupado && $('#modal').hidden) { e.preventDefault(); simular(azar()); }
});
$('#btn-reset').onclick = () => {
  if (ocupado) return;
  if (historial.length > 1 && !confirm('Si reinicias, se borrarán todos los eventos anteriores y el país volverá a empezar. ¿Quieres continuar?')) return;
  cerrarMenu(); reiniciar();
};
$('#btn-sig').onclick = () => sig?.();
$('#chip-noticia').onclick = () => { if (noticia) abrirNoticia(noticia, null); };
$('#chk-guiado').onchange = e => guiado = e.target.checked;
$('#cj-x').onclick = cerrarCajon; $('#velo').onclick = cerrarCajon;
['#sel-pob', '#sel-perfil', '#sel-n'].forEach(s => $(s).onchange = () => { if (!ocupado) reiniciar(); });
// Cambiar de mercado: la gráfica se rehace y entra desde un lado, para que se note que es otro mercado.
$('#mercados').onclick = e => { const b = e.target.closest('.mchip'); if (b && !ocupado) verMercado(b.dataset.id, { animar: true }); };
document.querySelectorAll('.pestanas button').forEach(b => b.onclick = () => vista(b.dataset.v));
// Opción B: el botón de IA solo aparece si el servidor avisa que hay clave.
fetch('/api/estado').then(r => r.json()).then(j => { iaOk = !!j.ia; $('#btn-ia').hidden = !iaOk; }).catch(() => {});
$('#btn-ia').onclick = async () => {
  if (ocupado) return; bloquear(true);
  try {
    const r = await fetch('/api/evento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mercados: estado.mercados.map(m => m.id), recientes: ultimo }) });
    const j = await r.json();
    if (!r.ok || !Array.isArray(j.efectos) || !j.efectos.length || !j.titular) throw new Error(j.error || 'evento inválido');
    bloquear(false); simular(sortea(j));
  } catch (err) { console.warn('IA no disponible, uso el catálogo:', err.message); bloquear(false); simular(azar()); }
};
reiniciar();
