/**
 * MiniPaís
 * Agente 1: Economista de mercados (micro)
 *
 * Archivo: js/motor/mercados.js
 *
 * Motor microeconómico de oferta y demanda.
 * No requiere dependencias externas.
 */

// --------------------------------------------------
// 1. CONSTANTES
// --------------------------------------------------

const POBLACION_BASE = 10_000_000;

const TIPOS_VALIDOS = new Set([
    "demanda",
    "oferta",
    "importaciones",
    "exportaciones",
    "impuesto"
]);

// --------------------------------------------------
// 2. CREAR MERCADO
// --------------------------------------------------

/**
 * Crea un mercado a partir de su configuración.
 *
 * @param {Object} config Configuración del mercado.
 * @param {number} poblacion Población del país.
 * @param {number|null} pibInicial PIB inicial opcional.
 * @returns {Object} Mercado con sus parámetros.
 */

export function crearMercado(
    config,
    poblacion = POBLACION_BASE,
    pibInicial = null
) {

    validarConfig(config);

    if (!Number.isFinite(poblacion) || poblacion <= 0) {
        throw new Error("La población debe ser positiva.");
    }

    if (
        pibInicial !== null &&
        (!Number.isFinite(pibInicial) || pibInicial <= 0)
    ) {
        throw new Error("El PIB inicial debe ser positivo.");
    }

    const P0 = config.precioInicial;

    // La cantidad crece proporcionalmente con la población.
    const Q0 = pibInicial === null
        ? config.cantidadInicial * (poblacion / POBLACION_BASE)
        : (pibInicial * config.pesoPIB / 100) / P0;

    // Parámetros de las funciones lineales.
    // Demanda: Q = a - bP
    // Oferta:  Q = c + dP

    const b = Math.abs(config.sensibilidadDemanda) * Q0 / P0;

    const a = Q0 + b * P0;

    const d = config.sensibilidadOferta * Q0 / P0;

    const c = Q0 - d * P0;

    return {

        id: config.id,

        nombre: config.nombre,

        unidad: config.unidad,

        pesoPIB: config.pesoPIB,

        porcentajeImportado: config.porcentajeImportado,

        sensibilidadDemanda: config.sensibilidadDemanda,

        sensibilidadOferta: config.sensibilidadOferta,

        precioInicial: P0,

        cantidadInicial: Q0,

        a,
        b,
        c,
        d

    };

}


// --------------------------------------------------
// 3. CALCULAR EQUILIBRIO
// --------------------------------------------------

/**
 * Calcula el nuevo precio y cantidad de equilibrio.
 *
 * @param {Object} mercado Mercado creado previamente.
 * @param {Array} golpes Lista de efectos del evento.
 * @returns {Object} Resultado económico del mercado.
 */

export function equilibrio(mercado, golpes = []) {

    validarMercado(mercado);

    const efectos = resumirGolpes(mercado, golpes);

    // Los golpes se expresan como fracciones.
    // Ejemplo: 10 % = 0.10.

    const D = limitar(efectos.demanda, -0.40, 0.40);

    const S = limitar(efectos.oferta, -0.40, 0.40);

    const P0 = mercado.precioInicial;

    const Q0 = mercado.cantidadInicial;

    // Fórmula establecida en el manual.

    const precioCalculado =
        (
            mercado.a -
            mercado.c +
            (D - S) * Q0
        ) /
        (
            mercado.b +
            mercado.d
        );

    // La cantidad sigue la fórmula explícita del manual.

    const cantidadCalculada =
        mercado.c +
        mercado.d * precioCalculado;

    // Protección contra valores negativos.

    const precio = Math.max(0, precioCalculado);

    const cantidad = Math.max(0, cantidadCalculada);

    // Variaciones porcentuales.

    const cambioPrecio =
        ((precio - P0) / P0) * 100;

    const cambioCantidad =
        ((cantidad - Q0) / Q0) * 100;

    // Ingreso total del mercado.

    const ingreso = precio * cantidad;

    return {

        id: mercado.id,

        nombre: mercado.nombre,

        precio,

        cantidad,

        ingreso,

        cambioPrecio,

        cambioCantidad,

        unidad: mercado.unidad,

        golpesAplicados: {
            demanda: D,
            oferta: S
        },

        ganadoresPerdedores: fraseGanadores(cambioPrecio)

    };

}


// --------------------------------------------------
// 4. GENERAR CURVAS DE OFERTA Y DEMANDA
// --------------------------------------------------

/**
 * Genera los puntos necesarios para representar
 * las curvas antes y después del evento.
 *
 * El eje X representa la cantidad.
 * El eje Y representa el precio.
 *
 * @param {Object} mercado Mercado.
 * @param {Array} golpes Golpes del evento.
 * @param {number} numeroPuntos Cantidad de puntos.
 * @returns {Object} Coordenadas de las curvas.
 */

