// Agente 7 · Gráficas con zoom y números reales (Chart.js 4, cargado desde index.html).
// Las curvas del «antes» viven siempre en la gráfica: empiezan debajo de las nuevas y se destapan
// cuando llega el evento, así se ve que la curva se corrió y dejó su rastro en el sitio.
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const vivos = new WeakMap(), notas = new WeakMap();
const sinMov = matchMedia('(prefers-reduced-motion: reduce)').matches;
const limpio = v => Number(v.toPrecision(12));                     // quita la basura decimal (0.70000000001)
const fP = v => '$ ' + limpio(v).toLocaleString('es', { maximumFractionDigits: v < 10 ? 2 : v < 100 ? 1 : 0 });
const fQ = v => new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
// El salario del motor es un índice (1 = al inicio); se muestra como salario mensual con una base de US$ 1.000.
const fW = v => '$ ' + Math.round(limpio(v) * 1000).toLocaleString('es');
const coma = v => v.toFixed(1).replace('.', ',');

// Tirar la gráfica para que la siguiente se construya desde cero (sin que una se transforme en la otra).
export function reiniciaGrafica(canvas) { vivos.get(canvas)?.destroy(); vivos.delete(canvas); }

// Zoom con la rueda (o pellizco) y desplazamiento arrastrando; doble clic vuelve a la vista original.
if (window.ChartZoom) Chart.register(window.ChartZoom);
const ZOOM = { zoom: { wheel: { enabled: true, speed: 0.08 }, pinch: { enabled: true }, mode: 'xy' }, pan: { enabled: true, mode: 'xy' } };
function dibujar(canvas, config, plugin) {
  const c = vivos.get(canvas);
  if (c && c.config.type === config.type && c.data.datasets.length === config.data.datasets.length) {
    config.data.datasets.forEach((d, i) => Object.assign(c.data.datasets[i], d));
    c.options.scales = config.options.scales; c.update(); return;
  }
  c?.destroy();
  config.options = { responsive: true, maintainAspectRatio: false, animation: false,
    // El rastro punteado se destapa cambiando de transparente a gris: así entra con transición.
    animations: { colors: { type: 'color', properties: ['borderColor', 'backgroundColor'], duration: 900, easing: 'easeOutQuad' } },
    layout: { padding: { right: 10, top: 22 } }, plugins: { legend: { display: false }, tooltip: { enabled: false }, zoom: ZOOM }, ...config.options };
  config.plugins = [plugin];
  const nueva = new Chart(canvas, config); vivos.set(canvas, nueva);
  canvas.ondblclick = () => vivos.get(canvas)?.resetZoom?.();
  canvas.title = 'Rueda del ratón: acercar o alejar · Arrastrar: mover · Doble clic: volver a la vista original';
  // La primera pintada aparece ya hecha; los cambios posteriores sí se animan.
  nueva.options.animation = sinMov ? false : { duration: 1800, easing: 'easeInOutCubic' };
}
const linea = (data, color, extra = {}) => ({ label: '', data, borderColor: color, backgroundColor: color, showLine: true, pointRadius: 0, borderWidth: 3, ...extra });
// Rango «lindo» (1, 2, 5, 10…) alrededor de un centro.
function nice(c, h, min0 = false) {
  const r = h / 2, p = 10 ** Math.floor(Math.log10(r)), f = r / p, s = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  let lo = Math.floor((c - h) / s) * s; if (min0) lo = Math.max(0, lo);
  return { min: limpio(lo), max: limpio(Math.ceil((c + h) / s) * s) };
}
// Medio ancho del eje: si hubo cambio, se acerca hasta que el cambio ocupe buena parte de la gráfica.
const zoom = (base, delta) => Math.abs(delta) > base * 1e-6 ? Math.max(Math.abs(delta) * 3, base * .012) : base * .22;
const ejes = (x, y, rx, ry, fx, fy) => ({ scales: {
  x: { type: 'linear', ...rx, title: { display: true, text: x, color: css('--suave') }, ticks: { maxTicksLimit: 6, callback: fx }, grid: { color: css('--linea') } },
  y: { type: 'linear', ...ry, title: { display: true, text: y, color: css('--suave') }, ticks: { maxTicksLimit: 6, callback: fy }, grid: { color: css('--linea') } } } });

