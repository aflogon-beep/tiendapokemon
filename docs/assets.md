# Assets de Kenney: inventario

Inventario generado leyendo la cabecera JSON de cada `.glb` (nodos, mallas, esqueletos, animaciones y caja envolvente de los vértices). Los tamaños están en **unidades del pack, sin escalar** y son aproximados (no aplican las transformaciones de los nodos hijos). El origen está en el suelo (`y = 0`).

## Packs

| Pack | Carpeta | Modelos | Notas |
|---|---|---|---|
| Mini Market | `public/assets/kenney/market/` | 20 | Rejilla de **1 unidad**: `floor` es 1 × 1 y las paredes miden 1 de alto. |
| Mini Characters | `public/assets/kenney/characters/` | 26 | 12 personajes animados + ayudas y sillas de ruedas. |
| City Kit Commercial | `public/assets/kenney/city/` | 41 | Edificios, rascacielos, toldos, sombrillas y versiones *low-detail*. |

- Cada pack usa una textura atlas externa `Textures/colormap.png`, así que basta con un material por pack. Las de Mini Market y Mini Characters son **idénticas** (misma serie).
- Los dos packs "Mini" se subieron cruzados (cada uno en la carpeta del otro); se reorganizaron en un commit aparte.
- Los tres `License.txt` están **vacíos**: hay que pegar el texto CC0 que trae cada zip de Kenney.

## Escala (unidades del pack → metros)

Definida en `src/world/assets.ts` (`PACK_SCALE`):

| Pack | Factor | Resultado |
|---|---|---|
| Mini Market | ×2,4 | baldosa de 2,4 m, paredes de 2,4 m, estantería de ~1,9 m |
| Mini Characters | ×2,4 | personajes de 1,6–1,9 m (con pelo); misma serie que Mini Market, mismo factor |
| City Kit Commercial | ×7,5 | planta de 0,4 unidades → ~3 m |

Validada por Alberto en la F1.

### Distribución de la tienda (F2)

`LAY` de la v10 se pasa a metros con una escala única, **100 px = 1 baldosa = 2,4 m** (`src/world/shop.ts`). Con ella el interior mide 8 × 5 baldosas exactas (x 0–800, y 48–548) y en cada hueco de estantería de `LAY` (150 px) caben dos módulos de Mini Market (2 × 80 px). Se descartó la escala de 1,5 cm/px del plan porque las estanterías de Mini Market (0,7 unidades de fondo, 1,7 m) no cabían entre las dos filas.

Las paredes de Mini Market tienen 0,6 unidades de grosor: su cara interior se alinea con los bordes de `LAY`.

## Animaciones

### Personajes (Mini Characters y `character-employee` de Mini Market)

Los 13 personajes (`character-female-a…f`, `character-male-a…f` y `character-employee`) comparten esqueleto (`root`, `leg-left`, `leg-right`, `torso`, `arm-left`, `arm-right`, `head`) y las **mismas 32 animaciones**:

| Grupo | Animaciones |
|---|---|
| Básicas | `static`, `idle`, `walk` (0,67 s), `sprint` (0,5 s), `jump`, `fall`, `crouch`, `sit`, `drive`, `die` |
| Interacción | `pick-up`, `interact-right`, `interact-left`, `emote-yes`, `emote-no` |
| Sujetar | `holding-right`, `holding-left`, `holding-both`, `holding-right-shoot`, `holding-left-shoot`, `holding-both-shoot` |
| Ataque | `attack-melee-right`, `attack-melee-left`, `attack-kick-right`, `attack-kick-left` |
| Silla de ruedas | `wheelchair-sit`, `wheelchair-look-left`, `wheelchair-look-right`, `wheelchair-move-forward`, `wheelchair-move-back`, `wheelchair-move-left`, `wheelchair-move-right` |

Las útiles para el juego: `walk` (andar), `idle` (esperar en cola), `pick-up` (coger un sobre), `interact-right` (pagar / mirar la vitrina), `holding-both` (salir con la compra), `emote-yes` / `emote-no` (regateo) y `sit` (torneo).

El ancho de la caja envolvente (~0,77) es la pose en T con los brazos abiertos; el cuerpo mide unas 0,3 de ancho.

