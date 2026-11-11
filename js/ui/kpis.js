// Agente 7 · Indicadores del país: tarjetas compactas y panel lateral con el detalle.
import { GLOSARIO } from './narrativa.js';
const sinMov = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coma = (v, n = 1) => Number.isFinite(v) ? v.toLocaleString('es', { minimumFractionDigits: n, maximumFractionDigits: n }) : '—';
const dinero = { corto: v => { const a = Math.abs(v); return 'US$ ' + (a >= 1e12 ? coma(v / 1e12, 3) + ' B' : a >= 1e9 ? coma(v / 1e9, 1) + ' mil M' : coma(v / 1e6, 1) + ' M'); },
                 fino: v => { const a = Math.abs(v); return 'US$ ' + (a >= 1e12 ? coma(v / 1e12, 3) + ' B' : a >= 1e9 ? coma(v / 1e9, 2) + ' mil M' : coma(v / 1e6, 2) + ' M'); },
                 exacto: v => 'US$ ' + (Number.isFinite(v) ? Math.round(v).toLocaleString('es') : '—') };
const pc = { corto: v => coma(v, 2) + ' %', exacto: v => coma(v, 2) + ' %' };
const per = { corto: v => dinero.exacto(v), exacto: dinero.exacto };
const idx = { corto: v => coma(v, 2), exacto: v => coma(v, 2) };
const gente = { corto: v => coma(v / 1e6, 2) + ' M', exacto: v => (Number.isFinite(v) ? Math.round(v).toLocaleString('es') : '—') + ' personas' };
const ind1 = { corto: v => coma(v, 1), exacto: v => coma(v, 2) + ' de 100' };
const pob = e => e.pais.poblacion, pea = e => e.trabajo.fuerzaLaboral / 100 * pob(e), empleados = e => e.trabajo.ocupados / 100 * pob(e);
const real = e => e.macro.pibRealEncadenado ?? e.macro.pibReal ?? e.macro.pibNominal;
const deflactorDe = e => (e.macro.pibReal ? e.macro.pibNominal / e.macro.pibReal * 100 : 100);

