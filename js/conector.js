// Agente 7 · Puente con los motores de los Agentes 1 a 5.
// Busca lo que cada agente entregó y usa lo que encuentre; lo que falte se cubre con los datos
// de mentira. En la consola del navegador queda un informe de qué se cargó y qué no.
const informe = { motor: [], datos: [], faltan: [] };

async function modulo(ruta) { try { return await import(ruta); } catch { return null; } }
async function json(...rutas) {               // el JSON puede estar en js/datos/ o en datos/
  for (const ruta of rutas) {
    try { const r = await fetch(ruta); if (r.ok) { const d = await r.json(); if (d) { usadas.push(ruta); return d; } } } catch { /* sigue */ }
  }
  return null;
}
const usadas = [];
// Los agentes pueden haber llamado a sus funciones de varias formas; se prueban los nombres probables.
const saca = (m, ...nombres) => { if (!m) return null; for (const n of nombres) { const f = m[n] ?? m.default?.[n]; if (typeof f === 'function') return f; } return typeof m.default === 'function' ? m.default : null; };
const lista = x => Array.isArray(x) ? x : Array.isArray(x?.eventos) ? x.eventos : Array.isArray(x?.mercados) ? x.mercados : Array.isArray(x?.paises) ? x.paises : null;

// Un dato puede venir como número o como { valor, anio, fuente }: se acepta cualquiera de los dos.
const valorDe = x => (x && typeof x === 'object' ? x.valor ?? x.value ?? x.dato : x);
const anioDe = (x, p) => (x && typeof x === 'object' ? x.anio ?? x.año ?? x.year : null) ?? p?.anio ?? p?.año ?? p?.year ?? null;
const fuenteDe = (x, p) => (x && typeof x === 'object' ? x.fuente ?? x.source : null) ?? p?.fuente ?? p?.source ?? null;
const campo = (p, ...nombres) => { for (const n of nombres) if (p?.[n] != null) return p[n]; return null; };

// Normaliza paises.json venga como venga, para que el comparador de respaldo pueda usarlo.
function normalizaPaises(crudo) {
  const arr = lista(crudo); if (!arr) return null;
  const out = arr.map(p => {
    const pib = campo(p, 'pib', 'gdp', 'pibNominal'), pp = campo(p, 'pibpersona', 'pibPorPersona', 'gdpPerCapita', 'pib_per_capita');
    const des = campo(p, 'desempleo', 'unemployment', 'paro'), cre = campo(p, 'crecimiento', 'growth'), inf = campo(p, 'inflacion', 'inflation');
    return { nombre: campo(p, 'nombre', 'name', 'pais', 'country') || '—',
      pib: valorDe(pib), pibpersona: valorDe(pp), desempleo: valorDe(des), crecimiento: valorDe(cre), inflacion: valorDe(inf),
      anio: anioDe(pib, p) || anioDe(des, p), fuente: fuenteDe(pib, p) || fuenteDe(des, p) || 'Banco Mundial' };
  }).filter(p => p.pib != null || p.pibpersona != null);
  return out.length ? out : null;
}

// Normaliza mercados.json: así, aunque el motor no esté completo, los mercados son los de verdad.
function normalizaMercados(crudo) {
  const arr = lista(crudo); if (!arr) return null;
  const out = arr.map(m => ({
    id: campo(m, 'id', 'clave', 'key'),
    nombre: campo(m, 'nombre', 'name', 'titulo') || campo(m, 'id', 'clave') || '—',
    peso: Number(valorDe(campo(m, 'peso', 'pesoPib', 'peso_pib', 'weight', 'participacion'))) || 0,
    sd: Number(valorDe(campo(m, 'sensibilidadDemanda', 'elasticidadDemanda', 'elasticidad_demanda', 'demanda', 'ed'))),
    so: Number(valorDe(campo(m, 'sensibilidadOferta', 'elasticidadOferta', 'elasticidad_oferta', 'oferta', 'eo'))),
    P0: Number(valorDe(campo(m, 'precio', 'precioInicial', 'P0', 'precio_inicial'))) || null,
    imp: Number(valorDe(campo(m, 'importaciones', 'porcentajeImportaciones', 'importado', 'pctImportado')))
  })).map(m => ({ ...m, imp: Number.isFinite(m.imp) ? (m.imp <= 1 ? m.imp * 100 : m.imp) : undefined }))
    .filter(m => m.id && Number.isFinite(m.sd) && Number.isFinite(m.so) && m.peso > 0);
  return out.length ? out : null;
}

