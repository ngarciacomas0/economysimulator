// MiniPaís · Director de la pantalla. Un solo estado; cada evento se cuenta en cuatro pasos:
// noticia → mercado golpeado → empleo → ola en los demás mercados → indicadores del país.
import { crearEstado, aplicarEvento } from './motor/eventos.js';
import { cargarDatos } from './carga.js';
import { identidad, globito, resumen, etiquetaNivel, textoPaso, tipoDe, nombreTipo, explicaMercado } from './ui/narrativa.js';
import { graficoMercado, graficoTrabajo, reiniciaGrafica, setMonopolio, monopolioDe } from './ui/graficos.js';
import { renderKpis, detalleKpi } from './ui/kpis.js';
import { prepara, comparaTodo } from './ui/comparar.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const sinMov = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esperar = ms => new Promise(r => setTimeout(r, sinMov ? 0 : ms));

// ---------- datos ----------
const datos = await cargarDatos();
const indicePaises = prepara(datos.paises);
if (datos.paises && !indicePaises) console.warn('MiniPaís · paises.json se cargó pero no trae indicadores legibles (paises[].indicadores[clave].observaciones).');
if (!datos.eventos) console.error('MiniPaís · no se pudo leer js/datos/eventos.json: no hay eventos para simular.');

const TRABAJO = '__trabajo';
const EMOJI = { [TRABAJO]: '👷', alimentos: '🍞', energia: '⚡', vivienda: '🏠', ropa: '👕', tecnologia: '💻', salud: '🏥', auto: '🚗', turismo: '🏖️' };

// ---------- formato ----------
const fl = x => x >= 0 ? '▲' : '▼';
const coma = x => x.toFixed(1).replace('.', ',');
const fPrecio = v => '$ ' + v.toLocaleString('es', { maximumFractionDigits: v < 100 ? 1 : 0 });
const fich = (t, c) => `<span class="chip ${c}">${t}</span>`;
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// ---------- estado de la pantalla ----------
let estado, previo = null, informe = null, historial = [];   // informe = último evento aplicado (para el «antes» de cada mercado)
let ident, selId, noticia = null, ultimo = [];               // ultimo = ids de los últimos eventos, para no repetir
let ocupado = false, guiado = false, sig = null, monoOn = false, seq = 0;
let secuencia = [], textoResumen = '';

// Comparación con países reales, pegada al estado para que el panel la encuentre.
function conComparacion(e) {
  if (!e?.macro || !e?.trabajo) return e;
  try { e.comparacion = indicePaises ? comparaTodo(e, indicePaises) : {}; }
  catch (err) { console.warn('MiniPaís · no se pudo comparar:', err.message); e.comparacion = {}; }
  return e;
}

// ---------- vistas y fichas ----------
function vista(v) {
  document.body.classList.remove('vista-micro', 'vista-macro');
  document.body.classList.add('vista-' + v);
  $$('.pestanas button').forEach(b => b.classList.toggle('act', b.dataset.v === v));
}
const marcarSel = id => $$('.mchip').forEach(el => el.classList.toggle('sel', el.dataset.id === id));
function chipsMercados(e) {
  $('#mercados').innerHTML = [...e.mercados, { id: TRABAJO, nombre: 'Mercado laboral' }]
    .map(x => `<button class="mchip ${x.id === selId ? 'sel' : ''}" data-id="${x.id}">${EMOJI[x.id] || ''} ${x.nombre}<b></b></button>`).join('');
}
function deltaChip(id, pct) {
  const b = document.querySelector(`.mchip[data-id="${id}"] b`);
  if (b) { b.className = pct >= 0 ? 'sube' : 'baja'; b.textContent = `${fl(pct)} ${coma(Math.abs(pct))} %`; }
}

// Qué curva mueve un golpe, hacia dónde y con qué rótulo.
function calcShift(g) {
  const v = g.valor, s = v > 0 ? '+' : '';
  switch (g.tipo) {
    case 'demanda': return { curva: 'demanda', dir: Math.sign(v), txt: `Demanda ${s}${v} %` };
    case 'exportaciones': return { curva: 'demanda', dir: Math.sign(v), txt: `Exportaciones ${s}${v} %` };
    case 'importaciones': return { curva: 'demanda', dir: -Math.sign(v), txt: `Importaciones ${s}${v} pts` };
    case 'oferta': return { curva: 'oferta', dir: Math.sign(v), txt: `Oferta ${s}${v} %` };
    default: return { curva: 'oferta', dir: -Math.sign(v), txt: `Impuesto ${s}${v} %` };
  }
}
const golpeadoPor = id => informe?.evento.efectos.find(g => g.mercado === id || g.mercado === 'todos');

