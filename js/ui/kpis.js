// Indicadores del país: tarjetas compactas y panel lateral con el detalle de cada uno.
import { GLOSARIO } from './narrativa.js';

const sinMov = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coma = (v, n = 1) => Number.isFinite(v) ? v.toLocaleString('es', { minimumFractionDigits: n, maximumFractionDigits: n }) : '—';

// Formatos: «corto» para la tarjeta, «exacto» para el panel.
const dineroCompacto = (v, dec) => { const a = Math.abs(v); return 'US$ ' + (a >= 1e12 ? coma(v / 1e12, 3) + ' B' : a >= 1e9 ? coma(v / 1e9, dec) + ' mil M' : coma(v / 1e6, dec) + ' M'); };
const dinero = { corto: v => dineroCompacto(v, 1), fino: v => dineroCompacto(v, 2), exacto: v => 'US$ ' + (Number.isFinite(v) ? Math.round(v).toLocaleString('es') : '—') };
const pc = { corto: v => coma(v, 2) + ' %', exacto: v => coma(v, 2) + ' %' };
const per = { corto: dinero.exacto, exacto: dinero.exacto };
const gente = { corto: v => coma(v / 1e6, 2) + ' M', exacto: v => (Number.isFinite(v) ? Math.round(v).toLocaleString('es') : '—') + ' personas' };

// Lecturas del estado.
const pob = e => e.pais.poblacion;
const pea = e => e.trabajo.fuerzaLaboral / 100 * pob(e);
const empleados = e => e.trabajo.ocupados / 100 * pob(e);
const real = e => e.macro.pibRealEncadenado ?? e.macro.pibReal ?? e.macro.pibNominal;

// Icono y color de cada indicador (también de los sub-indicadores del panel).
const ACC = {
  pib: ['💵', '#6aa8ff'], pibreal: ['📈', '#5fd486'], pibpersona: ['👤', '#c792ea'], rentatrab: ['🛠️', '#f4d35e'],
  desempleo: ['👷', '#ffa04d'], participacion: ['🙋', '#ffa04d'], gente: ['👥', '#ffa04d'],
  inflacion: ['🛒', '#ff6b72'], exportaciones: ['🚢', '#4dd0c8'], importaciones: ['📦', '#b39ddb'], crecimiento: ['📈', '#5fd486']
};
const TITULOS = {
  pib: 'PIB nominal, comparado', pibreal: 'PIB real, comparado', crecimiento: 'Crecimiento del PIB real, comparado',
  pibpersona: 'PIB per cápita, comparado', rentatrab: 'Renta por trabajador, comparada', desempleo: 'Tasa de desempleo, comparada',
  participacion: 'Participación laboral, comparada', inflacion: 'Inflación, comparada',
  exportaciones: 'Exportaciones (% del PIB)', importaciones: 'Importaciones (% del PIB)'
};

/**
 * Cada indicador: valor, formato, si subir es bueno (null = ni bueno ni malo) y cómo se expresa el cambio
 * ('rel' = en %, 'pp' = en puntos). «comparar» es la clave con la que se busca el país real parecido.
 * Los que tienen «subs» muestran varios sub-indicadores en el panel, cada uno con sus textos.
 */
