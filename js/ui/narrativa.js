// Agente 6 · Identidad del país, glosario y textos «En resumen».
export const NOMBRES = ['Valdoria','Montebel','Sarandia','Tavira','Corinto','Lumbria','Ostrava','Pelagia','Quintaria','Merovia'];

export const GLOSARIO = {
  pib: 'Todo lo que el país produce y vende en un año, en dinero.',
  crecimiento: 'Cuánto produce el país de más o de menos, sin contar que los precios cambien.',
  desempleo: 'Personas que buscan trabajo y no lo encuentran, sobre todas las que quieren trabajar.',
  inflacion: 'Cuánto subieron los precios en promedio.',
  pibpersona: 'Lo que produce el país dividido entre su gente.',
  comercio: 'Lo que se vende al extranjero menos lo que se compra de afuera.',
  deflactor: 'El PIB nominal dividido entre el real: mide los precios de todo lo que el país produce.',
  exportaciones: 'Lo que el país le vende al resto del mundo.',
  importaciones: 'Lo que el país le compra al resto del mundo.',
  trabajo: 'Cuánto pagan las empresas y cuánta gente quiere trabajar a ese pago.',
  puntos: 'El país en 100 puntos: cada uno es el 1 % de la gente.',
  composicion: 'Quién compra lo que el país produce: hogares, empresas, gobierno y extranjeros.',
  sensibilidad: 'Cuánto cambia lo que la gente compra cuando el precio sube 1 %.'
};

export function globito(clave) {
  const t = GLOSARIO[clave] || '';
  return `<button class="info" type="button" data-tip="${t}" aria-label="${t}">ⓘ</button>`;
}

// Número simple determinista para repetir un país con la misma semilla.
function rnd(sem) { let x = Math.sin(sem * 9301 + 49297) * 233280; return x - Math.floor(x); }

export function identidad(sem = Date.now() % 100000) {
  const nombre = NOMBRES[Math.floor(rnd(sem) * NOMBRES.length)];
  const h = Math.floor(rnd(sem + 1) * 360);
  const colores = [0, 120, 240].map(o => `hsl(${(h + o) % 360} 65% 45%)`);
  const bandera = `<svg viewBox="0 0 3 2" role="img" aria-label="Bandera de ${nombre}">${colores.map((c, i) => `<rect x="${i}" width="1" height="2" fill="${c}"/>`).join('')}</svg>`;
  return { nombre, colores, bandera, periodico: `El Diario de ${nombre}` };
}

const verbo = (v, mas, menos) => (v >= 0 ? mas : menos);
const pct = v => `${Math.abs(v).toFixed(1).replace('.', ',')} %`;
const porId = (e, id) => e.mercados.find(m => m.id === id);

// Frase final en palabras de la calle, a partir del informe de aplicarEvento.
export function resumen(inf) {
  const g = inf.evento.efectos[0];
  const id = g.mercado === 'todos' ? inf.despues.mercados[0].id : g.mercado;
  const a = porId(inf.antes, id), d = porId(inf.despues, id);
  const dP = (d.precio / a.precio - 1) * 100, dQ = (d.cantidad / a.cantidad - 1) * 100;
  const dU = inf.despues.trabajo.desempleo - inf.antes.trabajo.desempleo;
  const causa = {
    demanda: `la gente quiere ${verbo(g.valor, 'comprar más', 'comprar menos')} de ${d.nombre.toLowerCase()}`,
    oferta: `producir ${d.nombre.toLowerCase()} ${verbo(g.valor, 'cuesta menos', 'cuesta más')}`,
    importaciones: `${verbo(g.valor, 'más', 'menos')} ${d.nombre.toLowerCase()} viene de afuera`,
    exportaciones: `el extranjero compra ${verbo(g.valor, 'más', 'menos')} ${d.nombre.toLowerCase()} del país`,
    impuesto: `${verbo(g.valor, 'sube', 'baja')} el impuesto a ${d.nombre.toLowerCase()}`
  }[g.tipo];
  return `En resumen: cuando ${causa}, el precio ${verbo(dP, 'sube', 'baja')} ${pct(dP)} y se vende ${verbo(dQ, 'más', 'menos')} (${pct(dQ)}). ` +
    `Las empresas contratan ${verbo(-dU, 'más', 'menos')} y el desempleo ${verbo(dU, 'sube', 'baja')} ${Math.abs(dU).toFixed(1).replace('.', ',')} puntos. ` +
    `Al final el PIB ${verbo(inf.despues.macro.crecimiento, 'crece', 'cae')} ${pct(inf.despues.macro.crecimiento * 100)}.`;
}

