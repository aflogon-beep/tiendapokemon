# Fase I · Intro, pantalla de título, partidas e historia

Se hace **después de la R4**. Aquí **sí hay cambios de comportamiento**: son funciones nuevas. La regla de la R0–R3 ("no cambiar nada") no aplica a lo nuevo, pero lo que ya existe tiene que seguir funcionando igual y todos los tests anteriores deben seguir en verde.

## Archivos de referencia (en `docs/intro/`)

- `INTRO.md`: este documento (flujo y reglas).
- `HISTORIA.md`: guion de la historia, el tutorial con Emma y las frases recurrentes.
- `personajes.html`: código de dibujo de Emma, Álvaro y papá Alberto (`CHARS`, `drawPortrait`, `drawMini` y 6 expresiones). Se porta a `src/render/characters.js` tal cual; se puede limpiar, pero los personajes deben verse igual.
- `public/icons/`: icono de la app ya hecho (ver el apartado Icono).

## Flujo al abrir la app

```
Abrir app
  └─ 1. Pantalla de carga (mientras se descargan las cartas)
       └─ 2. Pantalla de título
            ├─ Continuar ─────────────► juego (última partida usada)
            ├─ Nueva partida ─► 3. Elegir ranura ─► 4. Prepara tu aventura ─► 5. Historia ─► 6. Tutorial con Emma ─► juego
            ├─ Cargar partida ─► lista de ranuras + importar archivo o código ─► juego
            └─ Ajustes rápidos (sonido, música, texto grande)
```

Desde el juego: **Más → Volver al título** (guarda antes de salir).

### 1. Pantalla de carga

- Fondo con el color de la tienda, el **logo** (icono + nombre del juego) y unos **sobres girando con brillo**.
- **Barra de progreso real** conectada a la carga de colecciones que ya existe ("Cargando colecciones 2/9 · Evolving Skies…").
- **Frases divertidas** que rotan cada 2 segundos: "Contando sobres…", "Despertando a Gengar…", "Emma revisa las cuentas…", "Papá está en el gimnasio…", "Álvaro se ha caído otra vez…", "Puliendo la vitrina…".
- Si todo carga en menos de 1,5 segundos, se muestra igualmente ese tiempo mínimo para que no sea un parpadeo.
- Si falla la API, se mantiene el comportamiento actual (aviso y reintentar, nunca perder la partida).

### 2. Pantalla de título

- Detrás, **la calle animada** (peatones, coches) desenfocada u oscurecida; encima, el logo grande.
- **Continuar**: solo si existe alguna partida. Muestra una ficha con nombre de la tienda, día, dinero y dificultad de la última partida usada.
- **Nueva partida**, **Cargar partida** y un botón pequeño de ajustes rápidos.
- Música suave si la música está activada.

### 3. Ranuras de partida

- **3 ranuras**. Cada una muestra: nombre de la tienda, día, dinero, dificultad y fecha de último guardado; o "Vacía".
- **Migración obligatoria**: la partida que ya existe (clave actual de localStorage) pasa a ser la **ranura 1**, sin perder nada. Hay que añadir un test para esto.
- Nueva partida en una ranura ocupada pide confirmación: "¿Sobrescribir la tienda X?".
- Cargar partida permite además **importar** (archivo JSON o código, como en Más → Partida).
- Borrar una ranura, con confirmación.

### 4. Prepara tu aventura

Una sola pantalla, sencilla y con botones grandes:
- **Dificultad**: Fácil ("Recomendado para peques"), Normal y Difícil, con la descripción que ya existe.
- **Mascota**: gato, perro, conejo o ninguna (afecta al chiste de la escena 3).
- Botón **«¡Empezar!»**.

El protagonista es **Álvaro**. Su ropa, la mascota y el nombre de la tienda se pueden cambiar después en Más → Personalizar.

### 5. Historia

- Guion completo en `HISTORIA.md` (8 escenas).
- **Sistema de escenas guiado por datos** (`src/story/script.js`): cada paso tiene plano (general o primer plano), cámara, personajes con su expresión, acción o efecto y texto.
- **Planos generales**: se usa el render existente de la tienda y la calle, con la cámara moviéndose.
- **Primeros planos**: retratos grandes de `drawPortrait`, con **bandas de cine** negras arriba y abajo.
- **Bocadillo** con el nombre del personaje y efecto máquina de escribir: el primer toque completa la frase y el segundo pasa a la siguiente.
- **Botón Saltar** siempre visible. Al saltar o terminar: `S.storySeen = true`.
- **Escena 7**: campo para escribir el nombre de la tienda con 3 sugerencias (Gengar Cards, Aitana Cards, Poké Cards); se guarda en `S.shopName` y se pinta en el cartel.
- Más → **Ver la historia** para repetirla (sin volver a pedir el nombre).
- Debe ir fluida en el móvil (Xiaomi) y respetar "menos animaciones".

### 6. Tutorial con Emma

- **Carla pasa a ser Emma** en todo el juego: tutorial, consejos, explicaciones de secciones e historia de capítulos. Su retrato es el de `drawPortrait(emma)`.
- Textos del tutorial: los de `HISTORIA.md` → "Emma en el tutorial". Mismos pasos y mismas comprobaciones que el tutorial actual; solo cambian textos y retrato.
- Frases recurrentes y **visitas de papá**: en `HISTORIA.md` → "Frases para el resto del juego". Papá aparece como mucho una vez cada 3 días de juego, o al subir de nivel o cuando abre la tienda rival; entra, da su consejo en un bocadillo y se va.

## Icono

En `public/icons/` ya están hechos:
- `icon-192.png`, `icon-512.png`: icono normal.
- `icon-maskable-512.png`: versión para Android (el dibujo queda dentro de la zona segura).
- `apple-touch-icon.png` (180×180).
- `favicon.svg`.

Usarlos en el `manifest` de la PWA (R4) y en el `<head>` (favicon y apple-touch-icon). `theme_color`: `#f2b705`. `background_color`: `#1b1f2a`.

## Tests nuevos

1. Primera apertura sin partidas → carga → título solo con "Nueva partida".
2. Migración: con una partida antigua guardada, aparece en la ranura 1 con los mismos datos.
3. Nueva partida → prepara tu aventura → historia (saltando) → tutorial con Emma → juego.
4. Historia completa tocando hasta el final: se pide el nombre y aparece en el cartel.
5. Continuar carga la última ranura usada; Cargar permite elegir otra.
6. Los tests anteriores siguen pasando (deben saltar el título y la historia automáticamente).

## Orden de trabajo

1. Ranuras de partida y migración (con su test) → **parar y enseñar**.
2. Pantalla de carga y pantalla de título.
3. Prepara tu aventura.
4. Personajes (`characters.js`) y Carla → Emma.
5. Sistema de escenas e historia.
6. Visitas de papá y frases recurrentes.
7. Icono y manifest.

Al terminar cada paso: tests en verde, commit y resumen con capturas.