### Puertas (Mini Market)

`wall-door-rotate` y `fence-door-rotate`: `open`, `close`, `open-and-close`.

## Lo que no traen los packs (decidido con Alberto)

- **Mostrador largo**: se juntan piezas de Mini Market: una `cash-register` y dos `freezer` (vitrinas bajas) en línea. La registradora queda donde la dibuja la v10 (`c.y + 76`), frente al primero de la cola.
- **Vitrina de cartas**: geometría propia (`src/world/props.ts`), igual que la mesa de sellado y la mesa del fondo.
- Cartas, sobres, cajas, TPV, slabs y peanas: geometría propia, como dice `CLAUDE.md`.

## Modelos

### Mini Market (`market/`) — 20 modelos

| Modelo | Tamaño (ancho × alto × fondo, unidades del pack) | Animaciones |
|---|---|---|
| `bottle-return` | 0.45 × 1.093 × 0.481 | — |
| `cash-register` | 0.85 × 0.595 × 0.85 | — |
| `character-employee` | 0.781 × 0.723 × 0.401 | esqueleto, 32 animaciones |
| `column` | 0.726 × 1 × 0.726 | — |
| `display-bread` | 0.7 × 0.5 × 0.6 | — |
| `display-fruit` | 0.6 × 0.516 × 0.6 | — |
| `fence-door-rotate` | 1 × 0.429 × 0.15 | `open`, `close`, `open-and-close` |
| `fence` | 0.575 × 0.379 × 0.15 | — |
| `floor` | 1 × 0.025 × 1 | — |
| `freezer` | 0.8 × 0.35 × 0.6 | — |
| `freezers-standing` | 1 × 0.9 × 0.5 | — |
| `shelf-bags` | 0.8 × 0.8 × 0.7 | — |
| `shelf-boxes` | 0.8 × 0.8 × 0.7 | — |
| `shelf-end` | 0.8 × 0.8 × 0.478 | — |
| `shopping-basket` | 0.35 × 0.25 × 0.35 | — |
| `shopping-cart` | 0.3 × 0.391 × 0.479 | — |
| `wall-corner` | 0.8 × 1 × 0.8 | — |
| `wall-door-rotate` | 1.5 × 1 × 1.1 | `open`, `close`, `open-and-close` |
| `wall-window` | 1 × 1 × 0.6 | — |
| `wall` | 1 × 1 × 0.6 | — |

### Mini Characters (`characters/`) — 26 modelos

| Modelo | Tamaño (ancho × alto × fondo, unidades del pack) | Animaciones |
|---|---|---|
| `aid-cane-blind` | 0.096 × 0.31 × 0.096 | — |
| `aid-cane-low-vision` | 0.096 × 0.31 × 0.096 | — |
| `aid-cane` | 0.096 × 0.315 × 0.23 | — |
| `aid-crutch` | 0.196 × 0.31 × 0.187 | — |
| `aid-defibrillator-green` | 0.225 × 0.29 × 0.13 | — |
| `aid-defibrillator-red` | 0.225 × 0.29 × 0.13 | — |
| `aid-glasses` | 0.33 × 0.096 × 0.184 | — |
| `aid-mask` | 0.336 × 0.203 × 0.21 | — |
| `aid-sunglasses` | 0.33 × 0.096 × 0.184 | — |
| `aid_hearing` | 0.05 × 0.124 × 0.157 | — |
| `character-female-a` | 1.099 × 0.776 × 0.5 | esqueleto, 32 animaciones |
| `character-female-b` | 0.767 × 0.723 × 0.419 | esqueleto, 32 animaciones |
| `character-female-c` | 0.767 × 0.776 × 0.5 | esqueleto, 32 animaciones |
| `character-female-d` | 0.767 × 0.776 × 0.5 | esqueleto, 32 animaciones |
| `character-female-e` | 0.767 × 0.716 × 0.527 | esqueleto, 32 animaciones |
| `character-female-f` | 0.767 × 0.671 × 0.441 | esqueleto, 32 animaciones |
| `character-male-a` | 0.767 × 0.671 × 0.34 | esqueleto, 32 animaciones |
| `character-male-b` | 0.767 × 0.661 × 0.389 | esqueleto, 32 animaciones |
| `character-male-c` | 0.767 × 0.793 × 0.461 | esqueleto, 32 animaciones |
| `character-male-d` | 0.767 × 0.722 × 0.34 | esqueleto, 32 animaciones |
| `character-male-e` | 0.767 × 0.676 × 0.342 | esqueleto, 32 animaciones |
| `character-male-f` | 0.767 × 0.671 × 0.34 | esqueleto, 32 animaciones |
| `wheelchair-deluxe` | 0.579 × 0.495 × 0.592 | — |
| `wheelchair-power-deluxe` | 0.48 × 0.625 × 0.511 | — |
| `wheelchair-power` | 0.48 × 0.572 × 0.511 | — |
| `wheelchair` | 0.5 × 0.495 × 0.582 | — |

