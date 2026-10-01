# Pokémon Card Shop 3D

Juego de gestión de una tienda de cartas Pokémon en 3D (Three.js + modelos de Kenney). Ver `CLAUDE.md` para el plan completo.

## Desarrollo

```bash
npm install
npm run dev      # servidor local (también accesible desde el móvil en la misma red)
npm test         # tests de lógica (Vitest)
npm run build    # comprobación de tipos + build de producción en dist/
```

Parámetros de depuración: `?debug` (FPS y llamadas de dibujo) y `?f0` (solo el suelo vacío de la Fase 0).

Cámara: arrastrar para mover, pellizcar o rueda para zoom, y los botones ＋ / － / ⤢ (este último cambia entre cámara automática, toda la tienda y calle, como en la v10).

## Publicación

Cada push a `main` se publica en GitHub Pages con `.github/workflows/deploy.yml`. Hay que activar una vez en *Settings → Pages → Source: GitHub Actions*.

## Créditos

Modelos 3D de [Kenney](https://kenney.nl) (Mini Market, Mini Characters, City Kit Commercial), licencia CC0.