// ---------- dibujo a mano: flechas, guías, etiquetas ----------
function texto(ctx, t, x, y, c, al = 'left', f = '700 12px system-ui') {
  ctx.font = f; ctx.textAlign = al; ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = css('--tarj'); ctx.strokeText(t, x, y);
  ctx.fillStyle = c; ctx.fillText(t, x, y);
}
function flecha(ctx, x1, y1, x2, y2, c, w = 5) {
  const a = Math.atan2(y2 - y1, x2 - x1), h = w * 2.6; ctx.strokeStyle = ctx.fillStyle = c; ctx.lineWidth = w; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * h * .7, y2 - Math.sin(a) * h * .7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - h * Math.cos(a - .45), y2 - h * Math.sin(a - .45)); ctx.lineTo(x2 - h * Math.cos(a + .45), y2 - h * Math.sin(a + .45)); ctx.closePath(); ctx.fill();
}
const punto = (ctx, x, y, c, r = 4.5) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = css('--tarj'); ctx.stroke(); };
const xEn = (el, y) => { const [p, q] = el, t = (y - p.y) / (q.y - p.y); return p.x + (q.x - p.x) * t; };
const limite = (v, a, b) => Math.max(a, Math.min(b, v));

const pluginMercado = { id: 'anotaM', afterDatasetsDraw(ch) {
  const n = notas.get(ch.canvas); if (!n || n.trabajo) return;
  const { ctx, chartArea: A } = ch, M = i => ch.getDatasetMeta(i).data, rojo = css('--baja'), verde = css('--sube'), tinta = css('--tinta'), gris = css('--antes');
  ctx.save(); ctx.beginPath(); ctx.rect(A.left, A.top - 20, A.right - A.left, A.bottom - A.top + 20); ctx.clip();
  const guia = (p, c, tp, tq, dash) => { if (!p) return; ctx.setLineDash(dash); ctx.lineWidth = 1.5; ctx.strokeStyle = c;
    ctx.beginPath(); ctx.moveTo(A.left, p.y); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x, A.bottom); ctx.stroke(); ctx.setLineDash([]);
    texto(ctx, tp, A.left + 6, p.y - 6, c); texto(ctx, tq, p.x + 6, A.bottom - 8, c); };
  const pAntes = M(4)[0], pHoy = M(5)[0];
  // Mientras la curva viaja no se dibuja ningún punto ni guía: solo se ve el movimiento.
  if (n.fase === 'antes') guia(pHoy, tinta, fP(n.a.precio), fQ(n.a.cantidad), [6, 4]);
  if (n.fase === 'fin') { guia(pAntes, gris, fP(n.a.precio), fQ(n.a.cantidad), [3, 4]); guia(pHoy, tinta, fP(n.b.precio), fQ(n.b.cantidad), [6, 4]); }
  if (n.peq) { // el cambio es tan pequeño que no se dibuja ningún traslado: se avisa en vez de dejar la gráfica sin explicación
    const cx = (A.left + A.right) / 2, cy = A.top + (A.bottom - A.top) * .22;
    texto(ctx, 'Cambios no registrados', cx, cy, css('--suave'), 'center', '800 17px system-ui');
    texto(ctx, 'Aquí el efecto es tan pequeño que las curvas casi no se mueven.', cx, cy + 22, css('--suave'), 'center', '600 12px system-ui');
  }
  const sufijo = n.fase === 'antes' ? '' : ' ahora';
  texto(ctx, 'Demanda' + sufijo, A.left + 8, A.top - 6, css('--dem'), 'left', '700 13px system-ui');
  texto(ctx, 'Oferta' + sufijo, A.right - 8, A.top - 6, css('--ofe'), 'right', '700 13px system-ui');
  if (n.fase === 'fin' && n.shift) { // la palabra «antes» pegada al rastro que dejó la curva
    const k = n.shift.curva === 'oferta' ? 1 : 0, g = M(k), yy = A.top + (A.bottom - A.top) * .16;
    if (g.length > 1) texto(ctx, 'antes', limite(xEn(g, yy), A.left + 26, A.right - 26), yy, gris, 'center', '600 11px system-ui');
  }
  if (n.fase !== 'antes' && n.shift) { // flecha roja: acompaña a la curva mientras se traslada
    const k = n.shift.curva === 'demanda' ? 0 : 1, g = M(k), c2 = M(k + 2), H = A.bottom - A.top;
    let mejor = null;
    // Se prueba a varias alturas y se usa la primera donde las dos curvas caben dentro de la gráfica.
    if (g.length > 1 && c2.length > 1) for (const f of [.28, .4, .52, .18, .64, .76, .88]) {
      const yy = A.top + H * f, xg = xEn(g, yy), xn = xEn(c2, yy);
      if (Math.min(xg, xn) > A.left + 16 && Math.max(xg, xn) < A.right - 16 && Math.abs(xn - xg) > 5) { mejor = { yy, xg, xn }; break; }
    }
    if (mejor) {
      let { yy, xg, xn } = mejor; const d = Math.sign(xn - xg) || n.shift.dir || 1;
      if (Math.abs(xn - xg) < 44) { const m = (xg + xn) / 2; xg = m - 22 * d; xn = m + 22 * d; }
      const cs = d > 0 ? verde : rojo;       // a la derecha: se intercambia más (verde); a la izquierda, menos (rojo)
      flecha(ctx, xg, yy, xn, yy, cs, 6);
      const anchoTxt = (n.shift.txt.length * 7) / 2 + 6;
      texto(ctx, n.shift.txt, limite((xg + xn) / 2, A.left + anchoTxt, A.right - anchoTxt), yy - 13, cs, 'center', '800 13px system-ui');
    }
  }
  if (n.fase === 'fin' && pAntes && pHoy && Math.abs(pAntes.y - pHoy.y) > 6) { // flecha del precio, junto al eje
    const pc = (n.b.precio / n.a.precio - 1) * 100, cp = pc >= 0 ? verde : rojo, x = A.left + 82;
    flecha(ctx, x, pAntes.y, x, pHoy.y, cp, 5);
    texto(ctx, `${pc >= 0 ? '▲' : '▼'} ${coma(Math.abs(pc))} %`, x + 12, (pAntes.y + pHoy.y) / 2 + 4, cp);
  }
  ctx.restore();
} };