// Telón oscuro con el sector: marca el corte entre un mercado y otro.
async function telon(m) {
  const f = $('#flash');
  f.querySelector('.emo').textContent = EMOJI[m.id] || '📈'; f.querySelector('.nom').textContent = m.nombre;
  f.classList.remove('sale'); f.hidden = false; await esperar(650);
  f.classList.add('sale'); await esperar(300); f.hidden = true;
}

// Cantidad de una curva a un precio dado (interpolando); sirve para saber si la curva se movió.
function enPrecio(pts, P) {
  const entre = (p, q) => p.x + (q.x - p.x) * ((P - p.y) / ((q.y - p.y) || 1));
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    if ((P >= p.y && P <= q.y) || (P <= p.y && P >= q.y)) return entre(p, q);
  }
  return entre(pts[0], pts[pts.length - 1]);
}
const movio = (antes, ahora, P) => Math.abs(enPrecio(ahora, P) - enPrecio(antes, P)) > Math.abs(enPrecio(antes, P)) * 1e-4;

// ---------- la gráfica grande ----------
// Muestra un mercado en tres tiempos: el «antes», el traslado de las curvas (con rastro punteado)
// y el final con los dos puntos de equilibrio. Vale para el mercado golpeado, para los que solo
// recibieron la ola y para el mercado laboral.
async function verMercado(id, { animar = false, pausa = 1250 } = {}) {
  const mio = ++seq;                                           // si llega otra llamada, esta se abandona
  if (animar) monoOn = false;
  const esTrabajo = id === TRABAJO;
  const m = esTrabajo ? { id: TRABAJO, nombre: 'Mercado laboral' } : (estado.mercados.find(x => x.id === id) || estado.mercados[0]);
  selId = m.id; marcarSel(m.id);
  $('#chips').innerHTML = '';

  // Título con el globito de ayuda y, si aplica, el tipo de mercado y el botón de monopolio.
  const tm = esTrabajo ? null : tipoDe(m.id);
  $('#t-mercado').innerHTML = `${m.nombre} ${globito(esTrabajo ? 'trabajo' : 'sensibilidad')}`
    + (tm ? ` <button class="tipo-m ${tm.tipo}" type="button" title="Ver las características de este mercado">${tm.tipo === 'monopolio' ? '🏛️' : '🏪'} ${nombreTipo(tm.tipo)}</button>` : '');
  const bt = $('#t-mercado .tipo-m'); if (bt) bt.onclick = () => abrirTipo(m);
  const esMono = m.id === 'energia' && !esTrabajo;
  if (esMono) {
    const bm = document.createElement('button');
    bm.type = 'button'; bm.className = 'mono-btn' + (monoOn ? ' on' : '');
    bm.textContent = monoOn ? '↩ Volver al evento' : '📈 Ver monopolio sin restricciones';
    bm.onclick = () => { if (!ocupado) { monoOn = !monoOn; verMercado(m.id); } };
    $('#t-mercado').appendChild(bm);
  }
  setMonopolio(monoOn && esMono);

  const canvas = $('#c-mercado');
  const pinta = (a, t, o) => esTrabajo ? graficoTrabajo(canvas, a, t, o) : graficoMercado(canvas, a, t, { ...o, evento: !!informe });
  const a = esTrabajo ? (informe?.antes.trabajo || estado.trabajo) : (informe?.antes.mercados.find(x => x.id === m.id) || m);
  const t = esTrabajo ? estado.trabajo : m;
  const dQ = esTrabajo ? t.ocupados / a.ocupados * 100 - 100 : (t.cantidad / a.cantidad - 1) * 100;
  const dP = esTrabajo ? t.desempleo - a.desempleo : (t.precio / a.precio - 1) * 100;
  const hayCambio = Math.abs(dQ) > .01 || Math.abs(dP) > .01;
  const g = esTrabajo ? null : golpeadoPor(m.id);
  const shift = !hayCambio ? null : esTrabajo
    ? (dQ >= 0 ? 'Las empresas contratan más gente' : 'Las empresas contratan menos gente')
    : (g ? calcShift(g) : { curva: 'demanda', dir: Math.sign(dQ), txt: dQ >= 0 ? 'Más sueldos → más compras aquí' : 'Menos sueldos → menos compras aquí' });

  if (monoOn && esMono) {                                      // vista de monopolio: sin animación
    pinta(a, t, { fase: 'antes' });
    const k = monopolioDe(t);
    if (k) $('#chips').innerHTML = fich(`Regulado: ${fPrecio(k.Pe)}`, 'dem')
      + fich(`Monopolio: ${fPrecio(k.Pm)}  ▲ ${coma((k.Pm / k.Pe - 1) * 100)} %`, 'baja')
      + fich(`Cantidad  ▼ ${coma((1 - k.Qm / k.Qe) * 100)} %`, 'baja');
    return;
  }
  if (!hayCambio) {
    if (animar) { reiniciaGrafica(canvas); await telon(m); if (mio !== seq) return; }
    pinta(a, t, { fase: 'fin', rastro: false }); return;
  }
  // La gráfica queda lista en el «antes» detrás del telón; al levantarse, se ve el traslado.
  if (animar) reiniciaGrafica(canvas);
  pinta(a, t, { fase: 'antes', shift });
  if (animar) { await telon(m); if (mio !== seq) return; }
  await esperar(pausa); if (mio !== seq) return;
  // Si el evento mueve las dos curvas, primero viaja la demanda y después la oferta.
  if (!esTrabajo && movio(a.curvas.demanda, t.curvas.demanda, a.precio) && movio(a.curvas.oferta, t.curvas.oferta, a.precio)) {
    pinta(a, t, { fase: 'mueve', shift, solo: 'demanda' }); await esperar(1700); if (mio !== seq) return;
  }
  pinta(a, t, { fase: 'mueve', shift }); await esperar(2000); if (mio !== seq) return;
  pinta(a, t, { fase: 'fin', shift });
  $('#chips').innerHTML = esTrabajo
    ? fich(shift, 'dem')
      + fich(`Sin empleo ${coma(a.desempleo)} % → ${coma(t.desempleo)} %  ${fl(dP)} ${coma(Math.abs(dP))} puntos`, dP <= 0 ? 'sube' : 'baja')
      + fich(`Con empleo ${fl(dQ)} ${coma(Math.abs(dQ))} %`, dQ >= 0 ? 'sube' : 'baja')
    : fich(g ? shift.txt : 'Efecto indirecto: nadie golpeó este mercado', 'dem')
      + fich(`Precio ${a.precio.toFixed(2)} → ${t.precio.toFixed(2)}  ${fl(dP)} ${coma(Math.abs(dP))} %`, dP >= 0 ? 'sube' : 'baja')
      + fich(`Cantidad ${fl(dQ)} ${coma(Math.abs(dQ))} %`, dQ >= 0 ? 'sube' : 'baja');
}

