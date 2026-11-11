/**
 * MiniPaís · Descarga del Banco Mundial los datos de js/datos/paises.json.
 * Requiere Node 18 o superior; no necesita clave. Se corre con `npm run actualizar-datos`.
 */
const fs = require('node:fs/promises');
const path = require('node:path');

const API_BASE = 'https://api.worldbank.org/v2';
const ANIO_INICIAL = 1960;
const ANIO_FINAL = new Date().getFullYear() - 1;
const ARCHIVO_SALIDA = path.join(__dirname, '../js/datos/paises.json');

const FUENTE = { nombre: 'Banco Mundial', baseDatos: 'World Development Indicators', codigo: 'WDI', url: API_BASE, licencia: 'CC BY 4.0' };

const PAISES = [
  { codigo: 'COL', nombre: 'Colombia', ingreso: 'medio alto' },
  { codigo: 'BRA', nombre: 'Brasil', ingreso: 'medio alto' },
  { codigo: 'MEX', nombre: 'México', ingreso: 'medio alto' },
  { codigo: 'ARG', nombre: 'Argentina', ingreso: 'medio alto' },
  { codigo: 'CHL', nombre: 'Chile', ingreso: 'alto' },
  { codigo: 'USA', nombre: 'Estados Unidos', ingreso: 'alto' },
  { codigo: 'DEU', nombre: 'Alemania', ingreso: 'alto' },
  { codigo: 'JPN', nombre: 'Japón', ingreso: 'alto' },
  { codigo: 'GBR', nombre: 'Reino Unido', ingreso: 'alto' },
  { codigo: 'KOR', nombre: 'Corea del Sur', ingreso: 'alto' },
  { codigo: 'CHN', nombre: 'China', ingreso: 'medio alto' },
  { codigo: 'IND', nombre: 'India', ingreso: 'medio bajo' },
  { codigo: 'IDN', nombre: 'Indonesia', ingreso: 'medio alto' },
  { codigo: 'VNM', nombre: 'Vietnam', ingreso: 'medio bajo' },
  { codigo: 'EGY', nombre: 'Egipto', ingreso: 'medio bajo' },
  { codigo: 'NGA', nombre: 'Nigeria', ingreso: 'medio bajo' },
  { codigo: 'ZAF', nombre: 'Sudáfrica', ingreso: 'medio alto' },
  { codigo: 'ETH', nombre: 'Etiopía', ingreso: 'bajo' },
  { codigo: 'BGD', nombre: 'Bangladés', ingreso: 'medio bajo' },
  { codigo: 'CHE', nombre: 'Suiza', ingreso: 'alto' }
];

// Clave interna → indicador del Banco Mundial. Las claves las usa js/ui/comparar.js.
const INDICADORES = {
  pibNominal:           { codigo: 'NY.GDP.MKTP.CD', nombre: 'PIB nominal', unidad: 'USD' },
  pibReal:              { codigo: 'NY.GDP.MKTP.KD', nombre: 'PIB real', unidad: 'USD constantes' },
  pibPerCapita:         { codigo: 'NY.GDP.PCAP.CD', nombre: 'PIB por habitante', unidad: 'USD por persona' },
  poblacion:            { codigo: 'SP.POP.TOTL', nombre: 'Población total', unidad: 'personas' },
  desempleo:            { codigo: 'SL.UEM.TOTL.ZS', nombre: 'Desempleo total', unidad: '%' },
  participacionLaboral: { codigo: 'SL.TLF.CACT.ZS', nombre: 'Participación laboral', unidad: '%' },
  inflacion:            { codigo: 'FP.CPI.TOTL.ZG', nombre: 'Inflación', unidad: '%' },
  exportaciones:        { codigo: 'NE.EXP.GNFS.ZS', nombre: 'Exportaciones de bienes y servicios', unidad: '% del PIB' },
  importaciones:        { codigo: 'NE.IMP.GNFS.ZS', nombre: 'Importaciones de bienes y servicios', unidad: '% del PIB' },
  inversion:            { codigo: 'NE.GDI.TOTL.ZS', nombre: 'Formación bruta de capital', unidad: '% del PIB' },
  rentaTrabajador:      { codigo: 'SL.GDP.PCAP.EM.KD', nombre: 'PIB por persona empleada', unidad: 'USD PPA constantes' },
  crecimientoReal:      { codigo: 'NY.GDP.MKTP.KD.ZG', nombre: 'Crecimiento del PIB real', unidad: '%' }
};