### City Kit Commercial (`city/`) — 41 modelos

| Modelo | Tamaño (ancho × alto × fondo, unidades del pack) | Animaciones |
|---|---|---|
| `building-a` | 0.884 × 1.293 × 0.94 | — |
| `building-b` | 0.97 × 1.293 × 0.94 | — |
| `building-c` | 0.884 × 0.893 × 1.09 | — |
| `building-d` | 0.84 × 1.293 × 0.9 | — |
| `building-e` | 1.64 × 0.893 × 1.008 | — |
| `building-f` | 0.84 × 1.693 × 1.03 | — |
| `building-g` | 0.97 × 1.693 × 0.922 | — |
| `building-h` | 0.884 × 1.293 × 1.008 | — |
| `building-i` | 1.24 × 1.68 × 1.302 | — |
| `building-j` | 2.084 × 1.693 × 1.34 | — |
| `building-k` | 2.084 × 1.47 × 0.942 | — |
| `building-l` | 1.37 × 2.27 × 1.402 | — |
| `building-m` | 1.24 × 3.15 × 1.242 | — |
| `building-n` | 2.32 × 2.48 × 1.82 | — |
| `building-skyscraper-a` | 1.36 × 2.88 × 1.36 | — |
| `building-skyscraper-b` | 1.36 × 4.48 × 1.36 | — |
| `building-skyscraper-c` | 1.28 × 4.08 × 1.388 | — |
| `building-skyscraper-d` | 1.28 × 5.47 × 1.388 | — |
| `building-skyscraper-e` | 1.295 × 4.08 × 1.242 | — |
| `detail-awning-wide` | 0.8 × 0.4 × 0.148 | — |
| `detail-awning` | 0.4 × 0.4 × 0.148 | — |
| `detail-overhang-wide` | 1 × 0.4 × 0.2 | — |
| `detail-overhang` | 0.5 × 0.4 × 0.2 | — |
| `detail-parasol-a` | 0.346 × 0.45 × 0.4 | — |
| `detail-parasol-b` | 0.346 × 0.45 × 0.4 | — |
| `low-detail-building-a` | 0.5 × 2 × 0.5 | — |
| `low-detail-building-b` | 0.5 × 2.225 × 0.5 | — |
| `low-detail-building-c` | 0.5 × 2.25 × 0.5 | — |
| `low-detail-building-d` | 0.5 × 1.75 × 0.5 | — |
| `low-detail-building-e` | 0.5 × 1.8 × 0.5 | — |
| `low-detail-building-f` | 0.5 × 2 × 0.5 | — |
| `low-detail-building-g` | 0.5 × 2 × 0.5 | — |
| `low-detail-building-h` | 0.5 × 2.1 × 0.5 | — |
| `low-detail-building-i` | 0.5 × 1.775 × 0.5 | — |
| `low-detail-building-j` | 0.5 × 1.75 × 0.5 | — |
| `low-detail-building-k` | 0.5 × 1.55 × 0.5 | — |
| `low-detail-building-l` | 0.5 × 1.85 × 0.5 | — |
| `low-detail-building-m` | 0.5 × 1.975 × 0.5 | — |
| `low-detail-building-n` | 0.5 × 0.7 × 0.5 | — |
| `low-detail-building-wide-a` | 1 × 1.1 × 0.5 | — |
| `low-detail-building-wide-b` | 1 × 1.15 × 0.5 | — |
