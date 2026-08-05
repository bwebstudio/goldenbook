// Dejar una ruta guardada disponible sin conexión.
//
// La mitad del trabajo ya estaba hecha: `useRouteDetail` está marcada como
// `cacheable`, así que el persister de React Query guarda en disco cualquier
// ruta que el usuario haya abierto, y sobrevive al cierre de la app.
//
// El hueco era la ruta guardada y nunca abierta. Alguien marca una ruta en el
// hotel con wifi, sale a la calle sin datos y se encuentra una pantalla vacía,
// que es justo el momento en que más la necesita.
//
// Esto lo cierra por lo barato: al guardar, se pide el detalle una vez y se
// deja en la caché persistida. Sin descarga de imágenes, sin gestión de disco
// y sin política de expiración propia, porque el persister ya tiene la suya.
// Las fotos seguirán necesitando conexión; los nombres, horarios, direcciones,
// coordenadas y textos, que es lo que hace falta para seguir una ruta a pie,
// no.

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '@/store/settingsStore';
import { useNetworkStore } from '@/store/networkStore';
import { routesApi } from '../api';
import { ROUTE_DETAIL_QUERY_KEY } from './useRouteDetail';

export function usePrefetchRouteOffline() {
  const queryClient = useQueryClient();
  const locale = useSettingsStore((s) => s.locale);

  return useCallback(
    async (slug: string | undefined) => {
      if (!slug) return;
      // Sin conexión no hay nada que traer, y el guardado ya se encola aparte.
      if (!useNetworkStore.getState().isOnline) return;

      try {
        await queryClient.prefetchQuery({
          queryKey: ROUTE_DETAIL_QUERY_KEY(slug, locale),
          queryFn: () => routesApi.getRoute(slug, locale),
          staleTime: 1000 * 60 * 15,
          meta: { cacheable: true },
        });
      } catch {
        // Que falle la descarga anticipada no puede romper el guardado. La
        // ruta queda guardada igual; simplemente necesitará conexión la
        // primera vez que se abra.
      }
    },
    [queryClient, locale],
  );
}
