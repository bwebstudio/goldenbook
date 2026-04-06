// ─── Intent Engine ────────────────────────────────────────────────────────
// Translates natural language queries into structured recommendation inputs.
//
// Examples:
//   "algo romántico para esta noche" → { intent: 'romantic', budget: '€€€' }
//   "un sitio tranquilo para almorzar" → { intent: 'lunch', mood: 'relax' }
//   "algo especial con vistas" → { intent: 'viewpoint', budget: '€€€' }
//   "where to have dinner nearby" → { intent: 'dinner' }

export interface ParsedIntent {
  intent: string | null
  budget: string | null         // €, €€, €€€, €€€€
  category: string | null       // gastronomy, culture, etc.
  mood: string | null           // relax, energy, romantic, family
  timeHint: string | null       // morning, lunch, afternoon, evening, night
}

// ─── Keyword → intent mapping ─────────────────────────────────────────────

const INTENT_KEYWORDS: { keywords: string[]; intent: string }[] = [
  // Dining
  { keywords: ['dinner', 'jantar', 'cena', 'cenar'],                    intent: 'dinner' },
  { keywords: ['lunch', 'almoço', 'almorzar', 'almuerzo'],              intent: 'lunch' },
  { keywords: ['breakfast', 'pequeno-almoço', 'desayuno', 'pequeno almoço'], intent: 'breakfast' },
  { keywords: ['brunch'],                                                intent: 'brunch' },
  { keywords: ['fine dining', 'fine-dining', 'gourmet', 'michelin'],     intent: 'fine-dining' },

  // Drinks
  { keywords: ['drinks', 'bebidas', 'cocktail', 'cocktails', 'copas'],   intent: 'drinks' },
  { keywords: ['wine', 'vinho', 'vino'],                                 intent: 'wine' },
  { keywords: ['late night', 'night out', 'madrugada'],                    intent: 'late-night' },

  // Romance & occasion (must be before 'late-night' to win priority for "romántico para esta noche")
  { keywords: ['romantic', 'romântico', 'romántico', 'romance'],          intent: 'romantic' },
  { keywords: ['celebration', 'celebração', 'celebración', 'birthday', 'aniversário', 'anniversary'], intent: 'celebration' },

  // Culture
  { keywords: ['culture', 'cultura', 'museum', 'museu', 'museo', 'gallery', 'galeria'], intent: 'culture' },

  // Nature
  { keywords: ['sunset', 'pôr do sol', 'puesta de sol', 'sol'],          intent: 'sunset' },
  { keywords: ['beach', 'praia', 'playa'],                               intent: 'beach' },
  { keywords: ['viewpoint', 'miradouro', 'mirador', 'vista', 'vistas'],  intent: 'viewpoint' },
  { keywords: ['walk', 'passeio', 'pasear', 'stroll', 'caminhada'],      intent: 'walk' },

  // Other
  { keywords: ['shopping', 'compras', 'comprar', 'lojas', 'tiendas', 'ropa', 'roupa'], intent: 'shopping' },
  { keywords: ['wellness', 'spa', 'bem-estar', 'bienestar', 'relax'],    intent: 'wellness' },
  { keywords: ['family', 'família', 'familia', 'kids', 'crianças', 'niños'], intent: 'family' },
  { keywords: ['rain', 'rainy', 'chuva', 'lluvia', 'indoor'],            intent: 'rainy-day' },
  { keywords: ['hidden gem', 'secret', 'segredo', 'secreto', 'hidden'],  intent: 'hidden-gem' },
]

// ─── Budget signals ───────────────────────────────────────────────────────

const BUDGET_KEYWORDS: { keywords: string[]; budget: string }[] = [
  { keywords: ['cheap', 'barato', 'económico', 'budget', 'económica'],    budget: '€' },
  { keywords: ['moderate', 'moderado', 'medio', 'reasonable'],            budget: '€€' },
  { keywords: ['upscale', 'elegante', 'nice', 'special', 'especial'],     budget: '€€€' },
  { keywords: ['luxury', 'luxo', 'lujo', 'premium', 'exclusive'],         budget: '€€€€' },
  { keywords: ['fine dining', 'fine-dining', 'gourmet', 'michelin'],       budget: '€€€€' },
  { keywords: ['romantic', 'romântico', 'romántico', 'celebration'],       budget: '€€€' },
]