export function curvas(
    mercado,
    golpes = [],
    numeroPuntos = 21
) {

    validarMercado(mercado);

    if (!Number.isInteger(numeroPuntos) || numeroPuntos < 2) {
        throw new Error(
            "Se necesitan al menos dos puntos para dibujar las curvas."
        );
    }

    const efectos = resumirGolpes(mercado, golpes);

    const D = limitar(efectos.demanda, -0.40, 0.40);

    const S = limitar(efectos.oferta, -0.40, 0.40);

    const paso =
        (2 * mercado.precioInicial) / (numeroPuntos - 1);

    function construirCurvas(
        desplazamientoDemanda,
        desplazamientoOferta
    ) {

        const demanda = [];

        const oferta = [];

        for (let i = 0; i < numeroPuntos; i++) {

            const precio = i * paso;

            // Función de demanda desplazada.

            const cantidadDemanda = Math.max(
                0,
                mercado.a +
                desplazamientoDemanda * mercado.cantidadInicial -
                mercado.b * precio
            );

            // Función de oferta desplazada.

            const cantidadOferta = Math.max(
                0,
                mercado.c +
                desplazamientoOferta * mercado.cantidadInicial +
                mercado.d * precio
            );

            demanda.push({

                cantidad: cantidadDemanda,

                precio

            });

            oferta.push({

                cantidad: cantidadOferta,

                precio

            });

        }

        return {
            demanda,
            oferta
        };

    }

    return {

        antes: construirCurvas(0, 0),

        despues: construirCurvas(D, S)

    };

}


// --------------------------------------------------
// 5. PROCESAR LOS GOLPES DE UN EVENTO
// --------------------------------------------------

/**
 * Convierte los efectos del evento en desplazamientos
 * de demanda y oferta.
 *
 * Valores recibidos en porcentaje.
 *
 * Ejemplo:
 * { mercado: "alimentos", tipo: "demanda", valor: 10 }
 */

function resumirGolpes(mercado, golpes) {

    if (!Array.isArray(golpes)) {

        throw new Error("Los golpes deben ser una lista.");

    }

    let demanda = 0;

    let oferta = 0;

    for (const golpe of golpes) {

        if (
            !golpe ||
            !TIPOS_VALIDOS.has(golpe.tipo)
        ) {

            throw new Error(
                `Tipo de golpe inválido: ${golpe?.tipo}`
            );

        }

        if (!Number.isFinite(golpe.valor)) {

            throw new Error(
                "El valor del golpe debe ser numérico."
            );

        }

        const aplica =
            golpe.mercado === mercado.id ||
            golpe.mercado === "todos";

        if (!aplica) continue;

        // El mercado "todos" tiene restricciones.

        if (
            golpe.mercado === "todos" &&
            !["demanda", "exportaciones"].includes(golpe.tipo)
        ) {

            throw new Error(
                'El mercado "todos" solo admite demanda y exportaciones.'
            );

        }

        switch (golpe.tipo) {

            case "demanda":

                demanda += limitar(
                    golpe.valor,
                    -40,
                    40
                ) / 100;

                break;

            case "oferta":

                oferta += limitar(
                    golpe.valor,
                    -40,
                    40
                ) / 100;

                break;

            case "importaciones":

                // Las importaciones sustituyen producción nacional.

                demanda -= limitar(
                    golpe.valor,
                    -20,
                    20
                ) / 100;

                break;

            case "exportaciones":

                // Las exportaciones aumentan la demanda nacional.

                demanda += limitar(
                    golpe.valor,
                    -40,
                    40
                ) / 100;

                break;

            case "impuesto":

                // Un impuesto reduce la oferta.
                // Un subsidio (valor negativo) la aumenta.

                oferta -= (
                    limitar(
                        golpe.valor,
                        -20,
                        20
                    ) / 100
                ) * mercado.sensibilidadOferta;

                break;

        }

    }

    return {
        demanda,
        oferta
    };

}


// --------------------------------------------------
// 6. VALIDACIONES
// --------------------------------------------------

function validarConfig(config) {

    if (!config || typeof config !== "object") {

        throw new Error(
            "La configuración del mercado no es válida."
        );

    }

    const requeridos = [

        "id",
        "nombre",
        "unidad",
        "precioInicial",
        "cantidadInicial",
        "pesoPIB",
        "sensibilidadDemanda",
        "sensibilidadOferta",
        "porcentajeImportado"

    ];

    for (const campo of requeridos) {

        if (!(campo in config)) {

            throw new Error(
                `Falta el campo ${campo}.`
            );

        }

    }

    if (
        !Number.isFinite(config.precioInicial) ||
        !Number.isFinite(config.cantidadInicial) ||
        config.precioInicial <= 0 ||
        config.cantidadInicial <= 0
    ) {

        throw new Error(
            "El precio y la cantidad inicial deben ser positivos."
        );

    }

    if (
        config.sensibilidadDemanda >= 0 ||
        config.sensibilidadOferta <= 0
    ) {

        throw new Error(
            "Las sensibilidades tienen signos incorrectos."
        );

    }

}


function validarMercado(mercado) {

    if (
        !mercado ||
        !Number.isFinite(mercado.a) ||
        !Number.isFinite(mercado.b) ||
        !Number.isFinite(mercado.c) ||
        !Number.isFinite(mercado.d) ||
        mercado.b + mercado.d <= 0
    ) {

        throw new Error(
            "Mercado inválido. Usa crearMercado() primero."
        );

    }

}


// --------------------------------------------------
// 7. FUNCIONES AUXILIARES
// --------------------------------------------------

function limitar(valor, minimo, maximo) {

    return Math.min(
        maximo,
        Math.max(minimo, valor)
    );

}


function fraseGanadores(cambioPrecio) {

    if (cambioPrecio > 0.000001) {

        return (
            "Ganan los productores y pierden los compradores."
        );

    }

    if (cambioPrecio < -0.000001) {

        return (
            "Ganan los compradores y pierden los productores."
        );

    }

    return (
        "El precio casi no cambia; no hay un ganador claro."
    );

}