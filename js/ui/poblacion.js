// Agente 7 · Los 100 puntos del país (cuadritos HTML, no una gráfica).
const GRUPOS = [['ocupados', 'Con empleo'], ['desocupados', 'Sin empleo, buscando'], ['inactivos', 'Inactivas'], ['menores', 'Menores de 15']];

export function renderPoblacion(cont, leyenda, g) {
  // Redondeo que siempre suma 100 (el resto va al grupo más grande).
  const n = Object.fromEntries(GRUPOS.map(([k]) => [k, Math.round(g[k])]));
  n.inactivos += 100 - Object.values(n).reduce((a, b) => a + b, 0);
  const clases = GRUPOS.flatMap(([k]) => Array(n[k]).fill(k));
  if (cont.children.length !== 100) cont.innerHTML = '<span class="punto"></span>'.repeat(100);
  [...cont.children].forEach((el, i) => { el.className = 'punto p-' + clases[i]; el.style.transitionDelay = (i * 12) + 'ms'; el.title = GRUPOS.find(x => x[0] === clases[i])[1]; });
  leyenda.innerHTML = GRUPOS.map(([k, t]) => `<li><i class="p-${k}"></i>${t}: <b>${n[k]}</b></li>`).join('');
}