const DEF = [
  { clave: 'pib', titulo: 'PIB', valor: real, fmt: dinero, subeBueno: true, modo: 'rel',
    extra: e => dinero.corto(e.macro.pibNominal) + ' nominal · ' + per.corto(real(e) / pob(e)) + ' por persona',
    subs: [
      { titulo: 'PIB nominal (precios de hoy)', valor: e => e.macro.pibNominal, fmt: dinero, subeBueno: true, modo: 'rel', icono: 'pib', comparar: ['pib'],
        textos: ['Todo lo que el país produce, valorado a los precios de hoy. Sube si se produce más, pero también si todo se encarece.',
          'MiniPaís multiplica el precio por la cantidad de cada mercado con los valores de después del evento y suma los resultados.'] },
      { titulo: 'PIB real (precios de antes)', valor: real, fmt: dinero, subeBueno: true, modo: 'rel', icono: 'pibreal', comparar: ['pibreal', 'crecimiento'],
        textos: ['Lo que el país produce, pero valorado con los precios de antes del evento. Solo sube si de verdad se hacen más cosas.',
          'MiniPaís toma las cantidades nuevas de cada mercado y las multiplica por los precios anteriores. Cada evento se encadena sobre el anterior, así el crecimiento económico es el cambio de este número.'] },
      { titulo: 'PIB per cápita', valor: e => real(e) / pob(e), fmt: per, subeBueno: true, modo: 'rel', icono: 'pibpersona', comparar: ['pibpersona'],
        textos: ['Lo que le toca producir a cada persona si el PIB se repartiera en partes iguales. Es la forma de comparar países de tamaños distintos.',
          'MiniPaís divide el PIB real entre la población total.'] },
      { titulo: 'Renta por trabajador', valor: e => real(e) / empleados(e), fmt: per, subeBueno: true, modo: 'rel', icono: 'rentatrab', comparar: ['rentatrab'],
        textos: ['Lo que produce, en promedio, cada persona que tiene empleo. Mide qué tan productivo es el trabajo del país.',
          'MiniPaís divide el PIB real entre el número de personas empleadas.'] }
    ] },
  { clave: 'desempleo', titulo: 'Tasa de desempleo', valor: e => e.trabajo.desempleo, fmt: pc, subeBueno: false, modo: 'pp',
    extra: e => gente.corto(empleados(e)) + ' empleados de ' + gente.corto(pea(e)) + ' activos',
    subs: [
      { titulo: 'Tasa de desempleo', valor: e => e.trabajo.desempleo, fmt: pc, subeBueno: false, modo: 'pp', icono: 'desempleo', comparar: ['desempleo'],
        textos: ['Personas activas que buscan trabajo y no lo encuentran, como porcentaje de la población económicamente activa.',
          'MiniPaís divide los desocupados entre la población económicamente activa.'] },
      { titulo: 'Población total', valor: pob, fmt: gente, subeBueno: null, modo: 'rel', icono: 'gente', comparar: [],
        textos: ['Todas las personas que viven en el país, de cualquier edad.', 'Se elige en el menú (Opciones → Población) y crece un poco cada año.'] },
      { titulo: 'Población económicamente activa', valor: pea, fmt: gente, subeBueno: true, modo: 'rel', icono: 'participacion', comparar: ['participacion'],
        textos: ['Las personas que pueden y desean trabajar: las que tienen empleo más las que lo buscan.',
          'MiniPaís toma la población en edad de trabajar y le aplica la tasa de participación del perfil del país.'] },
      { titulo: 'Personas empleadas', valor: empleados, fmt: gente, subeBueno: true, modo: 'rel', icono: 'gente', comparar: [],
        textos: ['Las personas que efectivamente tienen trabajo.', 'MiniPaís resta los desocupados a la población económicamente activa.'] }
    ] },
  { clave: 'inflacion', titulo: 'Inflación (IPC)', valor: e => e.macro.inflacion * 100, fmt: pc, subeBueno: false, modo: 'pp', comparar: 'inflacion',
    calculo: 'El promedio de los cambios de precio, dando más peso a los mercados grandes.',
    relato: 'El índice de precios al consumidor mide lo que cuesta la canasta que compra la gente. No todo sube igual: si la comida sube mucho y la tecnología baja, la inflación queda en medio, pero pesa más la comida porque ahí se gasta más.' },
  { clave: 'exportaciones', titulo: 'Exportaciones', valor: e => e.macro.exportaciones, fmt: dinero, subeBueno: true, modo: 'rel', comparar: 'exportaciones',
    extra: e => 'el ' + coma(e.macro.pibNominal ? e.macro.exportaciones / e.macro.pibNominal * 100 : 0) + ' % del PIB',
    calculo: 'La parte de lo que produce cada mercado que se vende al extranjero.',
    relato: 'Es lo que el país le vende al resto del mundo. Cuando suben, entra dinero y las empresas de esos mercados producen más; si un vecino entra en recesión y deja de comprar, caen y el golpe se siente aquí.' },
  { clave: 'importaciones', titulo: 'Importaciones', valor: e => e.macro.importaciones, fmt: dinero, subeBueno: null, modo: 'rel', comparar: 'importaciones',
    extra: e => 'el ' + coma(e.macro.pibNominal ? e.macro.importaciones / e.macro.pibNominal * 100 : 0) + ' % del PIB',
    calculo: 'La parte de la demanda de cada mercado que se cubre con producto extranjero.',
    relato: 'Es lo que el país le compra al resto del mundo. Ni buenas ni malas por sí solas: importar máquinas o medicinas puede hacer crecer al país, pero si sustituyen producción nacional, los fabricantes de aquí venden menos.' }
];

// ---------- utilidades ----------
const esNulo = (dif, p) => Math.abs(dif) < 1e-9 * Math.max(1, Math.abs(p));
const cambio = (dif, p, modo) => (dif > 0 ? '+' : '−') + (modo === 'pp' ? coma(Math.abs(dif), 2) + ' puntos' : coma(p ? Math.abs(dif / p * 100) : 0, 2) + ' %');
const clasePara = (dif, p, subeBueno) => esNulo(dif, p) || subeBueno === null ? '' : (dif > 0) === subeBueno ? 'sube' : 'baja';

