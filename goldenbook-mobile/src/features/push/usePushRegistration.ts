// Registro del dispositivo para el ritual diario.
//
// El permiso NUNCA se pide solo. Igual que la ubicación, se pide cuando el
// usuario toca algo que lo justifica, y por el mismo motivo: la app no abre
// con un cuadro de sistema delante. Este hook expone la acción; quien decide
// cuándo llamarla es la pantalla.
//
// Lo que sí ocurre de forma automática es lo contrario: si el permiso YA está
// concedido de una sesión anterior, refrescamos el token en silencio. Expo lo
// reemite al reinstalar, y un token viejo es una notificación que se pierde.

import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiClient } from '@/api/client';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';

/** Token vivo en memoria, para el acuse de apertura. */
let currentToken: string | null = null;

export function getPushToken(): string | null {
  return currentToken;
}

async function obtainToken(): Promise<string | null> {
  // Un simulador no recibe push. Pedirlo ahí solo produce un error confuso.
  if (!Device.isDevice) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return data ?? null;
  } catch {
    return null;
  }
}

export function usePushRegistration() {
  const city = useAppStore((s) => s.selectedCity);
  const locale = useSettingsStore((s) => s.locale);
  const isAuthenticated = useAuthStore((s) => !!s.session);
  const registered = useRef(false);

  const sendToken = useCallback(
    async (token: string) => {
      currentToken = token;
      try {
        await apiClient.post('/me/push/register', {
          token,
          deviceType: Platform.OS === 'ios' ? 'ios' : 'android',
          locale,
          citySlug: city,
        });
      } catch {
        // Que falle el registro no puede romper nada visible. Se reintenta en
        // el proximo arranque, que es cuando este efecto vuelve a correr.
      }
    },
    [city, locale],
  );

  /**
   * Pide el permiso. Llamar solo desde un gesto explícito del usuario.
   * Devuelve true si a partir de ahora recibirá el ritual diario.
   */
  const enable = useCallback(async (): Promise<boolean> => {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;

    if (!granted && existing.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return false;

    const token = await obtainToken();
    if (!token) return false;
    await sendToken(token);
    return true;
  }, [sendToken]);

  const disable = useCallback(async () => {
    if (!currentToken) return;
    try {
      await apiClient.delete('/me/push/register', { data: { token: currentToken } });
    } catch {}
  }, []);

  // Refresco silencioso: solo si ya hay permiso y sesión. Nunca pide nada.
  useEffect(() => {
    if (!isAuthenticated || registered.current) return;
    let cancelled = false;

    (async () => {
      const perms = await Notifications.getPermissionsAsync();
      if (!perms.granted || cancelled) return;
      const token = await obtainToken();
      if (!token || cancelled) return;
      registered.current = true;
      await sendToken(token);
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, sendToken]);

  return { enable, disable };
}
