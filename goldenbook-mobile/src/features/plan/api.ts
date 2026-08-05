// Plan de esta noche: acceso a la API.
//
// El backend responde 204 cuando no puede armar un plan honesto: sin
// coordenadas, sin ciudad, o sin sitios suficientes abiertos y lo bastante
// cerca unos de otros. Eso no es un error, es una respuesta legítima, y aquí
// se traduce a `null` para que la pantalla no dibuje nada en lugar de mostrar
// un hueco roto o un plan de mentira.

import { apiClient } from '@/api/client';

export interface PlanStop {
  placeId: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  category: string | null;
  heroImage: { bucket: string | null; path: string | null };
  /** Metros desde la parada anterior, o desde el usuario en la primera. */
  legMetres: number;
  legWalkMinutes: number;
  /** Hora "HH:MM" a la que cierra hoy. El backend garantiza que no es nula. */
  closesAt: string;
}

export interface Plan {
  city: string;
  stops: PlanStop[];
  totalMetres: number;
  totalWalkMinutes: number;
}

/**
 * Cuando el destino seleccionado no da plan pero el usuario está de hecho en
 * otro que sí cubrimos. Pasa con quien tiene Lisboa puesta y está en Porto:
 * había un plan a doscientos metros y la sección desaparecía sin decir nada.
 */
export interface PlanCitySuggestion {
  citySlug: string;
  cityName: string;
  distanceKm: number;
}

export type PlanResult =
  | { kind: 'plan'; plan: Plan }
  | { kind: 'suggestion'; suggestion: PlanCitySuggestion }
  | { kind: 'none' };

export async function fetchPlan(
  city: string,
  latitude: number,
  longitude: number,
  locale: string,
): Promise<PlanResult> {
  const res = await apiClient.get<Plan | { suggestion: PlanCitySuggestion } | ''>('/plan', {
    params: { city, lat: latitude, lon: longitude, locale },
    // 204 llega sin cuerpo; axios lo entrega como cadena vacía.
    validateStatus: (s) => s === 200 || s === 204,
  });
  if (res.status === 204 || !res.data) return { kind: 'none' };
  const body = res.data as Plan | { suggestion: PlanCitySuggestion };
  if ('suggestion' in body) return { kind: 'suggestion', suggestion: body.suggestion };
  return { kind: 'plan', plan: body };
}