// ---------- la noticia: pop-up y después una línea en la barra ----------
function abrirNoticia(ev, alCerrar) {
  noticia = ev;
  $('#m-diario').textContent = ident.periodico; $('#m-etq').textContent = etiquetaNivel(ev);
  $('#m-tit').textContent = ev.titular; $('#m-exp').textContent = ev.explicacion;
  $('#btn-ver').textContent = alCerrar ? 'Ver qué pasa ▶' : 'Cerrar';
  $('#modal').hidden = false; $('#btn-ver').focus();
  const cerrar = () => {
    $('#modal').hidden = true;
    $('#chip-noticia').hidden = false; $('#chip-txt').textContent = ev.titular; $('#chip-noticia').title = ev.explicacion;
    alCerrar?.();
  };
  $('#btn-ver').onclick = cerrar; $('#m-x').onclick = cerrar;
  $('#modal').onclick = e => { if (e.target.id === 'modal') cerrar(); };
}

// ---------- panel lateral ----------
const rotuloAnio = () => { $('.rotulo').textContent = `Indicadores macroeconómicos · Año ${historial.length - 1}`; };
function abrirPanel(titulo, cuerpo, claveKpi = null) {
  $('#cj-tit').textContent = titulo; $('#cj-cuerpo').innerHTML = cuerpo; $('#cajon').hidden = false;
  $$('.kpi').forEach(k => k.classList.toggle('abierto', k.dataset.k === claveKpi));
  $('#cj-x').focus();
}
function abrirTipo(m) {
  const k = m.id === 'energia' ? monopolioDe(estado.mercados.find(x => x.id === 'energia') || m) : null;
  abrirPanel('Tipo de mercado', explicaMercado(m.id, m.nombre, k));
}
function abrirCajon(clave) {
  const { titulo, cuerpo } = detalleKpi(clave, estado, previo, historial);
  abrirPanel(titulo, cuerpo, clave);
}
const cerrarCajon = () => { $('#cajon').hidden = true; $$('.kpi').forEach(k => k.classList.remove('abierto')); };