// [clave, título, valor, formato, ¿subir es bueno?, modo del cambio, de dónde sale, relato, línea extra, sub-bloques, clave de comparación, comparaciones extra]
export const DEF = [
  ['pib', 'PIB', real, dinero, true, 'rel',
    'La producción de ahora valorada con los precios de antes, encadenada evento tras evento.',
    'El PIB es todo lo que el país produce y vende. Se mira de dos maneras. El nominal usa los precios de hoy, así que sube tanto si se produce más como si todo se encarece. El real repite la producción nueva con los precios viejos: si sube, es porque de verdad se hicieron más cosas. Por eso el número grande de esta tarjeta es el real, y su cambio es el crecimiento económico.',
    e => dinero.corto(e.macro.pibNominal) + ' nominal · ' + per.corto(real(e) / pob(e)) + ' por persona',
    [['PIB nominal (precios de hoy)', e => e.macro.pibNominal, dinero, true, 'rel', ['pib'],
       ['Todo lo que el país produce, valorado a los precios de hoy. Sube si se produce más, pero también si todo se encarece.',
        'MiniPaís multiplica el precio por la cantidad de cada mercado con los valores de después del evento y suma los resultados.']],
     ['PIB real (precios de antes)', real, dinero, true, 'rel', ['pibreal', 'crecimiento'],
       ['Lo que el país produce, pero valorado con los precios de antes del evento. Solo sube si de verdad se hacen más cosas.',
        'MiniPaís toma las cantidades nuevas de cada mercado y las multiplica por los precios anteriores. Cada evento se encadena sobre el anterior, así el crecimiento económico es el cambio de este número.']],
     ['PIB per cápita', e => real(e) / pob(e), per, true, 'rel', ['pibpersona'],
       ['Lo que le toca producir a cada persona si el PIB se repartiera en partes iguales. Es la forma de comparar países de tamaños distintos.',
        'MiniPaís divide el PIB real entre la población total.']],
     ['Renta por trabajador', e => real(e) / empleados(e), per, true, 'rel', ['rentatrab'],
       ['Lo que produce, en promedio, cada persona que tiene empleo. Mide qué tan productivo es el trabajo del país.',
        'MiniPaís divide el PIB real entre el número de personas empleadas.']]],
    null, []],
  ['desempleo', 'Tasa de desempleo', e => e.trabajo.desempleo, pc, false, 'pp',
    'Personas que buscan trabajo y no lo encuentran, divididas entre todas las que quieren trabajar.',
    'Solo cuenta a quien quiere trabajar. Un estudiante o una persona jubilada no están desempleados: están fuera del mercado laboral. Por eso la tasa puede bajar simplemente porque alguien se cansó de buscar y dejó de contar.',
    e => gente.corto(empleados(e)) + ' empleados de ' + gente.corto(pea(e)) + ' activos',
    [['Tasa de desempleo', e => e.trabajo.desempleo, pc, false, 'pp', ['desempleo'],
       ['Personas activas que buscan trabajo y no lo encuentran, como porcentaje de la población económicamente activa.',
        'MiniPaís divide los desocupados entre la población económicamente activa.']],
     ['Población total', pob, gente, null, 'rel', [],
       ['Todas las personas que viven en el país, de cualquier edad.', 'Se elige en el menú (Opciones → Población).']],
     ['Población económicamente activa', pea, gente, true, 'rel', ['participacion'],
       ['Las personas que pueden y desean trabajar: las que tienen empleo más las que lo buscan.',
        'MiniPaís toma la población en edad de trabajar y le aplica la tasa de participación del perfil del país.']],
     ['Personas empleadas', empleados, gente, true, 'rel', [],
       ['Las personas que efectivamente tienen trabajo.', 'MiniPaís resta los desocupados a la población económicamente activa.']]],
    null],
  ['inflacion', 'Inflación (IPC)', e => e.macro.inflacion * 100, pc, false, 'pp',
    'El promedio de los cambios de precio, dando más peso a los mercados grandes.',
    'El índice de precios al consumidor mide lo que cuesta la canasta que compra la gente. No todo sube igual: si la comida sube mucho y la tecnología baja, la inflación queda en medio, pero pesa más la comida porque ahí se gasta más.',
    null, null, 'inflacion'],
  ['exportaciones', 'Exportaciones', e => e.macro.exportaciones, dinero, true, 'rel',
    'La parte de lo que produce cada mercado que se vende al extranjero.',
    'Es lo que el país le vende al resto del mundo. Cuando suben, entra dinero y las empresas de esos mercados producen más; si un vecino entra en recesión y deja de comprar, caen y el golpe se siente aquí.',
    e => 'el ' + coma(e.macro.pibNominal ? e.macro.exportaciones / e.macro.pibNominal * 100 : 0) + ' % del PIB',
    null, 'exportaciones'],
  ['importaciones', 'Importaciones', e => e.macro.importaciones, dinero, null, 'rel',
    'La parte de la demanda de cada mercado que se cubre con producto extranjero.',
    'Es lo que el país le compra al resto del mundo. Ni buenas ni malas por sí solas: importar máquinas o medicinas puede hacer crecer al país, pero si sustituyen producción nacional, los fabricantes de aquí venden menos.',
    e => 'el ' + coma(e.macro.pibNominal ? e.macro.importaciones / e.macro.pibNominal * 100 : 0) + ' % del PIB',
    null, 'importaciones']
];
const ACC = { pib: ['💵', '#6aa8ff'], pibreal: ['📈', '#5fd486'], pibpersona: ['👤', '#c792ea'], desempleo: ['👷', '#ffa04d'], inflacion: ['🛒', '#ff6b72'],
  deflactor: ['🏷️', '#f4d35e'], exportaciones: ['🚢', '#4dd0c8'], importaciones: ['📦', '#b39ddb'], crecimiento: ['📈', '#5fd486'], rentatrab: ['🛠️', '#f4d35e'], participacion: ['🙋', '#ffa04d'], gente: ['👥', '#ffa04d'] };
const porClave = k => DEF.find(d => d[0] === k);
const cambio = (dif, p, modo) => modo === 'pp'
  ? (dif > 0 ? '+' : '−') + coma(Math.abs(dif), 2) + ' puntos'
  : (dif > 0 ? '+' : '−') + coma(p ? Math.abs(dif / p * 100) : 0, 2) + ' %';

