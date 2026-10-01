# Pokémon Card Shop 3D

Juego de gestión de una tienda de cartas Pokémon en 3D (Three.js + modelos de Kenney). Ver `CLAUDE.md` para el plan completo.

## Desarrollo

```bash
npm install
npm run dev      # servidor local (también accesible desde el móvil en la misma red)
npm test         # tests de lógica (Vitest)
npm run build    # comprobación de tipos + build de producción en dist/
```

Parámetros de depuración de la escena de prueba: `?f0` (solo suelo vacío), `?view=12` (metros visibles), `?x=-2&z=-1` (centro de la cámara).

## Publicación

Cada push a `main` se publica en GitHub Pages con `.github/workflows/deploy.yml`. Hay que activar una vez en *Settings → Pages → Source: GitHub Actions*.

## Créditos

Modelos 3D de [Kenney](https://kenney.nl) (Mini Market, Mini Characters, City Kit Commercial), licencia CC0.
