// Two asks the app makes of the user, both tied to a moment that went well
// (a place saved, a route finished) rather than to app launch:
//
//   1. The 18:00 ritual invite, once, after the first save. Saving a place is
//      the clearest sign the user wants ideas for later, which is what the
//      ritual sends. The system permission dialog only follows a "yes".
//   2. The store review prompt, from the third positive moment on, at most
//      once every 120 days. Apple and Google also rate-limit it and may show
//      nothing; we never learn whether it appeared, so we don't retry.
//
// Never both in the same moment: one dialog per good moment is the limit.
// Opt-in is measured server side: push_tokens has one row per enabled device.

import { Alert } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { enablePush, hasPushPermission, PUSH_SUPPORTED } from '@/features/push';
import { getTranslations } from '@/i18n';

type PositiveMoment = 'save' | 'route_complete';

const REVIEW_AFTER_MOMENTS = 3;
const REVIEW_COOLDOWN_DAYS = 120;
// Let the save animation or the completion screen land first.
const PROMPT_DELAY_MS = 700;

export function onPositiveMoment(kind: PositiveMoment): void {
  const settings = useSettingsStore.getState();
  if (!settings.isHydrated || !useAuthStore.getState().session) return;

  const moments = settings.addPositiveMoment();

  setTimeout(() => {
    void (async () => {
      if (kind === 'save' && (await maybeInviteToRitual())) return;
      if (moments >= REVIEW_AFTER_MOMENTS) await maybeAskForReview();
    })();
  }, PROMPT_DELAY_MS);
}

/** Returns true if the invite was shown (so no other dialog follows). */
async function maybeInviteToRitual(): Promise<boolean> {
  if (!PUSH_SUPPORTED) return false;
  const settings = useSettingsStore.getState();
  if (settings.pushOptIn !== null || settings.pushPromptedAt) return false;

  // Permission granted in an earlier version or from Settings: the silent
  // refresh already registers this device, so there is nothing to ask.
  if (await hasPushPermission()) {
    settings.setPushOptIn(true);
    return false;
  }

  settings.markPushPrompted();
  const t = getTranslations().pushInvite;

  Alert.alert(t.title, t.body, [
    { text: t.notNow, style: 'cancel', onPress: () => settings.setPushOptIn(false) },
    { text: t.accept, onPress: () => void enablePush() },
  ]);
  return true;
}

async function maybeAskForReview(): Promise<void> {
  const settings = useSettingsStore.getState();
  if (settings.reviewPromptedAt) {
    const days = (Date.now() - Date.parse(settings.reviewPromptedAt)) / 86_400_000;
    if (days < REVIEW_COOLDOWN_DAYS) return;
  }

  try {
    if (!(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return;
    settings.markReviewPrompted();
    await StoreReview.requestReview();
  } catch (err) {
    if (__DEV__) console.warn('[review] request failed:', err);
  }
}