function contar(el, de, a, fmt) {
  if (sinMov) { el.textContent = fmt(a); return; }
  const t0 = performance.now();
  (function paso(t) { const k = Math.min(1, (t - t0) / 900); el.textContent = fmt(de + (a - de) * k); if (k < 1) requestAnimationFrame(paso); })(t0);
}
// Línea de fondo con la historia del indicador, un punto por evento.
function spark(vals, color) {
  const fin = vals.filter(Number.isFinite); if (!fin.length) return '';
  const v = fin.length > 1 ? fin : [fin[0], fin[0]];
  const lo = Math.min(...v), hi = Math.max(...v), span = (hi - lo) || Math.abs(hi) || 1;
  const pts = v.map((x, i) => `${(i / (v.length - 1) * 100).toFixed(2)},${(26 - (x - lo) / span * 20 - 3).toFixed(2)}`).join(' ');
  if (pts.includes('NaN')) return '';
  return `<svg class="spark" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
    <polygon points="0,26 ${pts} 100,26" fill="${color}" opacity=".14"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke" opacity=".75"/></svg>`;
}

export function renderKpis(cont, estado, previo, alAbrir, historial = []) {
  if (!cont.children.length) {
    cont.innerHTML = DEF.map(([k, t]) => `<button class="kpi" id="k-${k}" data-k="${k}" style="--ac:${(ACC[k] || [])[1] || 'var(--linea)'}"><span class="fondo"></span><div class="t"><span class="ic">${(ACC[k] || [''])[0]}</span>${t}</div><div class="n"></div><span class="d"></span><span class="ex"></span></button>`).join('');
    cont.onclick = e => { const k = e.target.closest('.kpi'); if (k) alAbrir?.(k.dataset.k); };
  }
  DEF.forEach(([k, , get, fmt, subeBueno, modo, , , extra]) => {
    const el = cont.querySelector('#k-' + k), v = get(estado), p = previo ? get(previo) : v, dif = v - p;
    const nulo = Math.abs(dif) < 1e-9 * Math.max(1, Math.abs(p));
    contar(el.querySelector('.n'), p, v, fmt.corto);
    el.querySelector('.d').textContent = !previo ? '' : nulo ? 'sin cambio' : (dif > 0 ? '▲ ' : '▼ ') + cambio(dif, p, modo);
    el.classList.toggle('sube', !nulo && subeBueno !== null && (dif > 0) === subeBueno);
    el.classList.toggle('baja', !nulo && subeBueno !== null && (dif > 0) !== subeBueno);
    const color = el.classList.contains('sube') ? 'var(--sube)' : el.classList.contains('baja') ? 'var(--baja)' : 'var(--acento)';
    el.querySelector('.fondo').innerHTML = spark(historial.map(get), color);
    el.querySelector('.ex').textContent = extra ? extra(estado) : '';
  });
}

// ---------- panel lateral ----------
// Un bloque «antes y ahora» con dos barras en la misma escala, ampliada para que el cambio se vea.
function bloqueBarras(titulo, v, p, fmt, modo, subeBueno, hayPrevio, acc) {
  const dif = v - p, nulo = !hayPrevio || Math.abs(dif) < 1e-9 * Math.max(1, Math.abs(p));
  const clase = nulo || subeBueno === null ? '' : (dif > 0) === subeBueno ? 'sube' : 'baja';
  const lo = Math.min(p, v), hi = Math.max(p, v), span = hi - lo;
  const base = span > 0 ? Math.max(0, lo - span * 1.1) : 0, tope = span > 0 ? hi + span * .35 : Math.abs(hi) * 1.15 || 1;
  const an = x => Math.max(2, Math.min(100, (x - base) / (tope - base) * 100));
  const barra = (n, val, cl, tip) => `<div class="fila-b" title="${tip}"><span class="et">${n}</span>
      <div class="pista"><i class="${cl}" style="width:${an(val)}%"></i></div><span class="val">${fmt.corto(val)}</span></div>`;
  return `<div class="bloque ${clase}" style="--ac:${acc ? acc[1] : 'var(--linea)'}">
      <h4 class="tit">${acc ? `<span class="ic">${acc[0]}</span>` : ''}${titulo || 'Antes y ahora'}</h4>
      <div class="cabeza"><div><div class="grande-n">${fmt.corto(v)}</div><div class="exacto">${fmt.exacto(v)}</div></div>
        ${hayPrevio ? `<span class="pill ${clase}">${nulo ? 'sin cambio' : (dif > 0 ? '▲ ' : '▼ ') + cambio(dif, p, modo)}</span>` : ''}</div>
      ${!hayPrevio ? '<p class="nota">Todavía no ha pasado ningún evento: este es el punto de partida.</p>' : `<div class="barras" style="margin-top:12px">
        ${barra('Antes', p, 'b-antes', 'Antes del evento: ' + fmt.exacto(p))}
        <div class="fila-dif ${clase}">${nulo ? 'No cambió con este evento' : `${dif > 0 ? '▲ subió' : '▼ bajó'} ${fmt.exacto(Math.abs(dif))} · ${cambio(dif, p, modo)}`}</div>
        ${barra('Ahora', v, 'b-ahora', 'Después del evento: ' + fmt.exacto(v))}
      </div>`}
    </div>`;
}