export function etiquetaNivel(ev) { return ev.efectos.some(e => e.mercado === 'todos') ? 'MACRO' : 'MICRO'; }

// Texto grande que explica qué se está viendo en cada paso (0 noticia … 4 país).
export function textoPaso(n, ev, d = {}) {
  const t = ev.efectos[0].tipo, curva = (t === 'oferta' || t === 'impuesto') ? 'naranja (vendedores)' : 'azul (compradores)';
  const f = x => Math.abs(x).toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const sube = x => x >= 0 ? 'sube' : 'baja';
  return [
    '',
    `Mercado de ${d.nombre}: la curva ${curva} se mueve (la línea gris punteada es cómo estaba antes). El precio ${sube(d.dP)} ${f(d.dP)} % y la cantidad ${sube(d.dQ)} ${f(d.dQ)} %.`,
    `Empleo: como se vende ${d.dQ >= 0 ? 'más' : 'menos'}, las empresas contratan ${d.dU <= 0 ? 'más' : 'menos'} y el desempleo ${d.dU <= 0 ? 'baja' : 'sube'} ${Math.abs(d.dU).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} puntos. El salario mínimo sube lo mismo que los precios (parte de $ 1.000 al mes), así que su poder de compra no cambia y la gráfica lo muestra en dólares de partida; por eso el desempleo es la distancia entre la gente que quiere trabajar a ese salario y los puestos que ofrecen las empresas. Puedes verlo en el botón «Mercado laboral».`,
    `Efecto en cadena: quien ${d.dU <= 0 ? 'gana' : 'pierde'} sueldo compra ${d.dU <= 0 ? 'más' : 'menos'} en los demás mercados. Junto a cada mercado verás cuánto cambió su precio, y puedes tocarlo para ver su gráfica.`,
    'Indicadores macroeconómicos: a la derecha ya están actualizados el PIB, los precios y el empleo, comparados con antes. Toca uno para ver el detalle.'
  ][n];
}