/** Pide todos los indicadores de un país en una sola consulta. */
async function consultarPais(pais) {
  const codigos = Object.values(INDICADORES).map(i => i.codigo).join(';');
  const parametros = new URLSearchParams({ format: 'json', per_page: '20000', date: `${ANIO_INICIAL}:${ANIO_FINAL}`, source: '2' });
  console.log(`Descargando ${pais.nombre}...`);
  const respuesta = await fetch(`${API_BASE}/country/${pais.codigo}/indicator/${codigos}?${parametros}`);
  if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status} al consultar ${pais.nombre}`);
  const resultado = await respuesta.json();
  if (!Array.isArray(resultado) || !Array.isArray(resultado[1])) {
    throw new Error(`Respuesta inesperada de la API para ${pais.nombre}: ${JSON.stringify(resultado[0] || resultado)}`);
  }
  return resultado[1];
}

/** Agrupa las observaciones por indicador, ordenadas por año. */
function organizarDatos(pais, observaciones) {
  const indicadores = {};
  for (const [clave, ind] of Object.entries(INDICADORES)) {
    indicadores[clave] = {
      nombre: ind.nombre, codigo: ind.codigo, unidad: ind.unidad, fuente: FUENTE.nombre,
      observaciones: observaciones
        .filter(d => d.indicator.id === ind.codigo && d.value !== null)
        .map(d => ({ anio: Number(d.date), valor: d.value, fuente: FUENTE.nombre, codigoIndicador: ind.codigo }))
        .sort((a, b) => a.anio - b.anio)
    };
  }
  return { codigo: pais.codigo, nombre: pais.nombre, grupoIngreso: pais.ingreso, fuente: FUENTE, indicadores };
}

async function actualizarDatos() {
  console.log('\n=== Actualizando MiniPaís ===\n');
  const paises = [];
  for (const pais of PAISES) {
    // Si un país falla, se aborta: no se genera un archivo incompleto.
    const datos = organizarDatos(pais, await consultarPais(pais));
    const n = Object.values(datos.indicadores).reduce((t, i) => t + i.observaciones.length, 0);
    console.log(`✓ ${pais.nombre}: ${n} observaciones`);
    paises.push(datos);
  }

  const archivo = {
    metadata: {
      proyecto: 'MiniPaís', ultimaActualizacion: new Date().toISOString(),
      anioInicial: ANIO_INICIAL, anioFinal: ANIO_FINAL,
      cantidadPaises: paises.length, cantidadIndicadores: Object.keys(INDICADORES).length, fuente: FUENTE
    },
    paises,
    crisisHistoricas: []
  };

  // Se escribe en un temporal y se reemplaza solo al terminar bien.
  await fs.mkdir(path.dirname(ARCHIVO_SALIDA), { recursive: true });
  const temporal = ARCHIVO_SALIDA + '.tmp';
  await fs.writeFile(temporal, JSON.stringify(archivo, null, 2), 'utf8');
  await fs.rename(temporal, ARCHIVO_SALIDA);
  console.log(`\n=== Listo: ${paises.length} países, ${Object.keys(INDICADORES).length} indicadores → ${ARCHIVO_SALIDA}\n`);
}

actualizarDatos().catch(error => {
  console.error('\nERROR EN LA ACTUALIZACIÓN:', error.message);
  process.exitCode = 1;
});