// Comparación con un país real de hoy y con un año concreto de la historia.
function bloqueCompara(c, titulo, acc) {
  if (!c || !c.pais) return '';
  const f = c.persona ? dinero.exacto && (v => 'US$ ' + Math.round(v).toLocaleString('es')) : c.tipo === 'indice' ? v => coma(v, 1) : c.tipo === 'dinero' ? dinero.fino : v => coma(v, 2) + ' %';
  const par = (otro, ancla) => {
    const mx = Math.max(Math.abs(c.mio), Math.abs(otro.valor)) * 1.12 || 1, w = x => Math.max(2, Math.abs(x) / mx * 100);
    return `<div class="barras" style="margin-top:8px">
        <div class="fila-b"><span class="et">Tu país</span><div class="pista"><i class="b-ahora" style="width:${w(c.mio)}%"></i></div><span class="val">${f(c.mio)}</span></div>
        <div class="fila-b"><span class="et">${otro.pais}</span><div class="pista"><i class="b-antes" style="width:${w(otro.valor)}%"></i></div><span class="val">${f(otro.valor)}</span></div>
      </div>`;
  };
  const hoy = `<p class="texto"><b>Hoy:</b> tu país se parece a <b>${c.pais}</b> (dato de ${c.anio}).</p>${par({ pais: c.pais, valor: c.valor })}
      <p class="nota">Fuente: ${c.fuente || 'Banco Mundial'}.</p>`;
  const h = c.historico;
  const hist = h ? `<p class="texto" style="margin-top:14px"><b>En la historia:</b> una cifra así la tuvo <b>${h.pais}</b> en <b>${h.anio}</b>.</p>${par(h)}
      <p class="nota">Dato de ${h.anio}. Fuente: ${h.fuente || 'Banco Mundial'}.</p>` : '';
  return `<div class="bloque comp" style="--ac:${acc ? acc[1] : 'var(--linea)'}"><h4>${titulo}</h4>${hoy}${hist}</div>`;
}
const saber = (tit, cuerpo) => `<details class="saber" open><summary>${tit}</summary><div class="dentro">${cuerpo}</div></details>`;
const TITULOS = { rentatrab: 'Renta por trabajador, comparada', participacion: 'Participación laboral, comparada', pib: 'PIB nominal, comparado', crecimiento: 'Crecimiento del PIB real, comparado', pibpersona: 'PIB per cápita, comparado', pibreal: 'PIB real, comparado',
  desempleo: 'Tasa de desempleo, comparada', inflacion: 'Inflación, comparada', exportaciones: 'Exportaciones (% del PIB)', importaciones: 'Importaciones (% del PIB)' };

