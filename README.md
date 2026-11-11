# MiniPaís

Simulador económico educativo en una sola pantalla. Al pulsar «Simular evento» aparece una noticia
y se ve cómo el golpe recorre un mercado, el empleo, los demás mercados y los indicadores del país.

## Cómo se arranca

Necesita un servidor porque usa módulos ES (abrir `index.html` con doble clic no funciona):

```bash
npm install
npm start            # http://127.0.0.1:3000
```

O cualquier servidor estático en la raíz, por ejemplo `python3 -m http.server 3000`.

Para activar el botón «Evento con IA», copia `.env.example` a `.env` y pon tu `DEEPSEEK_API_KEY`.
Sin clave, el servidor sirve eventos del catálogo.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Sirve la página y la API (`servidor/server.js`). |
| `npm test` | Pruebas de coherencia del motor y de los datos. |
| `npm run actualizar-datos` | Descarga del Banco Mundial los datos de `js/datos/paises.json`. |

## Estructura

```
index.html                 Página única
css/estilos.css            Estilos (claro/oscuro, móvil, modo presentación)
js/main.js                 Director de la pantalla: estado, secuencia del evento, botones
js/carga.js                Lee los JSON de js/datos/
js/motor/eventos.js        Director del cálculo: crearEstado, aplicarEvento
js/motor/mercados.js       Oferta y demanda lineales, equilibrio, curvas
js/motor/trabajo.js        Mercado laboral
js/motor/macro.js          PIB, inflación, comercio exterior
js/ui/graficos.js          Gráficas (Chart.js 4)
js/ui/kpis.js              Tarjetas de indicadores y panel de detalle
js/ui/comparar.js          Comparación con países reales
js/ui/narrativa.js         Nombre y bandera del país, glosario, textos
js/datos/eventos.json      Catálogo de eventos (cada efecto trae un rango)
js/datos/mercados.json     Mercados calibrados (los ids deben coincidir con eventos.json)
js/datos/paises.json       Datos del Banco Mundial (generado)
servidor/server.js         Express: sirve la página y pide eventos a la IA
scripts/actualizar_datos.js
tests/coherencia.test.mjs
```

## Orden del cálculo (cada evento = 1 año)

1. Demografía: la población crece y la participación laboral se desvía un poco de su tendencia.
2. Mercado golpeado: los efectos del evento desplazan la demanda o la oferta y se resuelve el equilibrio.
3. Empleo: las empresas contratan según el PIB real; el salario mínimo es rígido, así que el desempleo
   es la distancia entre quienes quieren trabajar y los puestos que hay.
4. Ola: parte del salario ganado o perdido se gasta en los demás mercados (hasta 3 rondas).
5. País: PIB nominal y real, inflación, exportaciones e importaciones.
