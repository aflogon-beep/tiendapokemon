# Pokémon Card Shop 3D

Juego de gestión de una tienda de cartas Pokémon en 3D (Three.js + modelos de Kenney). Ver `CLAUDE.md` para el plan completo.

## Desarrollo

```bash
npm install
npm run dev      # servidor local (también accesible desde el móvil en la misma red)
npm test         # tests de lógica (Vitest)
npm run build    # comprobación de tipos + build de producción en dist/
```

Parámetros de depuración:

- `?prueba`: partida aparte, con sobres en las estanterías y cartas en la vitrina, que **nunca se guarda** (para probar el día hasta que lleguen los paneles de la F4).
- `?vel=2` o `?vel=4`: velocidad del juego, como el botón 1×/2×/4× de la v10.
- `?debug`: FPS y llamadas de dibujo.
- `?f0`: solo el suelo vacío de la Fase 0.

## Partidas

- Se guarda sola cada 10 s, al salir de la app y al terminar el día (clave `pcs3d-save-<modo>-v1` en localStorage).
- Si en el navegador hay una partida de la v10 (`pcs-save-real-v3`) y aún no hay ninguna de esta versión, se carga esa (sin borrarla).
- Botón 💾 de la cabecera: guardar, exportar/importar archivo o código (también los de la v10) y empezar de cero.
- Sin conexión con la API se juega una partida aparte con cartas ilustradas; si ya hay una partida real guardada, antes se ofrece reintentar.

Cámara: arrastrar para mover, pellizcar o rueda para zoom, y los botones ＋ / － / ⤢ (este último cambia entre cámara automática, toda la tienda y calle, como en la v10).

## Publicación

Cada push a `main` se publica en GitHub Pages con `.github/workflows/deploy.yml`. Hay que activar una vez en *Settings → Pages → Source: GitHub Actions*.

## Créditos

Modelos 3D de [Kenney](https://kenney.nl) (Mini Market, Mini Characters, City Kit Commercial), licencia CC0.