// Gráfica del indicador contra el tiempo: cada evento cuenta como un año.
function grafTiempo(vals, fmt, color) {
  const v = vals.filter(Number.isFinite);
  const cab = `<h4>Evolución por año <span class="suave">(cada evento = 1 año)</span></h4>`;
  if (v.length < 2) return `<div class="bloque tiempo">${cab}<p class="nota">Aparecerá en cuanto pase el primer año (simula un evento).</p></div>`;
  const W = 480, H = 190, L = 64, Rm = 14, T = 16, B = 30;
  let lo = Math.min(...v), hi = Math.max(...v); if (hi - lo < Math.abs(hi) * 1e-6 + 1e-9) { lo -= Math.abs(lo) * .01 + 1e-6; hi += Math.abs(hi) * .01 + 1e-6; }
  const pad = (hi - lo) * .15; lo -= pad; hi += pad;
  const X = i => L + (W - L - Rm) * (v.length === 1 ? .5 : i / (v.length - 1)), Y = y => T + (H - T - B) * (1 - (y - lo) / (hi - lo));
  const marcas = [0, .5, 1].map(f => lo + (hi - lo) * f);
  const paso = Math.max(1, Math.ceil(v.length / 8));
  const pts = v.map((y, i) => `${X(i).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
  return `<div class="bloque tiempo">${cab}<svg viewBox="0 0 ${W} ${H}" class="svg-tiempo" role="img" aria-label="Evolución por año">
    ${marcas.map(m => `<line x1="${L}" x2="${W - Rm}" y1="${Y(m)}" y2="${Y(m)}" class="rej"/><text x="${L - 6}" y="${Y(m) + 4}" text-anchor="end" class="eje">${fmt.corto(m)}</text>`).join('')}
    ${v.map((_, i) => i % paso && i !== v.length - 1 ? '' : `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" class="eje">Año ${i}</text>`).join('')}
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${v.map((y, i) => `<circle cx="${X(i)}" cy="${Y(y)}" r="${i === v.length - 1 ? 5.5 : 3.5}" fill="${i === v.length - 1 ? color : 'var(--tarj)'}" stroke="${color}" stroke-width="2"><title>Año ${i}: ${fmt.exacto(y)}</title></circle>`).join('')}
    <text x="${X(v.length - 1) - 8}" y="${Y(v[v.length - 1]) - 10}" text-anchor="end" class="ult">${fmt.corto(v[v.length - 1])}</text>
  </svg></div>`;
}

// Orden de cada indicador en el panel: cifra con su antes y ahora → evolución por año → comparación (hoy e historia) → ¿qué es y de dónde sale?
export function detalleKpi(clave, estado, previo, hist = []) {
  const [k, titulo, get, fmt, subeBueno, modo, porque, relato, , subs, comp, extras] = porClave(clave);
  const hay = !!previo, serie = g => (hist.length ? hist : [estado]).map(e => { try { return g(e); } catch { return NaN; } });
  const comparaciones = estado.comparacion || {};
  const compara = lista => lista.map(x => bloqueCompara(comparaciones[x], TITULOS[x] || 'Comparado con el mundo real', ACC[x])).join('');
  const sinDatos = '<div class="bloque comp"><h4>Comparado con el mundo real</h4><p class="texto">Para este indicador no hay datos de países reales en <code>datos/paises.json</code>.</p></div>';
  const veredicto = (v, p, sb) => { const dif = v - p, nulo = !hay || Math.abs(dif) < 1e-9 * Math.max(1, Math.abs(p));
    return !hay ? 'Todavía no ha habido ningún evento.' : nulo ? 'Con este evento se quedó igual.'
      : sb === null ? `${dif > 0 ? 'Subió' : 'Bajó'}, y eso no es bueno ni malo por sí solo.`
      : `En este evento ${dif > 0 ? 'subió' : 'bajó'}, y para el país eso es ${(dif > 0) === sb ? 'una buena noticia' : 'una mala noticia'}.`; };

  const seccion = (t, g, f, sb, md, cs, textos, acc) => {
    const v = g(estado), p = hay ? g(previo) : v, color = (acc || ACC.pib)[1];
    const comps = cs.filter(x => comparaciones[x]);
    return `<section class="indicador" style="--ac:${color}">`
      + bloqueBarras(t, v, p, f, md, sb, hay, acc)
      + grafTiempo(serie(g), f, color)
      + (comps.length ? compara(comps) : cs.length ? sinDatos : '')
      + saber('¿Qué es y de dónde sale?', textos.map(x => `<p class="texto">${x}</p>`).join('') + `<p class="texto suave">${veredicto(v, p, sb)}</p>`)
      + '</section>';
  };

  const cuerpo = subs
    ? subs.map(([t, g, f, sb, md, cs, tx]) => seccion(t, g, f, sb, md, cs || [], tx || [], ACC[(cs || [])[0]] || (f === gente ? ACC.gente : ACC.pib))).join('')
    : seccion(titulo, get, fmt, subeBueno, modo, [comp, ...(extras || [])].filter(Boolean),
        [GLOSARIO[k] || '', relato, `<b>Cómo lo calcula MiniPaís:</b> ${porque}`].filter(Boolean), ACC[k]);
  return { titulo, cuerpo };
}
