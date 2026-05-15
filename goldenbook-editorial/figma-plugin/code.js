"use strict";

// Goldenbook · Print Build (Figma local plugin)
// Builds 2 export-ready frames inside the already-prepared file:
//   • One Single (211 × 281 mm with bleed) — bilingual EN + PT
//   • One Double spread (416 × 281 mm with bleed) — bilingual EN + PT
//
// EN is the primary voice; PT (Portugal) is set as an italic translation at
// smaller size and reduced opacity so the hierarchy stays editorial.
//
// Run: Plugins → Development → Goldenbook · Print Build.
// Re-running the plugin REGENERATES the layouts on the Singles and Doubles
// pages from scratch. Uploaded screenshots and photos are preserved on the
// Assets page so their imageHash references stay alive.

(async () => {
  // ============================================================
  // CONSTANTS
  // ============================================================
  const MM = 2.8346456693; // pt per mm at 72dpi (PDF export scale)
  const mm = (n) => n * MM;

  const BLEED_MM = 3;
  const SAFE_MM = 5;
  const PAGE_W_MM = 205;
  const PAGE_H_MM = 275;

  const FRAME_W_MM = PAGE_W_MM + 2 * BLEED_MM;   // 211
  const FRAME_H_MM = PAGE_H_MM + 2 * BLEED_MM;   // 281
  const SPREAD_W_MM = 2 * PAGE_W_MM + 2 * BLEED_MM; // 416
  const REG_PAD_MM = 10;

  const NAVY     = { r: 0.043, g: 0.106, b: 0.184 };
  const NAVY_INK = { r: 0.063, g: 0.137, b: 0.224 };
  const GOLD     = { r: 0.749, g: 0.612, b: 0.349 };
  const CREAM    = { r: 0.984, g: 0.969, b: 0.945 };
  const MUTED    = { r: 0.376, g: 0.392, b: 0.439 };
  const WHITE    = { r: 1, g: 1, b: 1 };
  const BLACK    = { r: 0, g: 0, b: 0 };

  // App screens — only EN versions are used in the layouts. PT screens may
  // also be loaded (preserved on the Assets page) but are not placed.
  const SCREEN_KEYS = ["discover", "routes", "detail", "golden-picks", "concierge"];
  const SCREEN_LOCALE = "en";

  // Screens that need a different image on the single vs the double. The
  // editorial team supplies these as "<screen>-en-single". For example,
  // `detail-en-single` is the place-detail screen variant the single uses;
  // the double still uses `detail-en`. Other screens stay shared.
  const SINGLE_OVERRIDES = ["detail"];

  // Background photos — drop these PNGs into the file with these exact
  // layer names. `cliff` → double left page; `beach` → single hero.
  const PHOTO_KEYS = ["cliff", "beach"];

  const QR_URL = "https://www.goldenbook.app/es";

  // Bilingual copy. Eyebrow (brand mark) and credit are not translated.
  const COPY = {
    eyebrow: "Goldenbook Go",
    credit: "Algarve · Portugal",
    single: {
      claim: {
        en: "The Algarve, curated for you",
        pt: "O Algarve, escolhido a dedo para si",
      },
      body: {
        en: "Scan the QR code to discover Goldenbook’s handpicked guide to Portugal.",
        pt: "Faça scan do código QR e descubra o guia Goldenbook de Portugal.",
      },
      cta: {
        en: "Scan to open Goldenbook Go",
        pt: "Faça scan para abrir Goldenbook Go",
      },
    },
    double: {
      bigPhrase: {
        en: "Discover the Algarve through Goldenbook",
        pt: "Descubra o Algarve com a Goldenbook",
      },
      body: {
        en: "Curated places, golden routes and personal recommendations — all in one app.",
        pt: "Locais selecionados, rotas douradas e recomendações pessoais — tudo numa só aplicação.",
      },
      cta: {
        en: "Scan to open Goldenbook Go",
        pt: "Faça scan para abrir Goldenbook Go",
      },
    },
  };

  // ============================================================
  // FONT LOADING
  // ============================================================
  async function loadFonts() {
    const fonts = [
      ["Playfair Display", "Regular"],
      ["Playfair Display", "Italic"],
      ["Playfair Display", "SemiBold"],
      ["Inter", "Regular"],
      ["Inter", "Italic"],
      ["Inter", "Medium"],
      ["Inter", "Semi Bold"],
    ];
    for (const [family, style] of fonts) {
      try {
        await figma.loadFontAsync({ family, style });
      } catch (e) {
        console.warn("Font missing:", family, style, e && e.message);
      }
    }
  }

  // ============================================================
  // LOW-LEVEL HELPERS
  // ============================================================
  function txt(parent, characters, opts) {
    opts = opts || {};
    const n = figma.createText();
    if (opts.font) n.fontName = opts.font;
    n.characters = characters;
    if (opts.size) n.fontSize = opts.size;
    if (opts.color) n.fills = [{ type: "SOLID", color: opts.color }];
    if (opts.lineHeight) n.lineHeight = { value: opts.lineHeight, unit: "PIXELS" };
    if (opts.letterSpacing != null) n.letterSpacing = { value: opts.letterSpacing, unit: "PIXELS" };
    if (opts.textCase) n.textCase = opts.textCase;
    if (opts.textAlign) n.textAlignHorizontal = opts.textAlign;
    if (opts.maxWidth) {
      n.textAutoResize = "HEIGHT";
      n.resize(opts.maxWidth, n.height);
    }
    if (opts.x != null) n.x = opts.x;
    if (opts.y != null) n.y = opts.y;
    if (opts.opacity != null) n.opacity = opts.opacity;
    if (opts.name) n.name = opts.name;
    if (parent) parent.appendChild(n);
    return n;
  }

  function rect(parent, w, h, opts) {
    opts = opts || {};
    const r = figma.createRectangle();
    r.resize(Math.max(w, 0.01), Math.max(h, 0.01));
    if (opts.fills) r.fills = opts.fills;
    else if (opts.fill) r.fills = [{ type: "SOLID", color: opts.fill }];
    if (opts.strokes) r.strokes = opts.strokes;
    if (opts.strokeWeight != null) r.strokeWeight = opts.strokeWeight;
    if (opts.strokeAlign) r.strokeAlign = opts.strokeAlign;
    if (opts.dashPattern) r.dashPattern = opts.dashPattern;
    if (opts.cornerRadius != null) r.cornerRadius = opts.cornerRadius;
    if (opts.x != null) r.x = opts.x;
    if (opts.y != null) r.y = opts.y;
    if (opts.opacity != null) r.opacity = opts.opacity;
    if (opts.rotation != null) r.rotation = opts.rotation;
    if (opts.name) r.name = opts.name;
    if (parent) parent.appendChild(r);
    return r;
  }

  function frameNode(parent, w, h, opts) {
    opts = opts || {};
    const f = figma.createFrame();
    f.resize(Math.max(w, 0.01), Math.max(h, 0.01));
    if (opts.fills) f.fills = opts.fills;
    else if (opts.fill) f.fills = [{ type: "SOLID", color: opts.fill }];
    else if (opts.transparent) f.fills = [];
    if (opts.cornerRadius != null) f.cornerRadius = opts.cornerRadius;
    if (opts.x != null) f.x = opts.x;
    if (opts.y != null) f.y = opts.y;
    if (opts.rotation != null) f.rotation = opts.rotation;
    if (opts.name) f.name = opts.name;
    if (opts.clipsContent != null) f.clipsContent = opts.clipsContent;
    if (parent) parent.appendChild(f);
    return f;
  }

  function imageFill(hash, scaleMode) {
    return { type: "IMAGE", imageHash: hash, scaleMode: scaleMode || "FILL" };
  }

  // ============================================================
  // IMAGE HASH DISCOVERY
  // ============================================================
  // Walks every page and finds layers whose name matches one of:
  //   • "<screen>-en" or "<screen>-pt"     (app screens, PT preserved but unused)
  //   • "<screen>-en-single"               (single-specific override variants)
  //   • "cliff" or "beach"                 (background photos)
  function buildHashMap() {
    const wanted = new Set();
    for (const s of SCREEN_KEYS) {
      wanted.add(`${s}-en`);
      wanted.add(`${s}-pt`);
    }
    for (const s of SINGLE_OVERRIDES) wanted.add(`${s}-${SCREEN_LOCALE}-single`);
    for (const p of PHOTO_KEYS) wanted.add(p);

    const map = {};
    for (const page of figma.root.children) {
      for (const node of page.children) {
        if (!wanted.has(node.name)) continue;
        const fills = node.fills;
        if (!fills || !Array.isArray(fills)) continue;
        const imgFill = fills.find((f) => f && f.type === "IMAGE" && f.imageHash);
        if (imgFill) map[node.name] = imgFill.imageHash;
      }
    }
    return map;
  }

  // Per-layout screen pick. The single layout substitutes any screen listed
  // in SINGLE_OVERRIDES with its `-single` variant (e.g. detail-en-single).
  function pickScreens(map, layout) {
    const useSingleOverride = layout === "single";
    const out = {};
    for (const s of SCREEN_KEYS) {
      const baseKey = `${s}-${SCREEN_LOCALE}`;
      const overrideKey = `${baseKey}-single`;
      out[s] = (useSingleOverride && map[overrideKey]) || map[baseKey];
    }
    return out;
  }

  // Required: EN screens + single overrides + cliff + beach. PT is optional.
  function missingRequired(map) {
    const out = [];
    for (const s of SCREEN_KEYS) {
      const k = `${s}-${SCREEN_LOCALE}`;
      if (!map[k]) out.push(k);
    }
    for (const s of SINGLE_OVERRIDES) {
      const k = `${s}-${SCREEN_LOCALE}-single`;
      if (!map[k]) out.push(k);
    }
    for (const p of PHOTO_KEYS) {
      if (!map[p]) out.push(p);
    }
    return out;
  }

  // Strokeless guide rectangle helper
  function strokeRect(parent, x, y, w, h, color, dash, weight) {
    return rect(parent, w, h, {
      x, y,
      fills: [],
      strokes: [{ type: "SOLID", color }],
      strokeWeight: weight != null ? weight : 0.5,
      strokeAlign: "CENTER",
      dashPattern: dash,
      name: "[guide]",
    });
  }

  // ============================================================
  // PRINT GUIDES
  // ============================================================
  function buildGuides(opts) {
    const g = frameNode(opts.outer, opts.outer.width, opts.outer.height, {
      x: 0, y: 0,
      transparent: true,
      clipsContent: false,
      name: "Guides (hide before export)",
    });

    const trimX = opts.innerOriginX + mm(BLEED_MM);
    const trimY = opts.innerOriginY + mm(BLEED_MM);
    const safeOff = mm(BLEED_MM + SAFE_MM);
    const safeX = opts.innerOriginX + safeOff;
    const safeY = opts.innerOriginY + safeOff;

    const bleedX = opts.innerOriginX;
    const bleedY = opts.innerOriginY;
    const bleedW = opts.trimW + 2 * mm(BLEED_MM);
    const bleedH = opts.trimH + 2 * mm(BLEED_MM);

    const bleedR = strokeRect(g, bleedX, bleedY, bleedW, bleedH,
      { r: 0.86, g: 0.14, b: 0.14 }, [2, 3], 0.5);
    bleedR.name = "[guide] Bleed (3 mm)";

    const trimR = strokeRect(g, trimX, trimY, opts.trimW, opts.trimH,
      BLACK, [4, 4], 0.5);
    trimR.name = "[guide] Trim";

    const safeR = strokeRect(g, safeX, safeY,
      opts.trimW - 2 * mm(SAFE_MM), opts.trimH - 2 * mm(SAFE_MM),
      { r: 0.05, g: 0.6, b: 0.35 }, [2, 3], 0.4);
    safeR.name = "[guide] Safe area (5 mm)";

    const ML = mm(4);
    const MO = mm(2);
    const corners = [
      { x: trimX,                y: trimY,                dx: -1, dy: -1 },
      { x: trimX + opts.trimW,   y: trimY,                dx:  1, dy: -1 },
      { x: trimX,                y: trimY + opts.trimH,   dx: -1, dy:  1 },
      { x: trimX + opts.trimW,   y: trimY + opts.trimH,   dx:  1, dy:  1 },
    ];
    for (const c of corners) {
      const hx = c.dx > 0 ? c.x + MO : c.x - MO - ML;
      rect(g, ML, 0.5, { x: hx, y: c.y, fill: BLACK, name: "[guide] Crop mark H" });
      const vy = c.dy > 0 ? c.y + MO : c.y - MO - ML;
      rect(g, 0.5, ML, { x: c.x, y: vy, fill: BLACK, name: "[guide] Crop mark V" });
    }

    if (opts.addCenterFold) {
      const foldX = trimX + opts.trimW / 2;
      const fold = strokeRect(g, foldX, trimY - mm(8), 0.3, opts.trimH + mm(16),
        { r: 0.4, g: 0.4, b: 0.4 }, [3, 3], 0.4);
      fold.name = "[guide] Spine / fold";

      const gutter = mm(8);
      const gL = strokeRect(g, foldX - gutter, trimY, gutter, opts.trimH,
        { r: 0.95, g: 0.6, b: 0.1 }, [1, 3], 0.3);
      gL.name = "[guide] Gutter safe (left)";
      const gR = strokeRect(g, foldX, trimY, gutter, opts.trimH,
        { r: 0.95, g: 0.6, b: 0.1 }, [1, 3], 0.3);
      gR.name = "[guide] Gutter safe (right)";
    }

    g.locked = true;
    return g;
  }

  // ============================================================
  // COMPONENT-LIKE BUILDERS
  // ============================================================
  // Hero photo holder. When `photoHash` is provided, fills with the actual
  // image; otherwise renders a synthetic gradient + placeholder tag.
  // `overlayMode` controls the legibility scrim layered over the photo:
  //   • "standard"  → bottom darken only (legacy, used nowhere now)
  //   • "editorial" → premium dual-scrim (top + bottom navy gradients with
  //                   a clear middle band) used on both single and double
  function heroPhotoPlaceholder(parent, x, y, w, h, opts) {
    opts = opts || {};
    const variant = opts.variant || "sunset";
    const overlayMode = opts.overlayMode || "standard";
    const hasPhoto = !!opts.photoHash;

    const f = frameNode(parent, w, h, {
      x, y,
      name: opts.name || (hasPhoto
        ? "Algarve photo"
        : "[PLACEHOLDER] Algarve photo · swap with final image"),
      clipsContent: true,
    });

    if (hasPhoto) {
      f.fills = [imageFill(opts.photoHash, "FILL")];
    } else if (variant === "sunset") {
      f.fills = [{
        type: "GRADIENT_LINEAR",
        gradientTransform: [[0.766, 0.643, 0], [-0.643, 0.766, 0]],
        gradientStops: [
          { color: { r: 0.106, g: 0.180, b: 0.286, a: 1 }, position: 0 },
          { color: { r: 0.529, g: 0.337, b: 0.282, a: 1 }, position: 0.5 },
          { color: { r: 0.918, g: 0.624, b: 0.349, a: 1 }, position: 1 },
        ],
      }];
      const sun = figma.createEllipse();
      sun.resize(w * 0.35, w * 0.35);
      sun.x = w * 0.45;
      sun.y = h * 0.18;
      sun.fills = [{
        type: "GRADIENT_RADIAL",
        gradientTransform: [[0.5, 0, 0.25], [0, 0.5, 0.25]],
        gradientStops: [
          { color: { r: 1, g: 0.82, b: 0.45, a: 0.85 }, position: 0 },
          { color: { r: 1, g: 0.82, b: 0.45, a: 0    }, position: 1 },
        ],
      }];
      sun.name = "Sun glow";
      f.appendChild(sun);
    } else { // turquoise
      f.fills = [{
        type: "GRADIENT_LINEAR",
        gradientTransform: [[1, 0, 0], [0, 1, 0]],
        gradientStops: [
          { color: { r: 0.071, g: 0.255, b: 0.349, a: 1 }, position: 0    },
          { color: { r: 0.341, g: 0.620, b: 0.624, a: 1 }, position: 0.55 },
          { color: { r: 0.776, g: 0.871, b: 0.835, a: 1 }, position: 1    },
        ],
      }];
    }

    if (overlayMode === "editorial") {
      // Editorial dual-scrim: navy (not pure black) gradients at top and
      // bottom guarantee type legibility on any photo while keeping the
      // middle band clear. Navy reproduces more gracefully than rich-black
      // in CMYK conversion and reads as premium.
      rect(f, w, h * 0.42, {
        x: 0, y: 0,
        fills: [{
          type: "GRADIENT_LINEAR",
          gradientTransform: [[0, 1, 0], [-1, 0, 1]],
          gradientStops: [
            { color: { r: 0.043, g: 0.106, b: 0.184, a: 0.62 }, position: 0    },
            { color: { r: 0.043, g: 0.106, b: 0.184, a: 0.32 }, position: 0.55 },
            { color: { r: 0.043, g: 0.106, b: 0.184, a: 0    }, position: 1    },
          ],
        }],
        name: "Top scrim (navy gradient)",
      });
      rect(f, w, h * 0.58, {
        x: 0, y: h * 0.42,
        fills: [{
          type: "GRADIENT_LINEAR",
          gradientTransform: [[0, 1, 0], [-1, 0, 1]],
          gradientStops: [
            { color: { r: 0.043, g: 0.106, b: 0.184, a: 0    }, position: 0    },
            { color: { r: 0.043, g: 0.106, b: 0.184, a: 0.45 }, position: 0.45 },
            { color: { r: 0.043, g: 0.106, b: 0.184, a: 0.82 }, position: 1    },
          ],
        }],
        name: "Bottom scrim (navy gradient)",
      });
    } else {
      rect(f, w, h, {
        x: 0, y: 0,
        fills: [{
          type: "GRADIENT_LINEAR",
          gradientTransform: [[0, 1, 0], [-1, 0, 1]],
          gradientStops: [
            { color: { r: 0, g: 0, b: 0, a: 0    }, position: 0 },
            { color: { r: 0, g: 0, b: 0, a: 0.45 }, position: 1 },
          ],
        }],
        name: "Photo overlay",
      });
    }

    if (!hasPhoto) {
      txt(f, "ALGARVE PHOTO · PLACEHOLDER · SWAP", {
        font: { family: "Inter", style: "Medium" },
        size: 8,
        color: WHITE,
        letterSpacing: 1.5,
        x: mm(8),
        y: mm(8),
        opacity: 0.7,
        name: "Placeholder tag",
      });
    }

    return f;
  }

  function qrPlaceholder(parent, x, y, sizeMM, opts) {
    opts = opts || {};
    const s = mm(sizeMM);
    const f = frameNode(parent, s, s, {
      x, y,
      name: opts.name || `QR placeholder · ${sizeMM}×${sizeMM} mm`,
      fill: WHITE,
      clipsContent: true,
    });
    f.strokes = [{ type: "SOLID", color: BLACK }];
    f.strokeWeight = 0.5;
    f.cornerRadius = mm(1);

    const m = s * 0.18;
    const o = s * 0.05;
    function finder(cx, cy) {
      rect(f, m, m, { x: cx, y: cy, fill: BLACK });
      rect(f, m * 0.6, m * 0.6, { x: cx + m * 0.2, y: cy + m * 0.2, fill: WHITE });
      rect(f, m * 0.3, m * 0.3, { x: cx + m * 0.35, y: cy + m * 0.35, fill: BLACK });
    }
    finder(o, o);
    finder(s - m - o, o);
    finder(o, s - m - o);

    const note = txt(f, "QR\nplaceholder", {
      font: { family: "Inter", style: "Medium" },
      size: 7,
      color: { r: 0.4, g: 0.4, b: 0.4 },
      textAlign: "CENTER",
      lineHeight: 9,
      x: 0,
      y: s / 2 - 9,
    });
    note.resize(s, 18);
    return f;
  }

  function iphoneMockup(parent, opts) {
    const wMM = opts.wMM;
    const aspect = 19.5 / 9;
    const hMM = wMM * aspect;
    const w = mm(wMM);
    const h = mm(hMM);
    const SR = mm(wMM * 0.092);
    const INSET = mm(wMM * 0.018);

    const cmp = frameNode(parent, w, h, {
      x: opts.x, y: opts.y,
      name: opts.name || "iPhone Mockup",
      clipsContent: false,
      transparent: true,
    });
    if (opts.rotation) cmp.rotation = opts.rotation;

    const shell = rect(cmp, w, h, {
      fill: { r: 0.07, g: 0.07, b: 0.08 },
      cornerRadius: SR,
      name: "Shell",
    });
    shell.effects = [
      { type: "DROP_SHADOW", color: { r:0,g:0,b:0,a:0.22 }, offset: { x: 0, y: mm(4) }, radius: mm(8), spread: 0, visible: true, blendMode: "NORMAL" },
      { type: "DROP_SHADOW", color: { r:0,g:0,b:0,a:0.15 }, offset: { x: 0, y: mm(1) }, radius: mm(2), spread: 0, visible: true, blendMode: "NORMAL" },
    ];

    const screen = frameNode(cmp, w - 2 * INSET, h - 2 * INSET, {
      x: INSET, y: INSET,
      name: "Screen",
      clipsContent: true,
      fill: { r: 0.95, g: 0.95, b: 0.95 },
    });
    screen.cornerRadius = SR - INSET;
    if (opts.screenHash) screen.fills = [imageFill(opts.screenHash, "FILL")];

    const islandW = mm(wMM * 0.32);
    const islandH = mm(wMM * 0.072);
    rect(cmp, islandW, islandH, {
      x: (w - islandW) / 2,
      y: mm(wMM * 0.04),
      fill: BLACK,
      cornerRadius: islandH / 2,
      name: "Dynamic Island",
    });

    return cmp;
  }

  // ============================================================
  // PAGE BUILDERS — bilingual
  // ============================================================
  function buildSingle(opts) {
    // opts: { parent, originX, originY, screens, photoHash }
    const outerW = mm(FRAME_W_MM + 2 * REG_PAD_MM);
    const outerH = mm(FRAME_H_MM + 2 * REG_PAD_MM);
    const innerOX = mm(REG_PAD_MM);
    const innerOY = mm(REG_PAD_MM);

    const outer = frameNode(opts.parent, outerW, outerH, {
      x: opts.originX, y: opts.originY,
      name: "[REFERENCE] Single · EN + PT",
      fill: { r: 0.92, g: 0.92, b: 0.92 },
      clipsContent: false,
    });

    const inner = frameNode(outer, mm(FRAME_W_MM), mm(FRAME_H_MM), {
      x: innerOX, y: innerOY,
      name: `[EXPORT] Single · EN + PT — ${FRAME_W_MM}×${FRAME_H_MM} mm (with bleed)`,
      fill: CREAM,
      clipsContent: true,
    });

    const HERO_H = 110;

    // Hero (beach) with editorial dual-scrim. The scrim provides contrast
    // for the eyebrow that now sits ON the photo (cover-style branding).
    heroPhotoPlaceholder(inner, 0, 0, mm(FRAME_W_MM), mm(HERO_H), {
      variant: "sunset",
      overlayMode: "editorial",
      photoHash: opts.photoHash,
      name: opts.photoHash
        ? "Algarve beach photo"
        : "[PLACEHOLDER] Algarve beach · swap with final image",
    });

    // Eyebrow (brand mark, single occurrence — universal in both languages)
    txt(inner, COPY.eyebrow.toUpperCase(), {
      font: { family: "Inter", style: "Semi Bold" },
      size: 9,
      color: WHITE,
      letterSpacing: 2.2,
      textAlign: "CENTER",
      maxWidth: mm(140),
      x: mm((FRAME_W_MM - 140) / 2),
      y: mm(BLEED_MM + 14),
      name: "Eyebrow",
    });
    rect(inner, mm(14), 1, {
      x: mm((FRAME_W_MM - 14) / 2),
      y: mm(BLEED_MM + 25),
      fill: GOLD,
      name: "Gold rule (eyebrow)",
    });

    // Mockups — secondary back, main front. EN screens only.
    iphoneMockup(inner, {
      x: mm(28), y: mm(102), wMM: 45,
      screenHash: opts.screens.routes,
      name: "Mockup · Routes (left)",
      rotation: 8,
    });
    iphoneMockup(inner, {
      x: mm(FRAME_W_MM - 28 - 45), y: mm(102), wMM: 45,
      screenHash: opts.screens.detail,
      name: "Mockup · Place Detail (right)",
      rotation: -8,
    });
    iphoneMockup(inner, {
      x: mm((FRAME_W_MM - 55) / 2), y: mm(81), wMM: 55,
      screenHash: opts.screens.discover,
      name: "Mockup · Discover (main)",
    });

    // ---- Bilingual cream content (y ≈ 200 → 278) ----

    // Claim EN — primary voice, Playfair SemiBold
    const claimEN = txt(inner, COPY.single.claim.en, {
      font: { family: "Playfair Display", style: "SemiBold" },
      size: 22,
      color: NAVY,
      textAlign: "CENTER",
      lineHeight: 26,
      maxWidth: mm(180),
      name: "Claim · EN",
    });
    claimEN.x = mm((FRAME_W_MM - 180) / 2);
    claimEN.y = mm(204);

    // Tiny gold hairline divider — separates EN and PT
    rect(inner, mm(8), 0.4, {
      x: mm((FRAME_W_MM - 8) / 2),
      y: mm(218),
      fill: GOLD,
      opacity: 0.7,
      name: "Hairline · EN/PT divider (claim)",
    });

    // Claim PT — italic translation, subordinate hierarchy
    const claimPT = txt(inner, COPY.single.claim.pt, {
      font: { family: "Playfair Display", style: "Italic" },
      size: 14,
      color: NAVY,
      textAlign: "CENTER",
      lineHeight: 18,
      maxWidth: mm(180),
      opacity: 0.6,
      name: "Claim · PT",
    });
    claimPT.x = mm((FRAME_W_MM - 180) / 2);
    claimPT.y = mm(222);

    // Body EN
    const bodyEN = txt(inner, COPY.single.body.en, {
      font: { family: "Inter", style: "Regular" },
      size: 8.5,
      color: NAVY_INK,
      textAlign: "CENTER",
      lineHeight: 12,
      maxWidth: mm(140),
      name: "Body · EN",
    });
    bodyEN.x = mm((FRAME_W_MM - 140) / 2);
    bodyEN.y = mm(236);

    // Body PT — italic translation
    const bodyPT = txt(inner, COPY.single.body.pt, {
      font: { family: "Inter", style: "Italic" },
      size: 8.5,
      color: NAVY_INK,
      textAlign: "CENTER",
      lineHeight: 12,
      maxWidth: mm(140),
      opacity: 0.55,
      name: "Body · PT",
    });
    bodyPT.x = mm((FRAME_W_MM - 140) / 2);
    bodyPT.y = mm(247);

    // QR — slightly compact (14 mm) to leave room for bilingual CTA stack
    qrPlaceholder(inner, mm((FRAME_W_MM - 14) / 2), mm(258), 14, {
      name: `QR placeholder · ${QR_URL}`,
    });

    // CTA EN — primary
    txt(inner, COPY.single.cta.en.toUpperCase(), {
      font: { family: "Inter", style: "Semi Bold" },
      size: 7,
      color: GOLD,
      textAlign: "CENTER",
      letterSpacing: 1.3,
      maxWidth: mm(160),
      x: mm((FRAME_W_MM - 160) / 2),
      y: mm(274),
      name: "CTA · EN",
    });

    // CTA PT — italic, subordinate
    txt(inner, COPY.single.cta.pt, {
      font: { family: "Inter", style: "Italic" },
      size: 6.5,
      color: GOLD,
      textAlign: "CENTER",
      letterSpacing: 0.4,
      maxWidth: mm(160),
      x: mm((FRAME_W_MM - 160) / 2),
      y: mm(278),
      opacity: 0.75,
      name: "CTA · PT",
    });

    buildGuides({
      outer,
      innerOriginX: innerOX,
      innerOriginY: innerOY,
      trimW: mm(PAGE_W_MM),
      trimH: mm(PAGE_H_MM),
      addCenterFold: false,
    });

    txt(outer, `Single · EN + PT  ·  ${PAGE_W_MM}×${PAGE_H_MM} mm  ·  bleed ${BLEED_MM} mm`, {
      font: { family: "Inter", style: "Medium" },
      size: 9,
      color: { r: 0.3, g: 0.3, b: 0.3 },
      letterSpacing: 0.4,
      x: innerOX,
      y: mm(2),
      name: "Frame label",
    });

    return outer;
  }

  function buildDouble(opts) {
    // opts: { parent, originX, originY, screens, photoHash }
    const outerW = mm(SPREAD_W_MM + 2 * REG_PAD_MM);
    const outerH = mm(FRAME_H_MM + 2 * REG_PAD_MM);
    const innerOX = mm(REG_PAD_MM);
    const innerOY = mm(REG_PAD_MM);

    const outer = frameNode(opts.parent, outerW, outerH, {
      x: opts.originX, y: opts.originY,
      name: "[REFERENCE] Double · EN + PT",
      fill: { r: 0.92, g: 0.92, b: 0.92 },
      clipsContent: false,
    });

    const inner = frameNode(outer, mm(SPREAD_W_MM), mm(FRAME_H_MM), {
      x: innerOX, y: innerOY,
      name: `[EXPORT] Double · EN + PT — ${SPREAD_W_MM}×${FRAME_H_MM} mm (spread with bleed)`,
      fill: CREAM,
      clipsContent: true,
    });

    // ---- Left page: cliff photo with editorial dual-scrim ----
    heroPhotoPlaceholder(
      inner, 0, 0,
      mm(BLEED_MM + PAGE_W_MM), mm(FRAME_H_MM),
      {
        variant: "turquoise",
        overlayMode: "editorial",
        photoHash: opts.photoHash,
        name: opts.photoHash
          ? "Algarve cliff photo"
          : "[PLACEHOLDER] Algarve cliffs · swap with final image",
      }
    );

    // Eyebrow + rule (top-left, white) — single occurrence
    txt(inner, COPY.eyebrow.toUpperCase(), {
      font: { family: "Inter", style: "Semi Bold" },
      size: 9,
      color: WHITE,
      letterSpacing: 2,
      maxWidth: mm(80),
      x: mm(BLEED_MM + 12),
      y: mm(BLEED_MM + 18),
      name: "Eyebrow (left)",
    });
    rect(inner, mm(18), 1.2, {
      x: mm(BLEED_MM + 12),
      y: mm(BLEED_MM + 30),
      fill: GOLD,
      name: "Gold rule (left)",
    });

    // Big phrase EN — primary, Playfair SemiBold display
    const phraseEN = txt(inner, COPY.double.bigPhrase.en, {
      font: { family: "Playfair Display", style: "SemiBold" },
      size: 42,
      color: WHITE,
      lineHeight: 48,
      maxWidth: mm(165),
      name: "Big phrase · EN",
    });
    phraseEN.x = mm(BLEED_MM + 12);
    phraseEN.y = mm(FRAME_H_MM - BLEED_MM - 132);

    // Gold hairline — separates EN from PT translation
    rect(inner, mm(28), 0.6, {
      x: mm(BLEED_MM + 12),
      y: mm(FRAME_H_MM - BLEED_MM - 78),
      fill: GOLD,
      opacity: 0.85,
      name: "Hairline · EN/PT divider (big phrase)",
    });

    // Big phrase PT — italic translation, subordinate hierarchy
    const phrasePT = txt(inner, COPY.double.bigPhrase.pt, {
      font: { family: "Playfair Display", style: "Italic" },
      size: 22,
      color: WHITE,
      lineHeight: 28,
      letterSpacing: 0.2,
      maxWidth: mm(165),
      opacity: 0.85,
      name: "Big phrase · PT",
    });
    phrasePT.x = mm(BLEED_MM + 12);
    phrasePT.y = mm(FRAME_H_MM - BLEED_MM - 70);

    // Hairline above credit
    rect(inner, mm(36), 0.5, {
      x: mm(BLEED_MM + 12),
      y: mm(FRAME_H_MM - BLEED_MM - 36),
      fill: GOLD,
      opacity: 0.85,
      name: "Hairline rule (credit)",
    });

    // Credit (universal — not translated)
    txt(inner, COPY.credit, {
      font: { family: "Playfair Display", style: "Italic" },
      size: 12,
      color: WHITE,
      letterSpacing: 0.5,
      maxWidth: mm(80),
      x: mm(BLEED_MM + 12),
      y: mm(FRAME_H_MM - BLEED_MM - 30),
      name: "Credit",
    });

    // ---- Right page: cream functional ----
    rect(inner, mm(PAGE_W_MM + BLEED_MM), mm(FRAME_H_MM), {
      x: mm(BLEED_MM + PAGE_W_MM),
      y: 0,
      fill: CREAM,
      name: "Right page bg",
    });

    const rx = (offsetMM) => mm(BLEED_MM + PAGE_W_MM + offsetMM);
    const ry = (offsetMM) => mm(offsetMM);

    txt(inner, COPY.eyebrow.toUpperCase(), {
      font: { family: "Inter", style: "Semi Bold" },
      size: 9,
      color: GOLD,
      letterSpacing: 2,
      maxWidth: mm(80),
      x: rx(20),
      y: ry(22),
      name: "Eyebrow (right)",
    });
    rect(inner, mm(18), 1.2, {
      x: rx(20),
      y: ry(34),
      fill: GOLD,
      name: "Gold rule (right)",
    });

    // Mockups — EN screens only
    iphoneMockup(inner, {
      x: rx(PAGE_W_MM - 78), y: ry(58), wMM: 50,
      screenHash: opts.screens.detail,
      name: "Mockup · Place Detail (secondary)",
      rotation: -7,
    });
    iphoneMockup(inner, {
      x: rx((PAGE_W_MM - 72) / 2 - 4), y: ry(44), wMM: 72,
      screenHash: opts.screens.discover,
      name: "Mockup · Discover (main)",
    });

    // Body EN — center
    txt(inner, COPY.double.body.en, {
      font: { family: "Inter", style: "Regular" },
      size: 11,
      color: NAVY_INK,
      textAlign: "CENTER",
      lineHeight: 16,
      maxWidth: mm(150),
      x: rx((PAGE_W_MM - 150) / 2),
      y: ry(206),
      name: "Body · EN (right)",
    });

    // Body PT — italic translation
    txt(inner, COPY.double.body.pt, {
      font: { family: "Inter", style: "Italic" },
      size: 10,
      color: NAVY_INK,
      textAlign: "CENTER",
      lineHeight: 14,
      maxWidth: mm(150),
      opacity: 0.6,
      x: rx((PAGE_W_MM - 150) / 2),
      y: ry(228),
      name: "Body · PT (right)",
    });

    // QR
    qrPlaceholder(inner, rx((PAGE_W_MM - 22) / 2), ry(244), 22, {
      name: `QR placeholder · ${QR_URL}`,
    });

    // CTA EN
    txt(inner, COPY.double.cta.en.toUpperCase(), {
      font: { family: "Inter", style: "Semi Bold" },
      size: 8.5,
      color: GOLD,
      textAlign: "CENTER",
      letterSpacing: 1.5,
      maxWidth: mm(160),
      x: rx((PAGE_W_MM - 160) / 2),
      y: ry(269),
      name: "CTA · EN (right)",
    });

    // CTA PT — italic
    txt(inner, COPY.double.cta.pt, {
      font: { family: "Inter", style: "Italic" },
      size: 7.5,
      color: GOLD,
      textAlign: "CENTER",
      letterSpacing: 0.4,
      maxWidth: mm(160),
      x: rx((PAGE_W_MM - 160) / 2),
      y: ry(274),
      opacity: 0.75,
      name: "CTA · PT (right)",
    });

    buildGuides({
      outer,
      innerOriginX: innerOX,
      innerOriginY: innerOY,
      trimW: mm(2 * PAGE_W_MM),
      trimH: mm(PAGE_H_MM),
      addCenterFold: true,
    });

    txt(outer, `Double · EN + PT  ·  ${2 * PAGE_W_MM}×${PAGE_H_MM} mm spread  ·  bleed ${BLEED_MM} mm`, {
      font: { family: "Inter", style: "Medium" },
      size: 9,
      color: { r: 0.3, g: 0.3, b: 0.3 },
      letterSpacing: 0.4,
      x: innerOX,
      y: mm(2),
      name: "Frame label",
    });

    return outer;
  }

  // ============================================================
  // ASSETS PAGE: organize uploads + write a Read me
  // ============================================================
  async function organizeAssetsPage(assets) {
    const KNOWN = new Set([
      "concierge", "detail", "discover", "golden-picks", "routes",
    ]);
    for (const s of SCREEN_KEYS) {
      KNOWN.add(`${s}-en`);
      KNOWN.add(`${s}-pt`);
    }
    for (const s of SINGLE_OVERRIDES) KNOWN.add(`${s}-${SCREEN_LOCALE}-single`);
    for (const p of PHOTO_KEYS) KNOWN.add(p);

    for (const page of figma.root.children) {
      if (page === assets) continue;
      for (const n of page.children.slice()) {
        if (KNOWN.has(n.name)) {
          assets.appendChild(n);
        }
      }
    }

    for (const n of assets.children.slice()) {
      if (KNOWN.has(n.name)) continue;
      n.remove();
    }

    txt(assets, "Goldenbook Go · Print Build", {
      font: { family: "Playfair Display", style: "SemiBold" },
      size: 36,
      color: NAVY,
      x: 0, y: 0,
      name: "Title",
    });
    txt(assets, "Bilingual single + double · reference assets and export instructions", {
      font: { family: "Inter", style: "Regular" },
      size: 13,
      color: MUTED,
      x: 0, y: mm(15),
      name: "Subtitle",
    });

    const readme = [
      "EXPORT TO PRINT (JPG 100% · 300 dpi · per editorial spec):",
      "  1. Select the [EXPORT] frame inside each [REFERENCE] wrapper.",
      "  2. Before export, hide the 'Guides' layer inside the REFERENCE frame.",
      "  3. In the Export panel set:",
      "       • Format  : JPG",
      "       • Quality : 100% (max)",
      "       • Scale   : 4.17×   (Figma is 72 dpi natively; 4.17× ≈ 300 dpi)",
      "       Or specify pixels directly:",
      "         · Single : 2492 × 3319 px",
      "         · Double : 4913 × 3319 px",
      "  4. The EXPORT frame already includes 3 mm bleed on all sides.",
      "",
      "FRAMES (one of each, bilingual EN + PT) — match editorial spec:",
      "  • Single  · trim 205 × 275 mm  ·  with bleed 211 × 281 mm",
      "  • Double  · trim 410 × 275 mm  ·  with bleed 416 × 281 mm",
      "",
      "REQUIRED IMAGES (drop into the file once with these exact layer names):",
      "  • cliff             — left page hero on the double spread",
      "  • beach             — top hero on the single",
      "  • discover-en       — main app screen (used in both layouts)",
      "  • routes-en         — secondary app screen (single)",
      "  • detail-en         — secondary app screen (double)",
      "  • detail-en-single  — secondary app screen (single, distinct from double)",
      "  • golden-picks-en   — reserved (kept for future variants)",
      "  • concierge-en      — reserved (kept for future variants)",
      "",
      "PT screen variants (-pt) are preserved on this page if loaded but the",
      "layouts use the EN screens as the canonical source.",
      "",
      "GUIDES (inside [REFERENCE] frame, hidden in PDF):",
      "  • Red dashed   = Bleed (3 mm)",
      "  • Black dashed = Trim",
      "  • Green dashed = Safe area (5 mm inside trim)",
      "  • Orange dashed (spread only) = Gutter safety (8 mm each side of spine)",
      "  • Gray dashed (spread only)   = Spine / fold",
      "  • Black filled small = Crop marks",
      "",
      "TO REPLACE THE QR:",
      "  • Click the 'QR placeholder' frame and paste the final QR code on top",
      "    (or replace its image fill). Encoded URL: " + QR_URL,
      "",
      "BILINGUAL TYPOGRAPHY HIERARCHY:",
      "  • EN is primary: Playfair SemiBold (display) / Inter Regular (body).",
      "  • PT (Portugal) is the editorial translation: Playfair Italic /",
      "    Inter Italic at smaller size and reduced opacity (~60–75%).",
      "  • A 0.4–0.6 pt gold hairline divides EN and PT in display copy.",
      "  • Eyebrow ('Goldenbook Go') and credit are not translated.",
      "",
      "EDITORIAL DUAL-SCRIM:",
      "  • Both heroes (single beach + double cliff) use a navy gradient",
      "    scrim at top and bottom to guarantee type contrast over any photo.",
      "  • The middle band stays clear so the photograph leads.",
      "",
      "FONTS:",
      "  • Display: Playfair Display (SemiBold, Italic, Regular)",
      "  • Text:    Inter (Regular, Italic, Medium, Semi Bold)",
      "",
      "CMYK:",
      "  • Figma exports JPG in sRGB. The prepress provider will convert to",
      "    CMYK from the supplied JPGs (Acrobat Pro, ICC profile, etc.).",
      "  • Navy and gold are already chosen to convert cleanly to CMYK.",
    ].join("\n");

    txt(assets, readme, {
      font: { family: "Inter", style: "Regular" },
      size: 11,
      color: NAVY_INK,
      lineHeight: 18,
      maxWidth: mm(180),
      x: 0, y: mm(28),
      name: "Read me",
    });

    // Layout: photos in a row, then app screens in a row below
    const PHOTO_W = 320;
    const PHOTO_H = 240;
    const SCREEN_W = 240;
    const SCREEN_H = 520;

    const rowYPhotos = mm(245);
    let cx = 0;
    for (const n of assets.children) {
      if (!PHOTO_KEYS.includes(n.name)) continue;
      try {
        n.resize(PHOTO_W, PHOTO_H);
        const fills = n.fills;
        if (fills && fills[0] && fills[0].type === "IMAGE") {
          n.fills = [Object.assign({}, fills[0], { scaleMode: "FILL" })];
        }
      } catch (e) { /* noop */ }
      n.x = cx;
      n.y = rowYPhotos;
      cx += PHOTO_W + 24;
    }

    const rowYScreens = rowYPhotos + PHOTO_H + 40;
    cx = 0;
    for (const n of assets.children) {
      const isScreen = SCREEN_KEYS.some((s) =>
        n.name === s ||
        n.name === `${s}-en` ||
        n.name === `${s}-pt` ||
        n.name === `${s}-${SCREEN_LOCALE}-single`
      );
      if (!isScreen) continue;
      try {
        n.resize(SCREEN_W, SCREEN_H);
        const fills = n.fills;
        if (fills && fills[0] && fills[0].type === "IMAGE") {
          n.fills = [Object.assign({}, fills[0], { scaleMode: "FIT" })];
        }
      } catch (e) { /* noop */ }
      n.x = cx;
      n.y = rowYScreens;
      cx += SCREEN_W + 24;
    }
  }

  // ============================================================
  // MAIN
  // ============================================================
  async function main() {
    figma.notify("Goldenbook · building print layouts…", { timeout: 1500 });
    await loadFonts();
    await figma.loadAllPagesAsync();

    const singles = figma.root.children.find((p) => p.name === "Singles · EN + PT");
    const doubles = figma.root.children.find((p) => p.name === "Doubles · EN + PT");
    const assets  = figma.root.children.find((p) => p.name === "Assets · Mockups + Read me");

    if (!singles || !doubles || !assets) {
      figma.notify("Required pages missing. Expected: 'Singles · EN + PT', 'Doubles · EN + PT', 'Assets · Mockups + Read me'.", { error: true, timeout: 6000 });
      figma.closePlugin();
      return;
    }

    // Discover image hashes BEFORE we wipe anything. Validation runs against
    // the file as-is so we never destroy a layout if something is missing.
    const hashMap = buildHashMap();
    const missing = missingRequired(hashMap);
    if (missing.length > 0) {
      figma.notify(
        `Missing image layers: ${missing.join(", ")}. Drop the matching PNGs into the file (cliff, beach, plus the EN screens from goldenbook-editorial/images/) and try again.`,
        { error: true, timeout: 9000 },
      );
      figma.closePlugin();
      return;
    }
    const singleScreens = pickScreens(hashMap, "single");
    const doubleScreens = pickScreens(hashMap, "double");

    // Move uploaded layers onto Assets so their imageHash refs survive the
    // page-wipe below.
    await figma.setCurrentPageAsync(assets);
    await organizeAssetsPage(assets);

    // Wipe Singles + Doubles
    for (const n of singles.children.slice()) n.remove();
    for (const n of doubles.children.slice()) n.remove();

    // Build the bilingual single
    await figma.setCurrentPageAsync(singles);
    const single = buildSingle({
      parent: singles,
      originX: 0,
      originY: 0,
      screens: singleScreens,
      photoHash: hashMap.beach,
    });

    // Build the bilingual double
    await figma.setCurrentPageAsync(doubles);
    const double = buildDouble({
      parent: doubles,
      originX: 0,
      originY: 0,
      screens: doubleScreens,
      photoHash: hashMap.cliff,
    });

    await figma.setCurrentPageAsync(singles);
    figma.viewport.scrollAndZoomIntoView([single]);

    figma.notify("Done · Bilingual Single + Double built (EN primary, PT translation).", { timeout: 4000 });
    figma.closePlugin();
  }

  try {
    await main();
  } catch (e) {
    console.error(e);
    figma.notify("Error: " + (e && e.message ? e.message : String(e)), { error: true, timeout: 6000 });
    figma.closePlugin();
  }
})();
