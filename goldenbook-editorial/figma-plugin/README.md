# Goldenbook · Print Build (Figma local plugin)

Construye los 4 frames de los anuncios para el **Livro do Algarve** dentro del archivo de Figma ya creado:

> https://www.figma.com/design/mwvgBpbB4sBKEIfM8GvMrU

Genera, en una pasada:

- `Single · EN` — página individual en inglés (211 × 281 mm con bleed).
- `Single · PT` — página individual en portugués de Portugal.
- `Double · EN` — doble página en inglés (416 × 281 mm spread con bleed).
- `Double · PT` — doble página en portugués de Portugal.

Cada layout queda dentro de un wrapper `[REFERENCE]` con marcas de corte, guías de bleed/trim/safe area (y en spreads, lomo + gutter), y un sub-frame `[EXPORT]` listo para exportar a PDF.

---

## Cómo instalarlo y ejecutarlo (paso a paso)

### Requisitos

- **Figma Desktop** (Mac o Windows). Los plugins de desarrollo solo funcionan en la app de escritorio, no en el navegador.
- Estar logueado en Figma con la cuenta que tiene acceso al archivo (`domxpc`).

### 1. Abrir el archivo

Abre Figma Desktop y entra en el archivo:

> https://www.figma.com/design/mwvgBpbB4sBKEIfM8GvMrU

Verifica que veas las 3 páginas en la barra lateral izquierda:

- `Singles · EN + PT`
- `Doubles · EN + PT`
- `Assets · Mockups + Read me`

### 2. Arrastrar las 10 capturas al archivo (una sola vez)

Abre la carpeta [goldenbook-editorial/images/](../images/) en Finder. Selecciona los 10 PNGs:

```
concierge-en.png      concierge-pt.png
detail-en.png         detail-pt.png
discover-en.png       discover-pt.png
golden-picks-en.png   golden-picks-pt.png
routes-en.png         routes-pt.png
```

Arrástralos al canvas de Figma (preferentemente sobre la página `Assets · Mockups + Read me`). Figma crea un layer por cada imagen con el nombre del archivo sin extensión (`discover-en`, `routes-pt`, etc.). El plugin escanea el archivo buscando esos nombres exactos y enruta cada hash al layout que corresponda.

> **Importante**: el nombre del layer tiene que coincidir literalmente con el nombre del archivo. Si Figma renombra alguno (por ejemplo a `discover-en 2`), renómbralo a mano antes de ejecutar el plugin.

### 3. Importar el plugin

En Figma Desktop, menú superior:

```
Plugins → Development → Import plugin from manifest…
```

Navega hasta esta carpeta y selecciona:

```
goldenbook-editorial/figma-plugin/manifest.json
```

> En macOS la ruta absoluta es: `/Users/rominasanchezpomier/Desktop/Proyectos/GoldenbookApp/goldenbook/goldenbook-editorial/figma-plugin/manifest.json`

El plugin queda guardado en tu cuenta como `Goldenbook · Print Build`.

### 4. Ejecutarlo

Con el archivo de Figma abierto:

```
Plugins → Development → Goldenbook · Print Build
```

Verás un toast `Goldenbook · building print layouts…` y al cabo de unos segundos `Done · Singles + Doubles built in EN and PT.`

El plugin centra automáticamente la vista en los singles. Cambia de página para ver las dobles.

### 5. Re-ejecutarlo después de editar el script

El plugin es **idempotente**: cada vez que se ejecuta, borra todo lo que haya en `Singles · EN + PT` y `Doubles · EN + PT` y vuelve a construirlo desde cero. Las capturas subidas en `Assets · Mockups + Read me` se preservan (se mueven a esa página antes del wipe).

---

## Cómo exportar a PDF de imprenta

Cada layout vive dentro de un wrapper con dos frames anidados:

```
[REFERENCE] Single · EN          ← incluye marcas de corte y guías
   └── [EXPORT] Single · EN — 211×281 mm (with bleed)   ← este es el que se exporta
       └── (hero, mockups, claim, QR, CTA, …)
   └── Guides (hide before export)   ← capa con guías visibles
```

Pasos:

