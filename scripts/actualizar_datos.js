/**
 * MiniPaís
 * Actualización de datos económicos del Banco Mundial.
 *
 * Archivo: scripts/actualizar_datos.js
 * Salida:  js/datos/paises.json
 *
 * Requisitos:
 * - Node.js 18 o superior.
 * - No requiere API key.
 */

const fs = require("node:fs/promises");
const path = require("node:path");

// --------------------------------------------------
// 1. CONFIGURACIÓN
// --------------------------------------------------

const API_BASE = "https://api.worldbank.org/v2";

const ANIO_INICIAL = 1960;
const ANIO_FINAL = new Date().getFullYear() - 1;

const ARCHIVO_SALIDA = path.join(
    __dirname,
    "../js/datos/paises.json"
);

const FUENTE = {
    nombre: "Banco Mundial",
    baseDatos: "World Development Indicators",
    codigo: "WDI",
    url: "https://api.worldbank.org/v2",
    licencia: "CC BY 4.0"
};

// --------------------------------------------------
// 2. LOS 20 PAÍSES
// --------------------------------------------------

const PAISES = [
    { codigo: "COL", nombre: "Colombia", ingreso: "medio alto" },
    { codigo: "BRA", nombre: "Brasil", ingreso: "medio alto" },
    { codigo: "MEX", nombre: "México", ingreso: "medio alto" },
    { codigo: "ARG", nombre: "Argentina", ingreso: "medio alto" },
    { codigo: "CHL", nombre: "Chile", ingreso: "alto" },

    { codigo: "USA", nombre: "Estados Unidos", ingreso: "alto" },
    { codigo: "DEU", nombre: "Alemania", ingreso: "alto" },
    { codigo: "JPN", nombre: "Japón", ingreso: "alto" },
    { codigo: "GBR", nombre: "Reino Unido", ingreso: "alto" },
    { codigo: "KOR", nombre: "Corea del Sur", ingreso: "alto" },

    { codigo: "CHN", nombre: "China", ingreso: "medio alto" },
    { codigo: "IND", nombre: "India", ingreso: "medio bajo" },
    { codigo: "IDN", nombre: "Indonesia", ingreso: "medio alto" },
    { codigo: "VNM", nombre: "Vietnam", ingreso: "medio bajo" },
    { codigo: "EGY", nombre: "Egipto", ingreso: "medio bajo" },

    { codigo: "NGA", nombre: "Nigeria", ingreso: "medio bajo" },
    { codigo: "ZAF", nombre: "Sudáfrica", ingreso: "medio alto" },
    { codigo: "ETH", nombre: "Etiopía", ingreso: "bajo" },
    { codigo: "BGD", nombre: "Bangladés", ingreso: "medio bajo" },
    { codigo: "CHE", nombre: "Suiza", ingreso: "alto" }
];

// --------------------------------------------------
// 3. INDICADORES ECONÓMICOS
// --------------------------------------------------

const INDICADORES = {
    pibNominal: {
        codigo: "NY.GDP.MKTP.CD",
        nombre: "PIB nominal",
        unidad: "USD"
    },

    pibReal: {
        codigo: "NY.GDP.MKTP.KD",
        nombre: "PIB real",
        unidad: "USD constantes"
    },

    pibPerCapita: {
        codigo: "NY.GDP.PCAP.CD",
        nombre: "PIB por habitante",
        unidad: "USD por persona"
    },

    poblacion: {
        codigo: "SP.POP.TOTL",
        nombre: "Población total",
        unidad: "personas"
    },

    desempleo: {
        codigo: "SL.UEM.TOTL.ZS",
        nombre: "Desempleo total",
        unidad: "%"
    },

    participacionLaboral: {
        codigo: "SL.TLF.CACT.ZS",
        nombre: "Participación laboral",
        unidad: "%"
    },

    inflacion: {
        codigo: "FP.CPI.TOTL.ZG",
        nombre: "Inflación",
        unidad: "%"
    },

    exportaciones: {
        codigo: "NE.EXP.GNFS.ZS",
        nombre: "Exportaciones de bienes y servicios",
        unidad: "% del PIB"
    },

    importaciones: {
        codigo: "NE.IMP.GNFS.ZS",
        nombre: "Importaciones de bienes y servicios",
        unidad: "% del PIB"
    },

    inversion: {
        codigo: "NE.GDI.TOTL.ZS",
        nombre: "Formación bruta de capital",
        unidad: "% del PIB"
    },

    rentaTrabajador: {
        codigo: "SL.GDP.PCAP.EM.KD",
        nombre: "PIB por persona empleada",
        unidad: "USD PPA constantes"
    },

    crecimientoReal: {
        codigo: "NY.GDP.MKTP.KD.ZG",
        nombre: "Crecimiento del PIB real",
        unidad: "%"
    }
};

