# Pokémon Card Shop 3D

Juego de gestión de una tienda de cartas Pokémon con **cartas y precios reales** (Cardmarket vía pokemontcg.io), en 3D con los packs de Kenney. Es un proyecto personal: se juega sobre todo en un **móvil Android (Xiaomi)**, así que todo se diseña *mobile-first*.

## Fuente de verdad

- `reference/pokemon-card-shop-v10.html` es la versión anterior, completa y jugable (un único HTML con canvas 2D). **Toda la lógica del juego, las reglas, los textos y las pantallas salen de ahí.** Al portar algo, léelo primero en ese archivo y respeta su comportamiento. No inventes reglas nuevas sin preguntar.
- Si algo del archivo de referencia parece un error, avisa antes de cambiarlo.

## Stack

- **Vite + TypeScript** (modo `strict`).
- **Three.js** para el mundo 3D: `GLTFLoader`, `AnimationMixer`, cámara ortográfica isométrica.
- **Interfaz en HTML/CSS + TypeScript sin framework**, superpuesta al canvas. Se reaprovecha el HTML/CSS de la v10 (HUD, barra inferior, paneles, caja, apertura de sobres, álbum, ticket, tutorial).
- **Vitest** para tests de la lógica (economía, clientes, gradeo, etc.).
- Publicación en **GitHub Pages** con GitHub Actions. Más adelante: PWA (`vite-plugin-pwa`) y, opcional, una función en Vercel que haga de caché de precios.

## Assets (Kenney, licencia CC0)

| Pack | Uso | Carpeta |
|---|---|---|
| Mini Market | Interior de la tienda: suelo, paredes, estanterías, mostrador, caja… | `public/assets/kenney/market/` |
| City Kit Commercial | Calle y edificios vecinos | `public/assets/kenney/city/` |
| Mini Characters | Clientes, dependiente, peatones (con animaciones) | `public/assets/kenney/characters/` |

- Usar el formato **GLB** de cada pack. Conservar el `License.txt` de cada uno y mencionar a Kenney en una pantalla de créditos.
- Mini Market y Mini Characters son de la misma serie. **City Kit Commercial es de otra serie y puede tener otra escala**: hay que normalizarla en `src/world/assets.ts` (factor de escala por pack) para que todo encaje.
- Lo que no traen los packs se hace con geometría propia sencilla, imitando el estilo low-poly de Kenney:
  - **Cartas**: planos finos con la imagen real de la API como textura (cara) y un dorso común.
  - **Sobres**: cajitas finas con el color y el símbolo del set.
  - **Cajas de 36, ETB, latas, colecciones**: cajas con color del set.
  - **TPV, slabs de gradeo (PGS), peanas de lujo**: piezas simples.
- Unidades: **1 unidad Three.js = 1 metro**. El factor de escala de cada pack se fija en la Fase 1 y no se toca después sin motivo.

## Estructura

```
src/
  main.ts
  core/        state.ts (estado, guardado, migraciones), loop.ts, rng.ts
  data/        cards.ts (pokemontcg.io, IndexedDB, reintentos, rarezas), sets.ts
  systems/     economy, customers, checkout, haggle, products, grading, fakes,
               lots, orders, missions, achievements, regulars, events, seasons
  world/       scene.ts, camera.ts, lighting.ts, assets.ts, shop.ts, city.ts,
               characters.ts, cards3d.ts, effects.ts
  ui/          hud.ts, nav.ts, modals/*, packOpening.ts, binder.ts, checkout.ts,
               tutorial.ts, styles/*
public/assets/kenney/…
reference/pokemon-card-shop-v10.html
tests/
```

- `systems/` **no importa Three.js**: es lógica pura y testeable. `world/` solo dibuja a partir del estado.
- El estado es un único objeto serializable (como `S` en la v10).

## Datos de cartas (portar tal cual desde la v10)

- API: `https://api.pokemontcg.io/v2/` (`sets` y `cards?q=set.id:…`, con paginación de 250).
- Caché en **IndexedDB** (18 h de frescura), **3 reintentos** con espera, carga **de 3 en 3**, y si falla usar la última copia guardada. Lista de colecciones fallidas con botón «Reintentar».
- Mapa de rarezas `RMAP` + función `rarOf()` para rarezas desconocidas (no descartar cartas).
- Probabilidades de sobre según la época del set (WOTC / 2003–2022 / Escarlata y Púrpura), como en la v10.
- **Nunca** pasar al modo sin conexión si existe una partida real guardada: avisar y ofrecer reintentar.

