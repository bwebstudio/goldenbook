// Qué pasa cuando alguien toca la notificación.
//
// Dos cosas, y las dos importan:
//
//   1. Llevarle al plan, no a la portada. Una notificación que promete un
//      plan y deja al usuario buscándolo en la pantalla de inicio gasta la
//      confianza que se tardó semanas en ganar.
//   2. Avisar al servidor de que la abrió. Esto no es telemetría opcional:
//      es lo que pone a cero la racha de no abiertas. Sin este acuse, el
//      retroceso automático acabaría apagando a gente que sí las abre.

import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { apiClient } from '@/api/client';
import { track } from '@/analytics/track';
import { getPushToken } from './usePushRegistration';

// Con la app en primer plano no mostramos el aviso del sistema: la persona ya
// está dentro, y taparle la pantalla con lo que tiene delante es molesto.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
});

async function acknowledge() {
  const token = getPushToken();
  if (!token) return;
  try {
    await apiClient.post('/me/push/opened', { token });
  } catch {
    // Un acuse perdido solo cuesta una notificación de más en la racha.
  }
}

export function useNotificationHandler() {
  const router = useRouter();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { url?: string } | undefined;

      void acknowledge();
      track('now_used', { metadata: { surface: 'push', action: 'opened' } });

      // El backend manda "goldenbook://plan?city=lisboa". Nos quedamos con el
      // destino y lo resolvemos aquí en vez de confiar en el enlace profundo
      // del sistema, que en arranque en frío llega antes de que el router
      // esté montado.
      const url = data?.url ?? '';
      if (url.includes('plan')) {
        router.push('/(tabs)' as never);
      }
    });

    return () => sub.remove();
  }, [router]);
}