// ---------- «Qué pasó»: la secuencia del evento, en el menú ----------
function pintaRes() {
  const pasos = secuencia.map(t => {
    const i = t.indexOf(':');
    return i > 0 && i < 40 ? `<li><b>${esc(t.slice(0, i))}</b><span>${esc(t.slice(i + 1).trim())}</span></li>` : `<li><span>${esc(t)}</span></li>`;
  }).join('');
  $('#resumen').innerHTML = !pasos && !textoResumen
    ? '<p class="vacio">Todavía no ha pasado ningún evento. Cuando simules uno, aquí verás la secuencia paso a paso.</p>'
    : (pasos ? `<h3>Qué pasó, paso a paso</h3><ol class="secuencia">${pasos}</ol>` : '') + (textoResumen ? `<h3>En resumen</h3><p>${esc(textoResumen)}</p>` : '');
}
const narrar = txt => { if (txt) { secuencia.push(txt); pintaRes(); } };
// Modo guiado: la secuencia se detiene hasta que se pulsa «Siguiente».
async function siguiente() {
  if (!guiado) return;
  $('#btn-sig').hidden = false;
  await new Promise(r => { sig = r; });
  $('#btn-sig').hidden = true; sig = null;
}
const bloquear = on => ['#btn-sim', '#btn-reset', '#btn-ia'].forEach(s => $(s).disabled = on);

// ---------- simular un evento ----------
function simular(ev) { cerrarMenu(); if (ev && !ocupado) abrirNoticia(ev, () => correr(ev)); }

async function correr(ev) {
  ocupado = true; bloquear(true); cerrarCajon();
  let inf;
  try { inf = aplicarEvento(estado, ev); }
  catch (err) { console.error('MiniPaís · el evento no se pudo aplicar:', err); ocupado = false; bloquear(false); return; }
  conComparacion(inf.antes); conComparacion(inf.despues);
  $('#btn-sim').textContent = 'Simular siguiente evento';
  ultimo = [...ultimo, ev.id].slice(-3);
  previo = estado; informe = inf; estado = inf.despues;
  secuencia = []; textoResumen = ''; pintaRes();
  $$('.mchip b').forEach(b => b.textContent = '');

  const A = inf.antes, D = inf.despues, g = inf.evento.efectos[0];
  const id = g.mercado === 'todos' ? D.mercados[0].id : g.mercado;
  const m0 = A.mercados.find(m => m.id === id), m1 = D.mercados.find(m => m.id === id);
  const d = { nombre: m0.nombre.toLowerCase(), dP: (m1.precio / m0.precio - 1) * 100, dQ: (m1.cantidad / m0.cantidad - 1) * 100, dU: D.trabajo.desempleo - A.trabajo.desempleo };

  // El mercado golpeado; en cada ficha, cuánto cambió el precio de los demás.
  if (matchMedia('(max-width:860px)').matches) vista('micro');
  [1, 2, 3].forEach(n => narrar(textoPaso(n, inf.evento, d)));
  D.mercados.forEach((m, i) => deltaChip(m.id, (m.precio / A.mercados[i].precio - 1) * 100));
  deltaChip(TRABAJO, A.trabajo.desempleo - D.trabajo.desempleo);
  await verMercado(id, { animar: true });
  await siguiente();

  // Al terminar el mercado, los indicadores se actualizan.
  narrar(textoPaso(4, inf.evento, d));
  historial.push(estado); renderKpis($('#kpis'), estado, previo, abrirCajon, historial); rotuloAnio();
  textoResumen = resumen(inf); pintaRes();
  ocupado = false; bloquear(false);
}

