// Identidad del país, glosario y todos los textos que lee la pantalla.
const NOMBRES = ['Valdoria', 'Montebel', 'Sarandia', 'Tavira', 'Corinto', 'Lumbria', 'Ostrava', 'Pelagia', 'Quintaria', 'Merovia'];

export const GLOSARIO = {
  pib: 'Todo lo que el país produce y vende en un año, en dinero.',
  desempleo: 'Personas que buscan trabajo y no lo encuentran, sobre todas las que quieren trabajar.',
  inflacion: 'Cuánto subieron los precios en promedio.',
  exportaciones: 'Lo que el país le vende al resto del mundo.',
  importaciones: 'Lo que el país le compra al resto del mundo.',
  trabajo: 'Cuánto pagan las empresas y cuánta gente quiere trabajar a ese pago.',
  sensibilidad: 'Cuánto cambia lo que la gente compra cuando el precio sube 1 %.'
};

export function globito(clave) {
  const t = GLOSARIO[clave] || '';
  return `<button class="info" type="button" data-tip="${t}" aria-label="${t}">ⓘ</button>`;
}

// Número pseudoaleatorio determinista: la misma semilla da el mismo país.
const rnd = sem => { const x = Math.sin(sem * 9301 + 49297) * 233280; return x - Math.floor(x); };

export function identidad(sem = Date.now() % 100000) {
  const nombre = NOMBRES[Math.floor(rnd(sem) * NOMBRES.length)];
  const h = Math.floor(rnd(sem + 1) * 360);
  const colores = [0, 120, 240].map(o => `hsl(${(h + o) % 360} 65% 45%)`);
  const bandera = `<svg viewBox="0 0 3 2" role="img" aria-label="Bandera de ${nombre}">${colores.map((c, i) => `<rect x="${i}" width="1" height="2" fill="${c}"/>`).join('')}</svg>`;
  return { nombre, bandera, periodico: `El Diario de ${nombre}` };
}

// ---------- textos del evento ----------
const verbo = (v, mas, menos) => (v >= 0 ? mas : menos);
const pct = v => `${Math.abs(v).toFixed(1).replace('.', ',')} %`;
const porId = (e, id) => e.mercados.find(m => m.id === id);

/** Frase final en palabras de la calle, a partir del informe de aplicarEvento. */
export function resumen(inf) {
  const g = inf.evento.efectos[0];
  const id = g.mercado === 'todos' ? inf.despues.mercados[0].id : g.mercado;
  const a = porId(inf.antes, id), d = porId(inf.despues, id), nombre = d.nombre.toLowerCase();
  const dP = (d.precio / a.precio - 1) * 100, dQ = (d.cantidad / a.cantidad - 1) * 100;
  const dU = inf.despues.trabajo.desempleo - inf.antes.trabajo.desempleo;
  const causa = {
    demanda: `la gente quiere ${verbo(g.valor, 'comprar más', 'comprar menos')} de ${nombre}`,
    oferta: `producir ${nombre} ${verbo(g.valor, 'cuesta menos', 'cuesta más')}`,
    importaciones: `${verbo(g.valor, 'más', 'menos')} ${nombre} viene de afuera`,
    exportaciones: `el extranjero compra ${verbo(g.valor, 'más', 'menos')} ${nombre} del país`,
    impuesto: `${verbo(g.valor, 'sube', 'baja')} el impuesto a ${nombre}`
  }[g.tipo];
  return `En resumen: cuando ${causa}, el precio ${verbo(dP, 'sube', 'baja')} ${pct(dP)} y se vende ${verbo(dQ, 'más', 'menos')} (${pct(dQ)}). `
    + `Las empresas contratan ${verbo(-dU, 'más', 'menos')} y el desempleo ${verbo(dU, 'sube', 'baja')} ${Math.abs(dU).toFixed(1).replace('.', ',')} puntos. `
    + `Al final el PIB ${verbo(inf.despues.macro.crecimiento, 'crece', 'cae')} ${pct(inf.despues.macro.crecimiento * 100)}.`;
}