// --------------------------------------------------
// 4. CONSULTAR LA API
// --------------------------------------------------

async function consultarPais(pais) {

    const codigos = Object.values(INDICADORES)
        .map(indicador => indicador.codigo)
        .join(";");

    const parametros = new URLSearchParams({
        format: "json",
        per_page: "20000",
        date: `${ANIO_INICIAL}:${ANIO_FINAL}`,
        source: "2"
    });

    const url =
        `${API_BASE}/country/${pais.codigo}/indicator/${codigos}?${parametros}`;

    console.log(`Descargando ${pais.nombre}...`);

    const respuesta = await fetch(url);

    if (!respuesta.ok) {
        throw new Error(
            `Error HTTP ${respuesta.status} al consultar ${pais.nombre}`
        );
    }

    const resultado = await respuesta.json();

    if (!Array.isArray(resultado) || !Array.isArray(resultado[1])) {
        throw new Error(
            `Respuesta inesperada de la API para ${pais.nombre}: ${
                JSON.stringify(resultado[0] || resultado)
            }`
        );
    }

    return resultado[1];
}

// --------------------------------------------------
// 5. ORGANIZAR LOS DATOS
// --------------------------------------------------

function organizarDatos(pais, observaciones) {

    const resultado = {
        codigo: pais.codigo,
        nombre: pais.nombre,
        grupoIngreso: pais.ingreso,
        fuente: FUENTE,
        indicadores: {}
    };

    for (const [clave, indicador] of Object.entries(INDICADORES)) {

        const datosIndicador = observaciones
            .filter(dato =>
                dato.indicator.id === indicador.codigo &&
                dato.value !== null
            )
            .map(dato => ({
                anio: Number(dato.date),
                valor: dato.value,
                fuente: FUENTE.nombre,
                codigoIndicador: indicador.codigo
            }))
            .sort((a, b) => a.anio - b.anio);

        resultado.indicadores[clave] = {
            nombre: indicador.nombre,
            codigo: indicador.codigo,
            unidad: indicador.unidad,
            fuente: FUENTE.nombre,
            observaciones: datosIndicador
        };
    }

    return resultado;
}

// --------------------------------------------------
// 6. ACTUALIZACIÓN COMPLETA
// --------------------------------------------------

async function actualizarDatos() {

    console.log("\n=================================");
    console.log("      ACTUALIZANDO MINIPAÍS");
    console.log("=================================\n");

    const datosPaises = [];

    for (const pais of PAISES) {

        try {

            const observaciones = await consultarPais(pais);

            const datosOrganizados = organizarDatos(
                pais,
                observaciones
            );

            datosPaises.push(datosOrganizados);

            const cantidad = Object.values(
                datosOrganizados.indicadores
            ).reduce(
                (total, indicador) =>
                    total + indicador.observaciones.length,
                0
            );

            console.log(
                `✓ ${pais.nombre}: ${cantidad} observaciones`
            );

        } catch (error) {

            console.error(
                `✗ Error con ${pais.nombre}:`,
                error.message
            );

            // No se genera un archivo incompleto.
            throw error;
        }
    }

    // --------------------------------------------------
    // 7. ARCHIVO FINAL
    // --------------------------------------------------

    const archivoFinal = {

        metadata: {
            proyecto: "MiniPaís",
            ultimaActualizacion: new Date().toISOString(),
            anioInicial: ANIO_INICIAL,
            anioFinal: ANIO_FINAL,
            cantidadPaises: datosPaises.length,
            cantidadIndicadores: Object.keys(INDICADORES).length,
            fuente: FUENTE
        },

        paises: datosPaises,

        crisisHistoricas: []
    };

    await fs.mkdir(
        path.dirname(ARCHIVO_SALIDA),
        { recursive: true }
    );

    const temporal = ARCHIVO_SALIDA + ".tmp";

    await fs.writeFile(
        temporal,
        JSON.stringify(archivoFinal, null, 2),
        "utf8"
    );

    // Reemplazo solo después de terminar correctamente.
    await fs.rename(temporal, ARCHIVO_SALIDA);

    console.log("\n=================================");
    console.log(" ACTUALIZACIÓN COMPLETADA");
    console.log("=================================");
    console.log(`Países: ${datosPaises.length}`);
    console.log(`Indicadores: ${Object.keys(INDICADORES).length}`);
    console.log(`Archivo: ${ARCHIVO_SALIDA}\n`);
}

// --------------------------------------------------
// 8. EJECUCIÓN
// --------------------------------------------------

actualizarDatos().catch(error => {

    console.error("\nERROR EN LA ACTUALIZACIÓN:");
    console.error(error.message);

    process.exitCode = 1;

});