function reiniciar() {
  ident = identidad(); $('#nombre').textContent = ident.nombre; $('#bandera').innerHTML = ident.bandera;
  estado = conComparacion(crearEstado(+$('#sel-pob').value, $('#sel-perfil').value, +$('#sel-n').value, datos.mercados));
  estado.pais.nombre = ident.nombre;
  previo = null; informe = null; noticia = null; ultimo = []; historial = [estado]; selId = estado.mercados[0].id;
  secuencia = []; textoResumen = ''; pintaRes(); cerrarCajon();
  $('#btn-sim').textContent = 'Simular evento'; $('#chip-noticia').hidden = true;
  chipsMercados(estado); reiniciaGrafica($('#c-mercado')); verMercado(selId);
  renderKpis($('#kpis'), estado, null, abrirCajon, historial); rotuloAnio();
}

// Un evento sirve si todos sus golpes apuntan a mercados que existen en este país.
const sirve = ev => Array.isArray(ev?.efectos) && ev.efectos.length > 0
  && ev.efectos.every(g => (Number.isFinite(g.valor) || Array.isArray(g.rango)) && (g.mercado === 'todos' || estado.mercados.some(m => m.id === g.mercado)));
function azar() {
  const todos = (datos.eventos || []).filter(sirve);
  if (!todos.length) { console.error('MiniPaís · ningún evento del catálogo encaja con estos mercados.'); return null; }
  const frescos = todos.filter(ev => !ultimo.includes(ev.id));
  const lista = frescos.length ? frescos : todos;
  return lista[Math.floor(Math.random() * lista.length)];
}

// ---------- menú lateral y teclado ----------
const abrirMenu = () => { $('#menu-lat').hidden = false; $('#menu-x').focus(); };
const cerrarMenu = () => { $('#menu-lat').hidden = true; };
$('#btn-menu').onclick = abrirMenu; $('#menu-x').onclick = cerrarMenu; $('#menu-velo').onclick = cerrarMenu;

// Modo presentación: pantalla completa y letra más grande para proyectar.
const enPresentacion = () => document.documentElement.classList.contains('presentar');
function presentar(on = !enPresentacion()) {
  document.documentElement.classList.toggle('presentar', on);
  $('#btn-pres').textContent = on ? '🖥 Salir del modo presentación' : '🖥 Modo presentación';
  if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && enPresentacion()) presentar(false); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!$('#modal').hidden) $('#btn-ver').click(); else if (!$('#menu-lat').hidden) cerrarMenu(); else if (!$('#cajon').hidden) cerrarCajon();
    return;
  }
  if (e.target.closest?.('input,select,textarea')) return;
  if (e.key === 'p' || e.key === 'P') presentar();
  else if ((e.key === ' ' || e.key === 'ArrowRight') && enPresentacion() && !ocupado && $('#modal').hidden) { e.preventDefault(); simular(azar()); }
});

// ---------- botones ----------
$('#btn-sim').onclick = () => simular(azar());
$('#btn-pres').onclick = () => { cerrarMenu(); presentar(); };
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
$('#mercados').onclick = e => { const b = e.target.closest('.mchip'); if (b && !ocupado) verMercado(b.dataset.id, { animar: true }); };
$$('.pestanas button').forEach(b => b.onclick = () => vista(b.dataset.v));

// Evento con IA: el botón solo aparece si el servidor avisa que hay clave. Si la IA falla, se usa el catálogo.
fetch('/api/estado').then(r => r.json()).then(j => { $('#btn-ia').hidden = !j.ia; }).catch(() => {});
$('#btn-ia').onclick = async () => {
  if (ocupado) return;
  bloquear(true);
  try {
    const r = await fetch('/api/evento', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mercados: estado.mercados.map(m => m.id), recientes: ultimo }) });
    const j = await r.json();
    const ev = j.evento ?? j;                                  // el servidor responde { evento, aviso }
    if (!r.ok || !ev?.titular || !sirve(ev)) throw new Error(j.error || 'evento inválido');
    if (j.aviso) console.info('MiniPaís ·', j.aviso.texto);
    bloquear(false); simular(ev);
  } catch (err) {
    console.warn('MiniPaís · IA no disponible, se usa el catálogo:', err.message);
    bloquear(false); simular(azar());
  }
};

reiniciar();