// ---------- Tipo de mercado de cada sector (competencia perfecta o monopolio) ----------
const CP = 'competencia', MO = 'monopolio';
const COMUN_CP = {
  productores: 'Son precio-aceptantes: ninguno puede subir el precio por su cuenta, porque los compradores se irían con otro. Cada uno decide solo cuánto producir, y producen hasta que el precio cubre el costo de la última unidad.',
  consumidores: 'Comparan precios con libertad y cambian de vendedor sin costo. El precio sale del cruce entre lo que todos quieren comprar y lo que todos quieren vender.',
  grafica: 'Las dos curvas son la demanda (azul) y la oferta del mercado (naranja). El equilibrio es su cruce.'
};
export const MERCADO_TIPO = {
  alimentos: { tipo: CP, quien: 'Miles de agricultores, ganaderos y tiendas.',
    rasgos: ['Muchísimos productores pequeños', 'Producto homogéneo: un kilo de arroz es igual a otro', 'Entrar y salir del negocio es fácil', 'Todos conocen el precio del mercado'] },
  energia: { tipo: MO, quien: 'Una sola empresa dueña de las plantas y de la red eléctrica.',
    rasgos: ['Un único vendedor', 'Sin sustitutos cercanos: no hay otra red a la cual conectarse', 'Barreras de entrada enormes: construir otra red cuesta demasiado (monopolio natural)', 'La empresa fija el precio; el Estado suele regularlo'],
    productores: 'La empresa no acepta el precio: lo elige. Produce menos de lo que produciría un mercado competitivo y cobra más, porque sabe que los hogares no pueden irse a otro proveedor. Por eso suele estar regulada.',
    consumidores: 'Pagan el precio que fije la empresa o reducen su consumo; no tienen a quién más comprarle. Como la energía es casi indispensable, su demanda reacciona poco al precio.',
    grafica: 'La curva naranja representa los costos de la única empresa (su costo marginal), no a muchos vendedores. El cruce muestra el precio regulado al que se le obliga a vender; un monopolio sin regulación cobraría más y vendería menos.' },
  vivienda: { tipo: CP, quien: 'Muchos propietarios, constructoras e inmobiliarias.',
    rasgos: ['Muchos oferentes y muchos inquilinos', 'Cada vivienda es parecida a otras de su zona', 'Nadie controla una parte grande del mercado', 'Los precios de arriendo son públicos'] },
  ropa: { tipo: CP, quien: 'Cientos de talleres, fábricas y tiendas.',
    rasgos: ['Muchos fabricantes y comercios', 'Productos muy parecidos entre sí', 'Entrar al negocio es barato', 'Competencia también con lo importado'] },
  tecnologia: { tipo: CP, quien: 'Muchas tiendas y distribuidores de aparatos.',
    rasgos: ['Muchos vendedores del mismo aparato', 'Precios fáciles de comparar en internet', 'Ningún vendedor fija el precio', 'Gran parte es importada'] },
  salud: { tipo: CP, quien: 'Muchas clínicas, consultorios y colegios.',
    rasgos: ['Muchos prestadores en cada ciudad', 'Servicios comparables entre sí', 'Los usuarios pueden cambiar de prestador', 'Ninguno domina el mercado'] },
  auto: { tipo: CP, quien: 'Varios concesionarios y empresas de transporte.',
    rasgos: ['Muchos vendedores y transportadores', 'Vehículos y viajes comparables', 'Se puede entrar y salir del negocio', 'Competencia con lo importado'] },
  turismo: { tipo: CP, quien: 'Miles de hoteles, restaurantes y agencias.',
    rasgos: ['Muchísimos negocios pequeños', 'Ofertas parecidas y fáciles de comparar', 'Abrir un negocio es fácil', 'Nadie fija el precio por su cuenta'] }
};
export const nombreTipo = t => t === MO ? 'Monopolio' : 'Competencia perfecta';
export function tipoDe(id) { return MERCADO_TIPO[id] || { tipo: CP, quien: 'Muchos productores y compradores.', rasgos: [] }; }
export function explicaMercado(id, nombre) {
  const m = tipoDe(id), d = { ...COMUN_CP, ...m }, mono = m.tipo === MO;
  return `<section class="indicador" style="--ac:${mono ? '#ff6b72' : '#5fd486'}">
    <div class="bloque" style="--ac:${mono ? '#ff6b72' : '#5fd486'}"><h4 class="tit"><span class="ic">${mono ? '🏛️' : '🏪'}</span>${nombre}: ${nombreTipo(m.tipo)}</h4>
      <p class="texto"><b>Quién vende:</b> ${d.quien}</p>
      <h4>Características del mercado</h4><ul class="rasgos">${d.rasgos.map(r => `<li>${r}</li>`).join('')}</ul></div>
    <div class="bloque"><h4>Cómo se comportan los productores</h4><p class="texto">${d.productores}</p></div>
    <div class="bloque"><h4>Cómo se comportan los consumidores</h4><p class="texto">${d.consumidores}</p></div>
    <div class="bloque"><h4>Cómo leer la gráfica</h4><p class="texto">${d.grafica}</p></div>
  </section>`;
}