## Guardado (crítico: no perder partidas)

- Clave versionada en localStorage. Migraciones explícitas entre versiones.
- Debe poder **importar el JSON exportado desde la v10**: `{app:"pcs", v:5, mode:"real", date, S}`. El objeto `S` de la v10 es el formato de la partida; mantener sus campos y nombres.
- Exportar/importar archivo y código, guardado automático cada 10 s, al cerrar y al terminar el día.

## Mundo 3D

- Cámara **ortográfica isométrica** con tres modos, como en la v10: automática (sigue la caja cuando hay cola), tienda entera y calle. Pellizcar para zoom y arrastrar para mover; rotación limitada opcional.
- La distribución de la tienda sale de `LAY` en la v10 (coordenadas en px, unos 800×556 de tienda): convertir a metros con una escala única definida en `world/shop.ts`.
- Clientes: andan desde la acera hasta la puerta, siguen *waypoints* dentro de la tienda, hacen cola en la caja y se van calle abajo. Animaciones de andar y reposo de Mini Characters.
- Día/noche con luz direccional (sol) + luces puntuales (techo, focos de vitrina, farolas). Sombras solo del sol y con resolución moderada.

## Rendimiento (móvil)

- Objetivo: **60 fps en el Xiaomi**, mínimo aceptable 30.
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- Reutilizar geometrías y materiales; instanciar elementos repetidos (sobres, cartas en estanterías, árboles).
- Texturas de cartas: cargar bajo demanda y limitar la caché.

## Convenciones

- Toda la interfaz y los textos en **español**.
- Código en inglés (nombres de variables y funciones); comentarios breves en español.
- Funciones pequeñas, módulos con una responsabilidad.
- Accesibilidad básica: botones grandes para el dedo, contraste suficiente, respetar `prefers-reduced-motion`.
- Red: solo `api.pokemontcg.io`, `images.pokemontcg.io` y Google Fonts.

## Fases (no avanzar sin que Alberto valide la anterior)

**F0 · Base.** Vite + TS + Three.js funcionando, despliegue automático a GitHub Pages y una escena vacía con suelo y cámara isométrica. *Hecho cuando:* la URL carga en el móvil.

**F1 · Prueba de assets.** Antes de programar nada más:
1. Inspeccionar los GLB de los tres packs y **listar modelos y animaciones disponibles** (guardar la lista en `docs/assets.md`).
2. Escena de prueba con: un tramo de suelo y pared + una estantería + el mostrador (Mini Market), un edificio de la calle (City Kit) y un personaje andando en bucle (Mini Characters).
3. Ajustar los factores de escala para que encajen.
*Hecho cuando:* Alberto ve la captura y confirma que la escala y la animación están bien, y va fluido en el móvil.

**F2 · Tienda y cámara.** Montar la tienda completa con las piezas de Mini Market según `LAY`, la acera y la fachada. Modos de cámara y gestos.

**F3 · Lógica.** Portar estado, guardado, importación desde la v10, carga de cartas y el bucle de día (abrir, clientes, cola, cierre) con los personajes moviéndose. Tests de `systems/`.

**F4 · Interfaz.** Portar HUD, barra inferior y paneles: Stock (sobres, sellado, accesorios), Cartas, Álbum, Tareas, Más; caja con efectivo y TPV, regateo, lotes, gradeo, examen de falsificaciones, apertura de sobres y cajas, ticket del día y tutorial.

**F5 · Vida y efectos.** Calle con coches y peatones, día/noche, temporadas, eventos (lanzamiento con cola, torneo, lluvia), gato, partículas (monedas, corazones, estrellas), cartas 3D en vitrina y peanas.

**F6 · App.** PWA instalable y caché de precios opcional en Vercel.

## Forma de trabajar

- Antes de cada fase: plan breve y lista de archivos que vas a tocar.
- Commits pequeños con mensajes claros en español.
- Al terminar cada fase: resumen de lo hecho, cómo probarlo y capturas si es visual.
- Si algo del plan no encaja con lo que traen los packs, **pregunta antes de improvisar**.