export const etiquetaNivel = ev => ev.efectos.some(e => e.mercado === 'todos') ? 'MACRO' : 'MICRO';

/** Texto de cada paso de la secuencia (1 mercado · 2 empleo · 3 ola · 4 país). d = { nombre, dP, dQ, dU }. */
export function textoPaso(n, ev, d) {
  const t = ev.efectos[0].tipo, curva = (t === 'oferta' || t === 'impuesto') ? 'naranja (vendedores)' : 'azul (compradores)';
  const f = (x, dec = 1) => Math.abs(x).toLocaleString('es', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const sube = x => x >= 0 ? 'sube' : 'baja';
  return [
    '',
    `Mercado de ${d.nombre}: la curva ${curva} se mueve (la línea gris punteada era su estado anterior). El precio ${sube(d.dP)} ${f(d.dP)} % y la cantidad ${sube(d.dQ)} ${f(d.dQ)} %.`,
    `Empleo: como se vende ${d.dQ >= 0 ? 'más' : 'menos'}, las empresas contratan ${d.dU <= 0 ? 'más' : 'menos'} y el desempleo ${d.dU <= 0 ? 'baja' : 'sube'} ${f(d.dU, 2)} puntos porcentuales. El salario mínimo sube lo mismo que los precios (desde $1000 iniciales), así que su poder de compra no cambia y la gráfica lo muestra en dólares de partida, por eso el desempleo es la distancia entre la gente que quiere trabajar a ese salario y los puestos que ofrecen las empresas. Puedes verlo en el botón "Mercado laboral".`,
    `Efecto en cadena: quien ${d.dU <= 0 ? 'gana' : 'pierde'} sueldo compra ${d.dU <= 0 ? 'más' : 'menos'}. Junto a cada mercado verás cuánto cambió su precio, y puedes tocarlo para ver su gráfica.`,
    'Indicadores macroeconómicos: a la derecha ya están actualizados el PIB, los precios y el empleo, comparados con antes. Toca uno para ver el detalle.'
  ][n];
}

// ---------- tipo de mercado de cada sector (competencia perfecta o monopolio) ----------
const CP = 'competencia', MO = 'monopolio';
const COMUN_CP = {
  consumidores: 'Comparan precios con libertad y cambian de vendedor sin costo. El precio sale del cruce entre lo que todos quieren comprar y lo que todos quieren vender, llamado precio de equilibrio.',
  productores: 'Aceptan el precio fijado: ninguno puede subir el precio por su cuenta, porque los compradores se irían con otro. Cada uno decide solo cuánto producir, y producen hasta que el precio cubre el costo de la última unidad.',
  grafica: 'Las dos curvas son la demanda (azul) y la oferta del mercado (naranja). El equilibrio es su cruce.'
};
const MERCADO_TIPO = {
  alimentos: { tipo: CP, quien: 'Agricultores, ganaderos y tiendas.',
    rasgos: ['Productores pequeños', 'Producto homogéneo: un kilo de arroz es igual a otro', 'Entrar y salir del negocio es menos complicado', 'Mayormente se conoce el precio del mercado'] },
  energia: { tipo: MO, quien: 'Una sola empresa dueña de las plantas y de la red eléctrica.',
    rasgos: ['Un único vendedor', 'Sin sustitutos cercanos ya que no hay otra red a la cual conectarse', 'Barreras de entrada enormes debido al costo de construir otra red.', 'La empresa fija el precio y el Estado suele regularlo'],
    productores: 'La empresa elige el precio de su producto. Produce menos de lo que produciría un mercado competitivo y cobra más, porque sabe que los hogares no pueden irse a otro proveedor. Por eso suele estar regulada',
    consumidores: 'Pagan el precio que fije la empresa o reducen su consumo debido no tienen a quién más comprarle. Como la energía es casi indispensable, su demanda reacciona poco al precio.',
    grafica: 'La curva naranja es el costo de producir una unidad más para la única empresa (costo marginal), no la suma de muchos vendedores. El cruce con la demanda es lo que pasaría si el Estado la obligara a cobrar lo que le cuesta producir. Pulsa «Ver monopolio sin restricciones» sobre la gráfica para ver qué haría la empresa si nadie la regulara.' },
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

const fPrecio = v => '$ ' + v.toLocaleString('es', { maximumFractionDigits: v < 100 ? 1 : 0 });
const fCant = v => new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

// k = resultado de monopolioDe (graficos.js) o null si no se pudo calcular.
function explicaMonopolio(k) {
  const num = k ? ` En tu país ahora: la empresa produciría ${fCant(k.Qm)} unidades en lugar de ${fCant(k.Qe)} y cobraría ${fPrecio(k.Pm)} en lugar de ${fPrecio(k.Pe)}.` : '';
  return `<section class="indicador" style="--ac:#c792ea">
    <div class="bloque" style="--ac:#c792ea"><h4 class="tit"><span class="ic">📈</span>El monopolio sin restricciones, paso a paso</h4>
      <ol class="pasos">
        <li><b>Demanda.</b> Dice cuánta energía compra la gente a cada precio. Para vender más, la empresa tiene que bajar el precio, y lo baja para todas las unidades, no solo para la última.</li>
        <li><b>Ingreso marginal (línea morada).</b> Es lo que la empresa gana al vender una unidad más. Siempre es menor que el precio, porque esa unidad extra obliga a abaratar todas las demás. Por eso cae el doble de rápido que la demanda.</li>
        <li><b>Costo marginal (curva naranja).</b> Es lo que le cuesta producir una unidad más.</li>
        <li><b>① Cuánto produce.</b> Mientras una unidad extra aporte más ingreso que costo, conviene producirla. La empresa se detiene donde el ingreso marginal es igual al costo marginal. Ahí está el punto 1, siempre a la izquierda del equilibrio competitivo.</li>
        <li><b>② Qué precio cobra.</b> Desde la cantidad antes fijada se sube hasta la curva de demanda y cobra lo máximo que la gente está dispuesta a pagar por ella. Es el punto ②, mucho más alto que el costo.</li>
        <li><b>Qué se pierde.</b> Con regulación se producirían más unidades a un precio menor. El triángulo rojo es el valor de las unidades que la gente querría y que costaría producir menos de lo que pagaría, pero que el monopolio no produce.</li>
      </ol>
      <p class="texto suave">Como la energía casi no tiene sustitutos, su demanda reacciona poco al precio, y por eso el monopolio puede subirlo bastante sin perder muchos clientes.${num}</p></div>
  </section>`;
}

export const nombreTipo = t => t === MO ? 'Monopolio' : 'Competencia perfecta';
export const tipoDe = id => MERCADO_TIPO[id] || { tipo: CP, quien: 'Muchos productores y compradores.', rasgos: [] };

export function explicaMercado(id, nombre, k = null) {
  const m = tipoDe(id), d = { ...COMUN_CP, ...m }, mono = m.tipo === MO, color = mono ? '#ff6b72' : '#5fd486';
  return `<section class="indicador" style="--ac:${color}">
    <div class="bloque" style="--ac:${color}"><h4 class="tit"><span class="ic">${mono ? '🏛️' : '🏪'}</span>${nombre}: ${nombreTipo(m.tipo)}</h4>
      <p class="texto"><b>Quién vende:</b> ${d.quien}</p>
      <h4>Características del mercado</h4><ul class="rasgos">${d.rasgos.map(r => `<li>${r}</li>`).join('')}</ul></div>
    <div class="bloque"><h4>Cómo se comportan los productores</h4><p class="texto">${d.productores}</p></div>
    <div class="bloque"><h4>Cómo se comportan los consumidores</h4><p class="texto">${d.consumidores}</p></div>
    <div class="bloque"><h4>Cómo leer la gráfica</h4><p class="texto">${d.grafica}</p></div>
  </section>${mono ? explicaMonopolio(k) : ''}`;
}