// Dibuja un mercado en una de tres fases, siempre con los mismos ejes para que el movimiento se note:
//   'antes' → curvas y punto de equilibrio de antes del evento
//   'mueve' → las mismas curvas se trasladan solas; se destapa el rastro punteado y no hay puntos
//   'fin'   → quedan el rastro, el punto de antes y el de ahora
// a = estado antes, m = estado después, o.shift = {curva, dir, txt}.
export function graficoMercado(canvas, a, m, o = {}) {
  // Si el cambio es casi invisible (menos de 0,3 % en precio y cantidad), no se dibuja ningún traslado:
  // se muestra el mercado tal como quedó, sin rastro, flechas ni punto de «antes» encimado.
  const peq = Math.abs(m.cantidad / a.cantidad - 1) < .003 && Math.abs(m.precio / a.precio - 1) < .003;
  if (peq) { a = m; o = { ...o, shift: null, rastro: false, fase: 'antes', solo: null }; }
  const fase = o.fase || 'fin', gris = css('--antes'), viaja = fase !== 'antes';
  const rx = nice((a.cantidad + m.cantidad) / 2, zoom(a.cantidad, m.cantidad - a.cantidad), true);
  const ry = nice((a.precio + m.precio) / 2, zoom(a.precio, m.precio - a.precio), true);
  const recta = pts => { const n = pts.length, p = pts[Math.floor(n / 3)], q = pts[Math.floor(2 * n / 3)], xa = y => p.x + (y - p.y) * (q.x - p.x) / (q.y - p.y);
    return [{ x: xa(ry.min), y: ry.min }, { x: xa(ry.max), y: ry.max }]; };
  const vivo = viaja ? m : a;
  // o.solo permite mover una curva primero y la otra después, cuando el evento golpea a las dos.
  const cDem = (viaja && o.solo !== 'oferta') ? m : a, cOfe = (viaja && o.solo !== 'demanda') ? m : a;
  const visible = viaja && o.rastro !== false, invisible = 'rgba(0,0,0,0)';
  // Solo deja rastro la curva que de verdad se movió; la que se queda quieta no lleva línea punteada.
  const pt = (c, k) => c[Math.floor(c.length * k)].x, movida = c => Math.abs(pt(a.curvas[c], .5) - pt(m.curvas[c], .5)) > 1e-4 * a.cantidad;
  const rastro = c => ({ borderDash: [7, 5], borderWidth: 2, borderColor: visible && movida(c) ? gris : invisible });
  notas.set(canvas, { a, b: m, fase, shift: o.shift, trabajo: false, peq: peq && !!o.evento });
  dibujar(canvas, { type: 'scatter', data: { datasets: [
    linea(recta(a.curvas.demanda), gris, rastro('demanda')), linea(recta(a.curvas.oferta), gris, rastro('oferta')),
    linea(recta(cDem.curvas.demanda), css('--dem')), linea(recta(cOfe.curvas.oferta), css('--ofe')),
    { label: '', data: [{ x: a.cantidad, y: a.precio }], pointRadius: 7, backgroundColor: 'transparent', borderWidth: 2, borderColor: fase === 'fin' ? gris : invisible },
    { label: '', data: [{ x: vivo.cantidad, y: vivo.precio }], pointRadius: 8, backgroundColor: css('--tinta') }] },
  options: ejes('Cantidad (unidades)', 'Precio por unidad ($)', rx, ry, fQ, fP) }, pluginMercado);
}