1. **Oculta la capa `Guides (hide before export)`** dentro del wrapper REFERENCE.
2. Selecciona el frame **`[EXPORT] …`** (el de adentro, con bleed).
3. `File → Export selection…` → formato `PDF`, escala `1×`.
4. El PDF resultante mide:
   - Single → 211 × 281 mm (con 3 mm de bleed perimetral, trim 205 × 275 mm).
   - Double → 416 × 281 mm spread (con 3 mm de bleed exterior, trim 410 × 275 mm).

> Figma exporta en **RGB**. Si la imprenta exige CMYK, convierte el PDF en Acrobat Pro o pásalo al prepress del Livro do Algarve.

---

## Cómo reemplazar fotos y QR

### Fotos del Algarve (placeholders en gradiente)

Los heros se generan como **placeholders de gradiente** etiquetados `[PLACEHOLDER] Algarve …`. Para colocar la foto final:

1. Click sobre el frame placeholder.
2. Panel derecho → `Fill` → click en la miniatura de fill → `Choose image…`.
3. Sube la foto definitiva. Se aplicará como fill con `scaleMode = FILL` (recortando para llenar).
4. Ajusta el `Crop` si quieres recomponer el encuadre.

Recomendación del brief:

- **Single page** → playa al atardecer (variante "sunset").
- **Double page (izquierda)** → costa turquesa con acantilados (variante "turquoise").

### QR

El QR es un placeholder vectorial blanco/negro con tres marcadores tipo QR. Cuando tengas el código final que apunte a `https://www.goldenbook.app/es`:

1. Click sobre el frame `QR placeholder · …`.
2. Reemplaza su contenido pegando el QR final encima, o cambia su fill a `Image` y sube el PNG/SVG del QR.
3. Mantén el tamaño:
   - Single → 22 × 22 mm (suficiente, dentro de safe area).
   - Double → 26 × 26 mm.

---

## Estructura del archivo

```
Singles · EN + PT
  ├── [REFERENCE] Single · EN
  │     ├── [EXPORT] Single · EN — 211×281 mm
  │     └── Guides
  └── [REFERENCE] Single · PT
        ├── [EXPORT] Single · PT — 211×281 mm
        └── Guides

Doubles · EN + PT
  ├── [REFERENCE] Double · EN
  │     ├── [EXPORT] Double · EN — 416×281 mm
  │     └── Guides
  └── [REFERENCE] Double · PT
        ├── [EXPORT] Double · PT — 416×281 mm
        └── Guides

Assets · Mockups + Read me
  ├── Title + read me
  └── App screenshots (concierge, detail, discover, golden-picks, routes)
```

El plugin **descubre los hashes en runtime**: escanea el archivo buscando layers con nombre `<pantalla>-<idioma>` (`discover-en`, `routes-pt`, …) y usa la imagen que cada layer tenga como fill. Por eso solo hay que arrastrar las 10 imágenes una vez (paso 2 del setup).

Si quieres reusar el plugin en otro archivo Figma:

1. Crea las 3 páginas con los nombres exactos: `Singles · EN + PT`, `Doubles · EN + PT`, `Assets · Mockups + Read me`.
2. Arrastra las 10 capturas de [goldenbook-editorial/images/](../images/) al nuevo archivo.
3. Ejecuta el plugin. Si el nombre de algún layer no coincide con el patrón esperado, el plugin avisará y no construirá nada (no destruye nada hasta que las 10 imágenes estén disponibles).

---

## Resolver problemas

- **"Required pages missing"** → asegúrate de que las páginas se llamen exactamente `Singles · EN + PT`, `Doubles · EN + PT` y `Assets · Mockups + Read me` (con los puntos `·` y los espacios).
- **"Missing image layers: discover-en, routes-pt, …"** → falta arrastrar alguna de las 10 PNGs al archivo, o algún layer está mal nombrado. Renómbralo a mano para que coincida con `<pantalla>-<idioma>` (`discover-en`, `routes-pt`, etc.) y vuelve a ejecutar. El plugin valida antes de tocar las páginas, así que ejecutar en estado incompleto no destruye nada.
- **Las fotos del Algarve aparecen como gradiente** → es esperado, son placeholders. Reemplázalos con `Choose image` (ver sección anterior).
- **Tipografías "missing"** → instala localmente Playfair Display e Inter (Google Fonts), o ajústalas en el panel de tipos del archivo.
- **PDF muestra las guías** → no ocultaste la capa `Guides (hide before export)` antes de exportar.
- **Plugin tarda demasiado o falla** → cierra otros archivos pesados de Figma y vuelve a ejecutar.