// Los eventos del Agente 4 traen un RANGO de tamaño, no un valor fijo: se guarda el rango y
// cada simulación sortea dentro de él, como pide el manual (el signo no cambia).
function rangoDe(g) {
  const r = campo(g, 'rango', 'range', 'tamaño', 'tamano', 'magnitud');
  if (Array.isArray(r) && r.length === 2 && r.every(Number.isFinite)) return [Math.min(...r), Math.max(...r)];
  if (r && typeof r === 'object') { const a = Number(r.min ?? r.desde ?? r[0]), b = Number(r.max ?? r.hasta ?? r[1]);
    if (Number.isFinite(a) && Number.isFinite(b)) return [Math.min(a, b), Math.max(a, b)]; }
  const a = Number(campo(g, 'min', 'valorMin', 'valor_min', 'desde')), b = Number(campo(g, 'max', 'valorMax', 'valor_max', 'hasta'));
  if (Number.isFinite(a) && Number.isFinite(b)) return [Math.min(a, b), Math.max(a, b)];
  return null;
}
function normalizaEventos(crudo, deModulo) {
  const arr = lista(crudo) || (Array.isArray(deModulo) ? deModulo : null); if (!arr) return null;
  const out = [];
  for (const [i, e] of arr.entries()) {
    const crudos = campo(e, 'efectos', 'golpes', 'shocks', 'efecto') ?? [];
    const efectos = (Array.isArray(crudos) ? crudos : [crudos]).map(g => {
      const mercado = campo(g, 'mercado', 'mercadoId', 'market', 'id');
      const tipo = campo(g, 'tipo', 'type');
      const valor = Number(campo(g, 'valor', 'value'));
      const rango = rangoDe(g);
      if (!mercado || !tipo || (!Number.isFinite(valor) && !rango)) return null;
      return rango ? { mercado, tipo, rango } : { mercado, tipo, valor };
    }).filter(Boolean);
    if (!efectos.length) continue;
    out.push({ id: campo(e, 'id', 'clave', 'key') || 'ev' + i, categoria: campo(e, 'categoria', 'category') || 'otros',
      titular: campo(e, 'titular', 'titulo', 'headline', 'title') || 'Sucede algo en el país',
      explicacion: campo(e, 'explicacion', 'explicación', 'descripcion', 'detalle') || '', efectos });
  }
  if (out.length < arr.length) console.warn(`MiniPaís · ${arr.length - out.length} evento(s) del catálogo no se pudieron leer y quedaron fuera.`);
  return out.length ? out : null;
}

export async function conectar() {
  const [evMod, mkMod, trMod, maMod, cmMod] = await Promise.all(
    ['./motor/eventos.js', './motor/mercados.js', './motor/trabajo.js', './motor/macro.js', './motor/comparador.js'].map(modulo));
  [['eventos', evMod], ['mercados', mkMod], ['trabajo', trMod], ['macro', maMod], ['comparador', cmMod]]
    .forEach(([n, m]) => (m ? informe.motor : informe.faltan).push('motor/' + n + '.js'));

  const [evJson, mkJson, paJson] = await Promise.all([
    json('./js/datos/eventos.json', './datos/eventos.json', 'js/datos/eventos.json'),
    json('./js/datos/mercados.json', './datos/mercados.json', 'js/datos/mercados.json'),
    json('./js/datos/paises.json', './datos/paises.json', 'js/datos/paises.json')]);
  [['eventos', evJson], ['mercados', mkJson], ['paises', paJson]]
    .forEach(([n, d]) => (d ? informe.datos : informe.faltan).push('datos/' + n + '.json'));

  const aplicarEvento = saca(evMod, 'aplicarEvento', 'aplicar', 'simular');
  const nuevo = saca(evMod, 'nuevo', 'crearEstado', 'estadoInicial', 'crearPais')
    || saca(maMod, 'nuevo', 'crearEstado', 'estadoInicial', 'crearPais')
    || saca(mkMod, 'crearEstado', 'estadoInicial', 'nuevo');
  const eventos = normalizaEventos(evJson, evMod?.EVENTOS || evMod?.catalogo);
  const comparador = saca(cmMod, 'compararPais', 'comparar', 'comparador', 'compara');
  const calcularMacro = saca(maMod, 'calcularMacro'), calcularOla = saca(maMod, 'calcularOla');
  const paises = normalizaPaises(paJson), mercados = normalizaMercados(mkJson);

  console.groupCollapsed('MiniPaís · motores conectados');
  console.log('Cargado:', [...informe.motor, ...informe.datos].join(', ') || 'nada todavía');
  console.log('Rutas de datos que respondieron:', usadas.join(', ') || 'ninguna');
  console.log('No encontrado (se usan los datos de prueba):', informe.faltan.join(', ') || 'nada');
  console.log('Funciones halladas:', { aplicarEvento: !!aplicarEvento, nuevo: !!nuevo, eventos: eventos?.length || 0, comparador: !!comparador, paises: paises?.length || 0, mercados: mercados?.length || 0, calcularMacro: !!calcularMacro });
  console.groupEnd();

  return { aplicarEvento, nuevo, eventos, comparador, calcularMacro, calcularOla, paises, paisesCrudo: paJson, mercados, informe };
}
