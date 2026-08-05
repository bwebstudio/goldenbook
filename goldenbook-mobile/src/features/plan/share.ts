// Compartir el itinerario.
//
// El plan no vive en ninguna tabla: se calcula a partir de dónde está el
// usuario y de qué hora es. Para compartirlo no hace falta guardarlo, basta
// con llevar los slugs en la URL. Sin almacenamiento, sin identificadores que
// caduquen y sin trabajo de backend.
//
// A diferencia de compartir una ficha suelta, aquí el enlace sí lleva a una
// página real: /es/plan?s=slug1,slug2,slug3 en goldenbook.app, que renderiza
// la secuencia con la marca y con vista previa decente al pegarlo.
//
// Lo que el mensaje NO incluye son las distancias ni los minutos a pie. Se
// calcularon desde donde estaba quien comparte, y para quien lo recibe serían
// falsos. Se comparte el orden, que es lo que se sostiene fuera de contexto.

import { Share, Platform } from 'react-native';
import type { Plan } from './api';

const WEB_BASE = 'https://goldenbook.app';

interface SharePlanOptions {
  plan: Plan;
  locale: string;
  /** Copy ya traducido, para no acoplar este helper al sistema de i18n. */
  strings?: {
    /** Encabezado del mensaje. */
    headline?: string;
    /** Cierre antes del enlace. */
    footer?: string;
  };
}

export function buildPlanUrl(plan: Plan, locale: string): string {
  const slugs = plan.stops.map((s) => s.slug).join(',');
  const lang = ['es', 'pt', 'en'].includes(locale) ? locale : 'en';
  return `${WEB_BASE}/${lang}/plan?s=${encodeURIComponent(slugs)}`;
}

export async function sharePlan({ plan, locale, strings }: SharePlanOptions): Promise<boolean> {
  const url = buildPlanUrl(plan, locale);

  const headline = strings?.headline ?? 'Un plan para hoy';
  const footer = strings?.footer ?? 'Visto en Goldenbook Go';

  // Numerado, para que el orden se lea igual en un chat que en la app.
  const list = plan.stops.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
  const message = `${headline}\n\n${list}\n\n${footer}\n${url}`;

  try {
    const result = await Share.share(
      Platform.select({
        // iOS separa mensaje y enlace: así la vista previa la genera el
        // sistema a partir de la url en vez de quedar como texto plano.
        ios: { message: `${headline}\n\n${list}\n\n${footer}`, url },
        default: { message, title: headline },
      })!,
      { dialogTitle: headline },
    );
    return result.action === Share.sharedAction;
  } catch {
    // Cancelar o fallar al compartir no es un error que deba verse en la UI.
    return false;
  }
}
