# MiniPaís — estado del proyecto (Agentes 6 y 7)

Pega este archivo al abrir un chat nuevo, junto con el manual del proyecto.

## Qué es
Simulador económico educativo en una sola pantalla. Al pulsar «Simular evento» aparece una
noticia y se ve cómo el golpe recorre un mercado, el empleo, los demás mercados y el país.

## Cómo se arranca
Necesita un servidor, porque usa módulos ES: `npm start` (Agente 5) o `python3 -m http.server 3000`.
Abrir `index.html` con doble clic no funciona. Tras cada cambio, recargar con Ctrl+Shift+R.

## Archivos y quién los hizo
```
index.html                 Agente 7
css/estilos.css            Agente 6
js/main.js                 Agente 7   secuencia, estado de pantalla, motor de respaldo
js/conector.js             Agente 7   busca los módulos y los JSON de los demás agentes
js/ui/graficos.js          Agente 7   todas las gráficas (Chart.js 4 desde jsDelivr)
js/ui/kpis.js              Agente 7   tarjetas de indicadores y panel lateral
js/ui/narrativa.js         Agente 6   nombre y bandera del país, glosario, textos
js/motor/mercados.js       Agente 1
js/motor/trabajo.js        Agente 2
js/motor/macro.js          Agente 3
js/motor/comparador.js     Agente 3
js/motor/eventos.js        lo escribió el Agente 7 porque faltaba; une a los demás
js/datos/*.json            Agentes 3 y 4 (eventos, mercados, paises)
```

## Cómo está armada la pantalla
- Barra superior: bandera y nombre del país, titular de la última noticia (se puede volver a abrir),
  «Simular evento», «Reiniciar», rueda ⚙ (población, perfil, número de mercados, modo guiado)
  y 💬 con el resumen del evento. «Evento con IA» solo aparece si `GET /api/estado` responde `{ia:true}`.
- Izquierda: una sola gráfica grande. Debajo, las fichas de los mercados y, al final, 👷 Mercado laboral,
  que se dibuja en la misma gráfica.
- Derecha: siete indicadores que reparten la altura, con minigráfica de su historia al fondo.
  Al tocarlos se abre un panel lateral desde la derecha.
- La noticia sale en un pop-up con forma de recorte de periódico.

## Animación de cada mercado (tres tiempos)
1. Telón oscuro con el emoji y el nombre del sector.
2. Se ve el estado **antes** con su punto de equilibrio (1,25 s).
3. La curva golpeada se traslada sola; el punto desaparece y queda el rastro punteado,
   que se destapa pasando de transparente a gris. Si el evento mueve las dos curvas,
   primero viaja la demanda y después la oferta.
4. Al final quedan el rastro, los dos puntos de equilibrio, las guías a los ejes y las fichas.
Vale igual para los mercados que solo reciben el efecto en cadena y para el mercado laboral.

## Decisiones que conviene no deshacer
- Los ejes se calculan con el antes y el después juntos, y hacen zoom sobre el cambio
  (mínimo 1,2 %), si no un movimiento del 0,3 % sería invisible.
- Chart.js no anima la primera pintada: si no, las líneas «suben desde abajo» al cambiar de mercado.
- Verde cuando la noticia es buena para el país, rojo cuando es mala. En Importaciones no se pinta
  color, porque subir no es ni bueno ni malo.
- El atributo `hidden` lleva `display:none!important`, porque `.modal` y `.panel` lo pisaban.

## Errores encontrados en el trabajo de otros agentes
1. **mercados.js (Agente 1):** calcula la cantidad con `Q = c + d·P` y omite el desplazamiento de
   la oferta. Un subsidio bajaba el precio **y** la cantidad. Está parcheado dentro de `eventos.js`
   tomando la `S` de `golpesAplicados`, pero conviene corregirlo en el archivo y en el manual,
   que arrastra la misma fórmula incompleta. Lo correcto es `Q = c + S·Q₀ + d·P`.
2. **comparador.js (Agente 3) no encaja con su propio `actualizar_datos.js`.** Espera que
   `pais.indicadores[clave]` sea un array, pero el generador escribe
   `{nombre, codigo, unidad, fuente, observaciones:[...]}`, y además usa otros nombres de clave
   (`pibPorPersona` por `pibPerCapita`, `participacion` por `participacionLaboral`,
   `crecimiento` por `crecimientoReal`). Devolvía todo nulo y por eso no salía ninguna comparación.
   Está sustituido por `js/ui/comparar.js`, que lee la estructura real.
3. **El crecimiento comparaba bases de precios distintas.** `pibRealAnterior` recibía el PIB real
   del periodo anterior, medido con otros precios. Ahora recibe el PIB nominal de antes, que usa
   los mismos precios que el PIB real de ahora. Antes salían crecimientos con el signo cambiado.
4. **Cada evento partía del estado original**, así que el evento anterior se deshacía y se movían
   las dos curvas. Ahora, al terminar cada evento, cada mercado se reancla en su nuevo equilibrio
   conservando las pendientes, y en el siguiente solo se mueve la curva golpeada.
5. **Eventos con rango:** `datos/eventos.json` guarda el tamaño como rango, no como valor.
   El conector lo sortea en cada simulación. Leer `valor` directamente devuelve `NaN`.

## Comparación con el mundo real
`js/ui/comparar.js` lee `datos/paises.json` (20 países, 1960–2024, Banco Mundial) y para cada
indicador busca dos cosas: el país cuyo último dato se parece más, y el año concreto de cualquier
país cuya cifra se parece más. Así el panel dice, por ejemplo, «una caída así tuvo Colombia en 2020
(−7,2 %)». El tamaño se compara en proporción (distancia logarítmica) y las tasas en diferencia simple.
Exportaciones e importaciones se comparan como % del PIB, que es como las guarda el Banco Mundial.

## Qué falta
- Las pruebas `tests/` (Agente 8) y poner la clave de la IA en el servidor.
- `crisisHistoricas` está vacío en `actualizar_datos.js`; de momento la comparación histórica
  se saca de las propias series anuales, que para el caso funciona igual o mejor.

## Comprobaciones que ya pasan (correr con node)
- Equilibrio del manual: demanda +10 % → precio +7,7 % y cantidad +6,2 %.
- Los seis signos: demanda, oferta e impuesto, en los dos sentidos.
- PIB inicial 200 mil millones · per cápita × población = PIB · composición del gasto = 100 %.
- Okun: razón 0,48, es decir PIB real −2 % → desempleo +0,96 puntos.
- Mil eventos seguidos sin errores, sin precios ni cantidades negativos.
- Eventos encadenados: tras cada uno, el mercado se reancla en su nuevo equilibrio, así que
  en el siguiente **solo se mueve la curva golpeada**.