// ─── Category signals ─────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: { keywords: string[]; category: string }[] = [
  { keywords: ['restaurant', 'restaurante', 'eat', 'comer', 'food', 'comida', 'dining',
                'dinner', 'jantar', 'cenar', 'lunch', 'almoco', 'almorzar', 'breakfast', 'brunch'], category: 'gastronomy' },
  { keywords: ['bar', 'pub', 'club', 'nightclub'],                         category: 'gastronomy' },
  { keywords: ['cafe', 'café', 'coffee', 'cafeteria'],                     category: 'gastronomy' },
  { keywords: ['museum', 'museu', 'museo', 'gallery', 'galeria', 'monument', 'church'], category: 'culture' },
  { keywords: ['beach', 'praia', 'playa', 'park', 'parque', 'garden', 'jardim', 'viewpoint', 'miradouro'], category: 'natureza-outdoor' },
  { keywords: ['hotel', 'stay', 'sleep', 'dormir', 'accommodation'],       category: 'alojamento' },
  { keywords: ['shop', 'shopping', 'compras', 'comprar', 'store', 'loja', 'tienda', 'market', 'mercado', 'ropa', 'roupa'], category: 'retail' },
  { keywords: ['spa', 'wellness', 'tour', 'excursion', 'activity', 'sport'], category: 'experiences' },
]

// ─── Mood signals ─────────────────────────────────────────────────────────

const MOOD_KEYWORDS: { keywords: string[]; mood: string }[] = [
  { keywords: ['relax', 'relaxar', 'relajar', 'tranquilo', 'calm', 'quiet', 'peaceful', 'sossegado'], mood: 'relax' },
  { keywords: ['energy', 'energía', 'fun', 'divertido', 'animado', 'lively', 'vibrant'],              mood: 'energy' },
  { keywords: ['romantic', 'romântico', 'love', 'couple', 'casal', 'pareja', 'date'],                  mood: 'romantic' },
  { keywords: ['family', 'família', 'kids', 'children', 'crianças'],                                   mood: 'family' },
]

// ─── Time signals ─────────────────────────────────────────────────────────

const TIME_KEYWORDS: { keywords: string[]; timeHint: string }[] = [
  { keywords: ['morning', 'manhã', 'mañana', 'early'],                   timeHint: 'morning' },
  { keywords: ['lunch', 'almoço', 'almuerzo', 'midday', 'noon'],         timeHint: 'lunch' },
  { keywords: ['afternoon', 'tarde'],                                      timeHint: 'afternoon' },
  { keywords: ['evening', 'tonight', 'esta noite', 'esta noche', 'noite', 'noche'], timeHint: 'evening' },
  { keywords: ['night', 'late', 'madrugada', 'midnight'],                 timeHint: 'night' },
]

// ─── Parser ───────────────────────────────────────────────────────────────

function matchKeywords(text: string, groups: { keywords: string[]; [key: string]: unknown }[]): string | null {
  for (const group of groups) {
    for (const kw of group.keywords) {
      if (text.includes(kw.toLowerCase())) {
        // Return the first non-keywords key's value
        const keys = Object.keys(group).filter(k => k !== 'keywords')
        return group[keys[0]] as string
      }
    }
  }
  return null
}

export function parseIntent(query: string): ParsedIntent {
  const text = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

  return {
    intent:   matchKeywords(text, INTENT_KEYWORDS),
    budget:   matchKeywords(text, BUDGET_KEYWORDS),
    category: matchKeywords(text, CATEGORY_KEYWORDS),
    mood:     matchKeywords(text, MOOD_KEYWORDS),
    timeHint: matchKeywords(text, TIME_KEYWORDS),
  }
}

// ─── Mood → intent refinement ─────────────────────────────────────────────
// When mood is detected but no explicit intent, derive a reasonable intent.

const MOOD_DEFAULT_INTENT: Record<string, string> = {
  relax:    'wellness',
  energy:   'drinks',
  romantic: 'romantic',
  family:   'family',
}

export function resolveIntent(parsed: ParsedIntent): {
  intent: string | undefined
  budget: string | undefined
  category: string | undefined
} {
  let intent = parsed.intent ?? undefined

  // Mood fallback
  if (!intent && parsed.mood) {
    intent = MOOD_DEFAULT_INTENT[parsed.mood]
  }

  // Time-based fallback
  if (!intent && parsed.timeHint) {
    switch (parsed.timeHint) {
      case 'morning': intent = 'breakfast'; break
      case 'lunch':   intent = 'lunch'; break
      case 'afternoon': break  // too generic — no intent
      case 'evening': intent = 'dinner'; break
      case 'night':   intent = 'late-night'; break
    }
  }

  return {
    intent,
    budget: parsed.budget ?? undefined,
    category: parsed.category ?? undefined,
  }
}
