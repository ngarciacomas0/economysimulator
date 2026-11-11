// Carga los JSON de js/datos/. Si uno falta o está mal, devuelve null y el motor usa su respaldo.
const TIPOS = ['demanda', 'oferta', 'importaciones', 'exportaciones', 'impuesto'];

async function json(nombre) {
  try {
    const r = await fetch(new URL(`./datos/${nombre}.json`, import.meta.url));
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

const golpeValido = g => g && typeof g.mercado === 'string' && TIPOS.includes(g.tipo)
  && (Number.isFinite(g.valor) || (Array.isArray(g.rango) && g.rango.length === 2 && g.rango.every(Number.isFinite)));

const eventoValido = e => e?.id && e.titular && Array.isArray(e.efectos) && e.efectos.length > 0 && e.efectos.every(golpeValido);

const mercadoValido = m => m?.id && m.nombre && m.precioInicial > 0 && m.pesoPIB > 0
  && m.sensibilidadDemanda < 0 && m.sensibilidadOferta > 0;

export async function cargarDatos() {
  const [ev, mk, paises] = await Promise.all(['eventos', 'mercados', 'paises'].map(json));

  const eventos = (ev?.eventos || []).filter(eventoValido);
  if (ev && eventos.length < (ev.eventos?.length || 0)) console.warn(`MiniPaís · ${ev.eventos.length - eventos.length} evento(s) del catálogo no se pudieron leer.`);

  // Al formato compacto que usa el motor: { id, nombre, unidad, peso, sd, so, P0, imp }.
  const mercados = (mk?.mercados || []).filter(mercadoValido).map(m => ({
    id: m.id, nombre: m.nombre, unidad: m.unidad, peso: m.pesoPIB,
    sd: m.sensibilidadDemanda, so: m.sensibilidadOferta, P0: m.precioInicial, imp: m.porcentajeImportado
  }));

  return { eventos: eventos.length ? eventos : null, mercados: mercados.length ? mercados : null, paises };
}
