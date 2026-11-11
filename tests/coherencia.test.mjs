// Pruebas de coherencia del motor y de los datos. Se corren con `npm test` (node --test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { crearEstado, aplicarEvento, sortearTamaño } from '../js/motor/eventos.js';
import { crearMercado, equilibrio } from '../js/motor/mercados.js';

const leer = async n => JSON.parse(await readFile(new URL(`../js/datos/${n}.json`, import.meta.url), 'utf8'));
const mercadosJson = await leer('mercados'), eventosJson = await leer('eventos');
const datosMercados = mercadosJson.mercados.map(m => ({
  id: m.id, nombre: m.nombre, unidad: m.unidad, peso: m.pesoPIB,
  sd: m.sensibilidadDemanda, so: m.sensibilidadOferta, P0: m.precioInicial, imp: m.porcentajeImportado
}));

const finito = (v, msg) => assert.ok(Number.isFinite(v), `${msg}: ${v}`);

test('los ids de eventos.json existen en mercados.json', () => {
  const ids = new Set(mercadosJson.mercados.map(m => m.id));
  for (const e of eventosJson.eventos) for (const g of e.efectos) {
    assert.ok(g.mercado === 'todos' || ids.has(g.mercado), `evento ${e.id} apunta a un mercado desconocido: ${g.mercado}`);
  }
  assert.equal(mercadosJson.mercados.length, 8, 'el menú permite hasta 8 mercados');
});

test('crearEstado: cifras coherentes para cada perfil y tamaño', () => {
  for (const perfil of ['emergente', 'medio', 'desarrollado']) for (const n of [4, 6, 8]) for (const datos of [null, datosMercados]) {
    const e = crearEstado(10, perfil, n, datos);
    assert.equal(e.mercados.length, n);
    assert.ok(Math.abs(e.mercados.reduce((s, m) => s + m.peso, 0) - 1) < 1e-9, 'los pesos suman 1');
    assert.ok(Math.abs(e.macro.pibNominal - 10e6 * e.pais.ingreso) < 1, 'PIB = población × ingreso');
    assert.ok(Math.abs(e.macro.crecimiento) < 1e-12 && Math.abs(e.macro.inflacion) < 1e-12, 'sin evento no hay crecimiento ni inflación');
    assert.ok(e.trabajo.desempleo > 2 && e.trabajo.desempleo < 10, 'desempleo inicial del perfil');
    assert.ok(e.trabajo.curvas.demanda.length > 2 && e.mercados[0].curvas.oferta.length > 2);
  }
});

test('aplicarEvento: todos los eventos del catálogo dejan un estado sano', () => {
  let estado = crearEstado(10, 'medio', 8, datosMercados);
  for (const ev of eventosJson.eventos) {
    const inf = aplicarEvento(estado, ev);
    const d = inf.despues;
    assert.equal(inf.antes.macro.pibNominal, estado.macro.pibNominal, 'el «antes» es el estado de entrada');
    for (const m of d.mercados) {
      assert.ok(m.precio > 0 && m.cantidad > 0, `${ev.id}: ${m.id} con precio o cantidad nulos`);
      assert.equal(m.golpes.length, 0, 'al cerrar el año no quedan golpes activos');
    }
    for (const k of ['pibNominal', 'pibReal', 'pibRealEncadenado', 'crecimiento', 'inflacion', 'exportaciones', 'importaciones']) finito(d.macro[k], `${ev.id}: macro.${k}`);
    for (const k of ['desempleo', 'ocupados', 'fuerzaLaboral', 'participacion', 'masaSalarial', 'indicePrecios']) finito(d.trabajo[k], `${ev.id}: trabajo.${k}`);
    assert.ok(d.trabajo.desempleo >= 2 && d.trabajo.desempleo <= 40);
    assert.ok(d.pais.poblacion > estado.pais.poblacion, 'la población crece cada año');
    assert.equal(d.historia.length, estado.historia.length + 1);
    assert.equal(d.pais.anio, estado.pais.anio + 1);
    estado = d;
  }
});

test('un golpe de demanda sube precio y cantidad; uno de oferta baja el precio y sube la cantidad', () => {
  const e = crearEstado(10, 'medio', 6, datosMercados);
  const dem = aplicarEvento(e, { id: 'x', titular: 'x', efectos: [{ mercado: 'alimentos', tipo: 'demanda', valor: 20 }] }).despues.mercados[0];
  assert.ok(dem.precio > e.mercados[0].precio && dem.cantidad > e.mercados[0].cantidad);
  const ofe = aplicarEvento(e, { id: 'y', titular: 'y', efectos: [{ mercado: 'alimentos', tipo: 'oferta', valor: 20 }] }).despues.mercados[0];
  assert.ok(ofe.precio < e.mercados[0].precio && ofe.cantidad > e.mercados[0].cantidad);
});

test('equilibrio: un subsidio (impuesto negativo) baja el precio y sube la cantidad', () => {
  const m = crearMercado({ id: 'a', nombre: 'A', unidad: 'u', precioInicial: 10, pesoPIB: 20, sensibilidadDemanda: -0.5, sensibilidadOferta: 0.8, porcentajeImportado: 10 }, 1e7, 2e11);
  const r = equilibrio(m, [{ mercado: 'a', tipo: 'impuesto', valor: -10 }]);
  assert.ok(r.precio < m.precioInicial && r.cantidad > m.cantidadInicial);
  assert.throws(() => equilibrio(m, [{ mercado: 'todos', tipo: 'oferta', valor: 5 }]), /todos/);
});

test('sortearTamaño respeta el rango, el signo y el tope de ±40', () => {
  for (let i = 0; i < 50; i++) {
    const [g] = sortearTamaño({ efectos: [{ mercado: 'a', tipo: 'oferta', rango: [-35, -15] }] }).efectos;
    assert.ok(g.valor >= -35 && g.valor <= -15);
  }
  assert.equal(sortearTamaño({ efectos: [{ mercado: 'a', tipo: 'demanda', valor: 90 }] }).efectos[0].valor, 40);
});