const pluginTrabajo = { id: 'anotaT', afterDatasetsDraw(ch) {
  const n = notas.get(ch.canvas); if (!n || !n.trabajo) return;
  const { ctx, chartArea: A } = ch, M = i => ch.getDatasetMeta(i).data, gris = css('--antes'), ex = ch.scales.x;
  ctx.save(); ctx.beginPath(); ctx.rect(A.left, A.top - 20, A.right - A.left, A.bottom - A.top + 20); ctx.clip();
  // Salario mínimo: parte de US$ 1.000 al mes y sube lo mismo que los precios.
  const yBase = ch.scales.y.getPixelForValue(1);
  if (yBase > A.top + 4 && yBase < A.bottom - 4) {
    ctx.setLineDash([2, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = css('--suave');
    ctx.beginPath(); ctx.moveTo(A.left, yBase); ctx.lineTo(A.right, yBase); ctx.stroke(); ctx.setLineDash([]);
    texto(ctx, 'Salario mínimo: $ 1.000 de partida' + ((n.pBase ?? 1) > 1.0005 ? ' (= $ ' + Math.round(n.pBase * 1000).toLocaleString('es') + ' de hoy)' : ''), A.right - 8, yBase - 6, css('--suave'), 'right', '700 12px system-ui');
  }
  const b = M(4);                                   // la franja de personas sin empleo
  if (n.fase !== 'mueve' && n.cruce) {              // el punto donde las dos curvas se cruzan
    const px = ex.getPixelForValue(n.cruce.x), py = ch.scales.y.getPixelForValue(n.cruce.y);
    if (px > A.left && px < A.right && py > A.top && py < A.bottom) {
      ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = css('--tinta');
      ctx.beginPath(); ctx.moveTo(A.left, py); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fillStyle = css('--tarj'); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = css('--tinta'); ctx.stroke();
      texto(ctx, 'Salario que dejaría a todos empleados: $ ' + Math.round(n.cruce.y * 1000).toLocaleString('es'), px - 12, py + 18, css('--tinta'), 'right', '700 12px system-ui');
    }
  }
  if (n.fase !== 'mueve' && b.length > 1) {
    const [p, q] = b, col = n.color;
    // Dos líneas de arriba abajo: parten la gráfica en zonas que se pueden nombrar.
    ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = col;
    [p, q].forEach(e => { ctx.beginPath(); ctx.moveTo(e.x, A.top); ctx.lineTo(e.x, A.bottom); ctx.stroke(); }); ctx.setLineDash([]);
    punto(ctx, p.x, p.y, col); punto(ctx, q.x, q.y, col);
    const der = q.x + 170 < A.right, señal = n.fase === 'fin' && n.dif > .05 ? '  ▲ más' : n.fase === 'fin' && n.dif < -.05 ? '  ▼ menos' : '';
    texto(ctx, `sin empleo: ${coma(n.des)} %${señal}`, der ? q.x + 12 : p.x - 12, p.y - 15, col, der ? 'left' : 'right', '800 13px system-ui');
    // Flechas que señalan cada línea, y en medio los que buscan y no encuentran.
    const yb = A.bottom - 30, tinta = css('--tinta'), L = 74;
    if (p.x - A.left > L + 24) {                       // los que tienen empleo están a la izquierda
      flecha(ctx, p.x - 7, yb, p.x - L, yb, tinta, 3);
      texto(ctx, `con empleo: ${coma(n.ocupados)} %`, p.x - L / 2 - 3, yb - 8, tinta, 'center', '700 11px system-ui');
    }
    if (A.right - q.x > L + 24) {                        // hasta esta línea llega quien quiere trabajar
      flecha(ctx, q.x + 7, yb, q.x + L, yb, css('--ofe'), 3);
      texto(ctx, `quieren trabajar: ${coma(n.fuerza)} %`, q.x + L / 2 + 3, yb - 8, css('--ofe'), 'center', '700 11px system-ui');
    }
    if (q.x - p.x > 110) {
      const med = (p.x + q.x) / 2, yc = yb - 22;
      flecha(ctx, med, yc, q.x - 4, yc, col, 3); flecha(ctx, med, yc, p.x + 4, yc, col, 3);
      texto(ctx, 'quieren trabajar y no encuentran', med, yc - 8, col, 'center', '700 11px system-ui');
    }
    // El «antes» se dibuja a su altura real: así sus extremos caen sobre las curvas punteadas.
    if (n.fase === 'fin' && n.hayAntes) {
      const y = ch.scales.y.getPixelForValue(n.salarioAntes);
      const x1 = ex.getPixelForValue(n.ocupadosAntes), x2 = ex.getPixelForValue(n.fuerzaAntes);
      ctx.strokeStyle = gris; ctx.lineWidth = 5; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
      punto(ctx, x1, y, gris, 3.5); punto(ctx, x2, y, gris, 3.5);
      const abajo = y > p.y;                       // la etiqueta se aparta de la franja de ahora
      texto(ctx, `antes: ${coma(n.ant)} %`, limite((x1 + x2) / 2, A.left + 42, A.right - 42), y + (abajo ? 18 : -12), gris, 'center', '700 11px system-ui');
    }
  }
  const suf = n.fase === 'antes' ? '' : ' ahora';
  texto(ctx, 'Empresas contratan' + suf, A.left + 8, A.top - 6, css('--dem'), 'left', '700 12px system-ui');
  texto(ctx, 'Gente que quiere trabajar' + suf, A.right - 8, A.top - 6, css('--ofe'), 'right', '700 12px system-ui');
  if (n.fase !== 'antes' && n.shift) texto(ctx, n.shift, A.left + 8, A.top + 16, css('--baja'), 'left', '800 13px system-ui');
  ctx.restore();
} };

// El mercado laboral se dibuja igual que los demás: tres fases y los mismos ejes.
// a = trabajo antes, t = trabajo ahora. o.fase: 'antes' | 'mueve' | 'fin'. o.shift = frase del cambio.
// Pasa una curva a una cuadrícula fija de salarios. Así el «antes» y el «después» tienen los mismos puntos
// y, al animar, cada punto solo se corre de lado en vez de reacomodarse (que hacía que la curva se encogiera y volviera a crecer).
const REJILLA = Array.from({ length: 41 }, (_, i) => 0.5 + i * 0.025);
function muestrea(pts) {
  const p = [...pts].sort((u, v) => u.y - v.y); if (p.length < 2) return pts;
  return REJILLA.map(y => {
    let i = p.findIndex(q => q.y >= y); if (i < 1) i = i === 0 ? 1 : p.length - 1;
    const u = p[i - 1], v = p[i], k = v.y === u.y ? 0 : (y - u.y) / (v.y - u.y);
    return { x: u.x + (v.x - u.x) * k, y };
  });
}
export function graficoTrabajo(canvas, a, t, o = {}) {
  const fase = o.fase || 'fin', viaja = fase !== 'antes';
  // Las curvas y el salario se dibujan en términos reales (dólares de partida): el mínimo sube con los precios,
  // así que su poder de compra no cambia y las curvas solo se trasladan de lado, sin saltos raros.
  const P = x => x.indicePrecios ?? 1, w = x => x.salario ?? x.w, esc = (x, pts) => pts;
  const ca = { demanda: muestrea(a.curvas.demanda), oferta: muestrea(a.curvas.oferta) }, ct = { demanda: muestrea(t.curvas.demanda), oferta: muestrea(t.curvas.oferta) };
  const vivo = viaja ? t : a, cv = viaja ? ct : ca, dif = t.desempleo - a.desempleo, hay = Math.abs(dif) > .0001;
  // Verde si el desempleo baja, rojo si sube; azul mientras no hay evento.
  const col = fase === 'antes' || !hay ? css('--acento') : dif > 0 ? css('--baja') : css('--sube');
  const ws = [w(a), w(t)], sw = Math.max(.26, (Math.max(...ws) - Math.min(...ws)) * 2.6);
  const lo = Math.min(a.ocupados, t.ocupados), hi = Math.max(a.fuerzaLaboral, t.fuerzaLaboral);
  const ry = nice((Math.min(...ws) + Math.max(...ws)) / 2, sw / 2 + .05), rx = nice((lo + hi) / 2, Math.max((hi - lo) * 1.5, 2.5));
  // Solo se deja rastro de la curva que de verdad se movió; si no, saldría una línea punteada sobrante.
  const movida = c => viaja && Math.abs(ca[c][20].x - ct[c][20].x) > 1e-6;
  // Cruce de las dos curvas: el salario al que todos los que quieren trabajar tendrían empleo.
  const cruceDe = (D, O) => { for (let i = 1; i < Math.min(D.length, O.length); i++) {
    const f0 = O[i - 1].x - D[i - 1].x, f1 = O[i].x - D[i].x;
    if (f0 === 0 || f0 * f1 < 0) { const t = f0 === f1 ? 0 : f0 / (f0 - f1);
      return { x: D[i - 1].x + (D[i].x - D[i - 1].x) * t, y: D[i - 1].y + (D[i].y - D[i - 1].y) * t }; } } return null; };
  const cruceR = cruceDe(cv.demanda, cv.oferta), cruce = cruceR;
  notas.set(canvas, { trabajo: true, cruce, pBase: P(vivo), fase, des: vivo.desempleo, ant: a.desempleo, hayAntes: hay, dif, color: col,
    ocupadosAntes: a.ocupados, fuerzaAntes: a.fuerzaLaboral, ocupados: vivo.ocupados, fuerza: vivo.fuerzaLaboral, salarioAntes: w(a), salarioAhora: w(vivo), shift: o.shift });
  const rastro = c => ({ borderDash: [6, 5], borderWidth: 1.8, borderColor: movida(c) ? css('--antes') : 'rgba(0,0,0,0)' });
  dibujar(canvas, { type: 'scatter', data: { datasets: [
    linea(ca.demanda, css('--antes'), rastro('demanda')), linea(ca.oferta, css('--antes'), rastro('oferta')),
    linea(cv.demanda, css('--dem')), linea(cv.oferta, css('--ofe')),
    linea([{ x: vivo.ocupados, y: w(vivo) }, { x: vivo.fuerzaLaboral, y: w(vivo) }], col, { borderWidth: 14, borderCapStyle: 'butt' })] },
  options: ejes('Personas (% de la población)', 'Salario mensual real ($ de partida)', rx, ry, v => coma(v).replace(',0', ''), fW) }, pluginTrabajo);
}
