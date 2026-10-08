// Registro del dispositivo para el ritual diario.
//
// El permiso NUNCA se pide solo. Igual que la ubicación, se pide cuando el
// usuario toca algo que lo justifica, y por el mismo motivo: la app no abre
// con un cuadro de sistema delante. `enablePush()` es la acción; la llaman la
// pantalla de Notificaciones y la invitación tras guardar la primera ficha.
//
// Lo que sí ocurre de forma automática es lo contrario: si el permiso YA está
// concedido de una sesión anterior, refrescamos el token en silencio. Expo lo
// reemite al reinstalar, y un token viejo es una notificación que se pierde.

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiClient } from '@/api/client';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';

/**
 * Android entrega las notificaciones a través de Firebase Cloud Messaging, y
 * Expo necesita el google-services.json del proyecto FCM dentro del binario.
 * Sin él, pedir el token falla y el ritual no puede llegar, así que en Android
 * no se ofrece hasta que app.json declare `android.googleServicesFile`. Al
 * añadirlo y recompilar, se activa solo. iOS usa APNs y no depende de esto.
 */
export const PUSH_SUPPORTED: boolean =
  Platform.OS !== 'android' || !!Constants.expoConfig?.android?.googleServicesFile;

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

async function sendToken(token: string): Promise<void> {
  currentToken = token;
  try {
    await apiClient.post('/me/push/register', {
      token,
      deviceType: Platform.OS === 'ios' ? 'ios' : 'android',
      locale: useSettingsStore.getState().locale,
      citySlug: useAppStore.getState().selectedCity,
    });
  } catch {
    // Que falle el registro no puede romper nada visible. Se reintenta en
    // el proximo arranque, que es cuando el refresco silencioso vuelve a correr.
  }
}

/**
 * Resultado de activar el ritual:
 *   - 'enabled'     permiso concedido y token registrado
 *   - 'denied'      el usuario dijo que no en el cuadro del sistema
 *   - 'blocked'     el sistema ya no deja preguntar: hay que ir a Ajustes
 *   - 'unavailable' sin token (simulador, sin red, sin FCM en Android)
 */
export type EnablePushResult = 'enabled' | 'denied' | 'blocked' | 'unavailable';

/**
 * Pide el permiso y registra el dispositivo. Llamar solo desde un gesto
 * explícito del usuario (el interruptor de Notificaciones o la invitación).
 */
export async function enablePush(): Promise<EnablePushResult> {
  if (!PUSH_SUPPORTED) return 'unavailable';
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;

  if (!granted) {
    if (!existing.canAskAgain) return 'blocked';
    const asked = await Notifications.requestPermissionsAsync();
    granted = asked.granted;
    if (!granted) return asked.canAskAgain ? 'denied' : 'blocked';
  }

  const token = await obtainToken();
  if (!token) return 'unavailable';
  await sendToken(token);
  useSettingsStore.getState().setPushOptIn(true);
  return 'enabled';
}

/** Deja de enviar el ritual a este dispositivo. El permiso del sistema no cambia. */
export async function disablePush(): Promise<void> {
  useSettingsStore.getState().setPushOptIn(false);
  const token = currentToken ?? (await obtainToken());
  if (!token) return;
  try {
    await apiClient.delete('/me/push/register', { data: { token } });
    currentToken = null;
  } catch {}
}

/** True si el sistema tiene concedido el permiso de notificaciones. */
export async function hasPushPermission(): Promise<boolean> {
  const perms = await Notifications.getPermissionsAsync();
  return perms.granted;
}

export function usePushRegistration() {
  const isAuthenticated = useAuthStore((s) => !!s.session);
  const settingsHydrated = useSettingsStore((s) => s.isHydrated);
  const pushOptIn = useSettingsStore((s) => s.pushOptIn);
  const registered = useRef(false);

  // Refresco silencioso: solo si ya hay permiso y sesión, y el usuario no
  // apagó el ritual desde la app. Nunca pide nada.
  useEffect(() => {
    if (!PUSH_SUPPORTED || !isAuthenticated || !settingsHydrated || pushOptIn === false || registered.current) return;
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
  }, [isAuthenticated, settingsHydrated, pushOptIn]);

  return { enable: enablePush, disable: disablePush };
}