// La cifra de la tarjeta corre del valor viejo al nuevo.
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

// ---------- tarjetas ----------
export function renderKpis(cont, estado, previo, alAbrir, historial = []) {
  if (!cont.children.length) {
    cont.innerHTML = DEF.map(({ clave, titulo }) => `<button class="kpi" id="k-${clave}" data-k="${clave}" style="--ac:${ACC[clave][1]}">
      <span class="fondo"></span><div class="t"><span class="ic">${ACC[clave][0]}</span>${titulo}</div><div class="n"></div><span class="d"></span><span class="ex"></span></button>`).join('');
    cont.onclick = e => { const k = e.target.closest('.kpi'); if (k) alAbrir?.(k.dataset.k); };
  }
  for (const { clave, valor, fmt, subeBueno, modo, extra } of DEF) {
    const el = cont.querySelector('#k-' + clave), v = valor(estado), p = previo ? valor(previo) : v, dif = v - p;
    const clase = previo ? clasePara(dif, p, subeBueno) : '';
    contar(el.querySelector('.n'), p, v, fmt.corto);
    el.querySelector('.d').textContent = !previo ? '' : esNulo(dif, p) ? 'sin cambio' : (dif > 0 ? '▲ ' : '▼ ') + cambio(dif, p, modo);
    el.classList.toggle('sube', clase === 'sube'); el.classList.toggle('baja', clase === 'baja');
    el.querySelector('.fondo').innerHTML = spark(historial.map(valor), clase ? `var(--${clase})` : 'var(--acento)');
    el.querySelector('.ex').textContent = extra ? extra(estado) : '';
  }
}

