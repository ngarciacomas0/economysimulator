# MiniPaís
Simulador económico con fines educativos con un dashboard interactivo Al pulsar "Simular evento" aparece una noticia
y se ve cómo el evento afecta todos los mercados, el mercado laboral y los indicadores del país.

## ¿Cómo se arranca?
Necesita un servidor Node.js al utilizar módulos. Se carga el proyecto en un entorno tipo Visual Studio Code, se abre
la terminal, y se ejecutan los siguientes comandos:
```bash
npm install
npm start            # http://127.0.0.1:3000
```
Funciona también cualquier servidor estático en la raíz, por ejemplo `python3 -m http.server 3000`.

Se puede activar un botón de «Evento con IA», en el que se conecta la IA para generar eventos aleatorios.
Se copia `.env.example` a `.env` y pones tu  `DEEPSEEK_API_KEY` (funciona solo con modelos de Deepseek)

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Sirve la página y la API (`servidor/server.js`). |
| `npm test` | Pruebas de coherencia del motor y de los datos. |
| `npm run actualizar-datos` | Descarga del Banco Mundial los datos de `js/datos/paises.json`. |

## Estructura

```
index.html                 Página única para iniciar el proyecto
css/estilos.css            Estilo gráfico de la web (claro/oscuro, móvil, modo presentación)
js/main.js                 Direcciona la pantalla: estado, secuencia del evento, botones
js/carga.js                Lee los datos almacenados
js/motor/eventos.js        Direcciona el cálculo de el efecto de los eventos
js/motor/mercados.js       Calcula las fórmulas de oferta y demanda lineales, equilibrio, curvas
js/motor/trabajo.js        Calcula el mercado laboral 
js/motor/macro.js          Calcula el PIB, inflación, comercio exterior
js/ui/graficos.js          Crea las gráficas con Chart.js 4 
js/ui/kpis.js              Crea las tarjetas de indicadores y paneles de detalles
js/ui/comparar.js          Compara los niveles con países reales
js/ui/narrativa.js         Crea el nombre y bandera del país, glosario, textos
js/datos/eventos.json      Almacena el catálogo de eventos 
js/datos/mercados.json     Almacena mercados calibrados 
js/datos/paises.json       Almacena los datos del Banco Mundial 
servidor/server.js         Sirve la página y pide eventos a la IA
scripts/actualizar_datos.js
tests/coherencia.test.mjs
```

## Orden del cálculo (cada evento equivale a un año)

1. Demografía: la población crece y la participación laboral se desvía un poco de su tendencia.
2. Mercado golpeado: los efectos del evento desplazan la demanda o la oferta y se resuelve el equilibrio.
3. Empleo: las empresas contratan según el PIB real; el salario mínimo es rígido, así que el desempleo
   es la distancia entre quienes quieren trabajar y los puestos que hay.
4. Ola: parte del salario ganado o perdido se gasta en los demás mercados (hasta 3 rondas).
5. País: PIB nominal y real, inflación, exportaciones e importaciones.
