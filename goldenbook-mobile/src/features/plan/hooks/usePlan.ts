// El plan solo se pide cuando hay coordenadas de verdad.
//
// La app nunca pide permiso de ubicación por su cuenta (política de Apple
// Review y decisión de producto), así que muchos usuarios no lo han dado. Sin
// coordenadas no hay orden de paseo posible, y adivinar desde el centro de la
// ciudad pondría las paradas a una distancia desconocida de quien las lee. Por
// eso la consulta queda desactivada en lugar de pedir con datos inventados.

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useLocationStore } from '@/store/locationStore';
import { fetchPlan, type PlanResult } from '../api';

export const PLAN_QUERY_KEY = (city: string, lat: number, lon: number, locale: string) =>
  ['plan', city, lat.toFixed(3), lon.toFixed(3), locale] as const;

export function usePlan() {
  const city = useAppStore((s) => s.selectedCity);
  const locale = useSettingsStore((s) => s.locale);
  const coordinates = useLocationStore((s) => s.coordinates);

  const query = useQuery<PlanResult>({
    queryKey: PLAN_QUERY_KEY(city, coordinates?.latitude ?? 0, coordinates?.longitude ?? 0, locale),
    queryFn: () => fetchPlan(city, coordinates!.latitude, coordinates!.longitude, locale),
    enabled: Boolean(city && coordinates),
    // El plan depende de qué está abierto ahora mismo, así que envejece rápido.
    // Diez minutos es el punto donde deja de merecer la pena refrescar sin que
    // llegue a proponer sitios que ya han cerrado.
    staleTime: 10 * 60 * 1000,
    // Un fallo aquí no puede tumbar Discover: sin plan, la pantalla sigue.
    retry: 1,
  });

  const result = query.data ?? { kind: 'none' as const };

  return {
    plan: result.kind === 'plan' ? result.plan : null,
    /** Otro destino cubierto donde el usuario sí está. */
    suggestion: result.kind === 'suggestion' ? result.suggestion : null,
    isLoading: query.isLoading,
    hasLocation: Boolean(coordinates),
    refetch: query.refetch,
  };
}