// ---------- panel lateral ----------
// Bloque «antes y ahora»: dos barras en la misma escala, ampliada para que el cambio se vea.
function bloqueBarras(titulo, v, p, fmt, modo, subeBueno, hayPrevio, acc) {
  const dif = v - p, nulo = !hayPrevio || esNulo(dif, p), clase = hayPrevio ? clasePara(dif, p, subeBueno) : '';
  const lo = Math.min(p, v), hi = Math.max(p, v), span = hi - lo;
  const base = span > 0 ? Math.max(0, lo - span * 1.1) : 0, tope = span > 0 ? hi + span * .35 : Math.abs(hi) * 1.15 || 1;
  const ancho = x => Math.max(2, Math.min(100, (x - base) / (tope - base) * 100));
  const barra = (n, val, cl, tip) => `<div class="fila-b" title="${tip}"><span class="et">${n}</span>
      <div class="pista"><i class="${cl}" style="width:${ancho(val)}%"></i></div><span class="val">${fmt.corto(val)}</span></div>`;
  return `<div class="bloque ${clase}" style="--ac:${acc[1]}">
      <h4 class="tit"><span class="ic">${acc[0]}</span>${titulo}</h4>
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
  if (!c?.pais) return '';
  const f = c.persona ? dinero.exacto : c.tipo === 'dinero' ? dinero.fino : v => coma(v, 2) + ' %';
  const par = otro => {
    const mx = Math.max(Math.abs(c.mio), Math.abs(otro.valor)) * 1.12 || 1, w = x => Math.max(2, Math.abs(x) / mx * 100);
    return `<div class="barras" style="margin-top:8px">
        <div class="fila-b"><span class="et">Tu país</span><div class="pista"><i class="b-ahora" style="width:${w(c.mio)}%"></i></div><span class="val">${f(c.mio)}</span></div>
        <div class="fila-b"><span class="et">${otro.pais}</span><div class="pista"><i class="b-antes" style="width:${w(otro.valor)}%"></i></div><span class="val">${f(otro.valor)}</span></div>
      </div>`;
  };
  const h = c.historico;
  return `<div class="bloque comp" style="--ac:${acc[1]}"><h4>${titulo}</h4>
      <p class="texto"><b>Hoy:</b> tu país se parece a <b>${c.pais}</b> (dato de ${c.anio}).</p>${par(c)}
      <p class="nota">Fuente: ${c.fuente || 'Banco Mundial'}.</p>
      ${h ? `<p class="texto" style="margin-top:14px"><b>En la historia:</b> una cifra así la tuvo <b>${h.pais}</b> en <b>${h.anio}</b>.</p>${par(h)}
      <p class="nota">Dato de ${h.anio}. Fuente: ${h.fuente || 'Banco Mundial'}.</p>` : ''}</div>`;
}

// Gráfica del indicador contra el tiempo: cada evento cuenta como un año.
function grafTiempo(vals, fmt, color) {
  const v = vals.filter(Number.isFinite);
  const cab = '<h4>Evolución por año <span class="suave">(cada evento = 1 año)</span></h4>';
  if (v.length < 2) return `<div class="bloque tiempo">${cab}<p class="nota">Aparecerá en cuanto pase el primer año (simula un evento).</p></div>`;
  const W = 480, H = 190, L = 64, R = 14, T = 16, B = 30;
  let lo = Math.min(...v), hi = Math.max(...v);
  if (hi - lo < Math.abs(hi) * 1e-6 + 1e-9) { lo -= Math.abs(lo) * .01 + 1e-6; hi += Math.abs(hi) * .01 + 1e-6; }
  const pad = (hi - lo) * .15; lo -= pad; hi += pad;
  const X = i => L + (W - L - R) * i / (v.length - 1), Y = y => T + (H - T - B) * (1 - (y - lo) / (hi - lo));
  const marcas = [0, .5, 1].map(f => lo + (hi - lo) * f), paso = Math.max(1, Math.ceil(v.length / 8));
  const ultimo = v.length - 1;
  return `<div class="bloque tiempo">${cab}<svg viewBox="0 0 ${W} ${H}" class="svg-tiempo" role="img" aria-label="Evolución por año">
    ${marcas.map(m => `<line x1="${L}" x2="${W - R}" y1="${Y(m)}" y2="${Y(m)}" class="rej"/><text x="${L - 6}" y="${Y(m) + 4}" text-anchor="end" class="eje">${fmt.corto(m)}</text>`).join('')}
    ${v.map((_, i) => i % paso && i !== ultimo ? '' : `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" class="eje">Año ${i}</text>`).join('')}
    <polyline points="${v.map((y, i) => `${X(i).toFixed(1)},${Y(y).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${v.map((y, i) => `<circle cx="${X(i)}" cy="${Y(y)}" r="${i === ultimo ? 5.5 : 3.5}" fill="${i === ultimo ? color : 'var(--tarj)'}" stroke="${color}" stroke-width="2"><title>Año ${i}: ${fmt.exacto(y)}</title></circle>`).join('')}
    <text x="${X(ultimo) - 8}" y="${Y(v[ultimo]) - 10}" text-anchor="end" class="ult">${fmt.corto(v[ultimo])}</text>
  </svg></div>`;
}

const saber = (tit, cuerpo) => `<details class="saber" open><summary>${tit}</summary><div class="dentro">${cuerpo}</div></details>`;

// Orden del panel por indicador: cifra con su antes y ahora → evolución por año → comparación → qué es y de dónde sale.
export function detalleKpi(clave, estado, previo, hist = []) {
  const def = DEF.find(d => d.clave === clave), hay = !!previo, comparaciones = estado.comparacion || {};
  const serie = get => (hist.length ? hist : [estado]).map(e => { try { return get(e); } catch { return NaN; } });
  const veredicto = (v, p, sb) => {
    const dif = v - p;
    if (!hay) return 'Todavía no ha habido ningún evento.';
    if (esNulo(dif, p)) return 'Con este evento se quedó igual.';
    if (sb === null) return `${dif > 0 ? 'Subió' : 'Bajó'}, y eso no es bueno ni malo por sí solo.`;
    return `En este evento ${dif > 0 ? 'subió' : 'bajó'}, y para el país eso es ${(dif > 0) === sb ? 'una buena noticia' : 'una mala noticia'}.`;
  };
  const seccion = s => {
    const v = s.valor(estado), p = hay ? s.valor(previo) : v, acc = ACC[s.icono];
    const conDatos = s.comparar.filter(x => comparaciones[x]);
    const comparado = conDatos.length
      ? conDatos.map(x => bloqueCompara(comparaciones[x], TITULOS[x] || 'Comparado con el mundo real', ACC[x] || acc)).join('')
      : s.comparar.length ? '<div class="bloque comp"><h4>Comparado con el mundo real</h4><p class="texto">Para este indicador no hay datos de países reales disponibles.</p></div>' : '';
    return `<section class="indicador" style="--ac:${acc[1]}">`
      + bloqueBarras(s.titulo, v, p, s.fmt, s.modo, s.subeBueno, hay, acc)
      + grafTiempo(serie(s.valor), s.fmt, acc[1])
      + comparado
      + saber('¿Qué es y de dónde sale?', s.textos.map(x => `<p class="texto">${x}</p>`).join('') + `<p class="texto suave">${veredicto(v, p, s.subeBueno)}</p>`)
      + '</section>';
  };
  const secciones = def.subs || [{
    ...def, icono: def.clave, comparar: def.comparar ? [def.comparar] : [],
    textos: [GLOSARIO[clave], def.relato, `<b>Cómo lo calcula MiniPaís:</b> ${def.calculo}`].filter(Boolean)
  }];
  return { titulo: def.titulo, cuerpo: secciones.map(seccion).join('') };
}
