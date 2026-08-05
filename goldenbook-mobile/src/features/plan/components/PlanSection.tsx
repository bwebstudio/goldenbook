// Plan de esta noche.
//
// Tres paradas caminables, en orden, con lo que se tarda entre una y otra y
// hasta qué hora aguanta cada sitio. La auditoría del 5 de agosto encontró que
// 2.272 usuarios reciben una recomendación y solo 225 abren la ficha: el
// descubrimiento llega, pero una sugerencia suelta no basta para salir de
// casa. Una secuencia sí, porque ya responde la pregunta siguiente.
//
// Reglas de la sección:
//
//   • Si no hay plan, no se dibuja nada. Nunca un esqueleto vacío ni un
//     "no hay planes disponibles", que es peor que el silencio.
//   • Sin permiso de ubicación se ofrece activarla, con el motivo delante.
//     La app no pide permisos por su cuenta en ningún momento.
//   • Las horas de cierre vienen de datos reales; el backend excluye
//     cualquier sitio del que no tengamos horario.

import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { useTranslation } from '@/i18n';
import { useLocationStore } from '@/store/locationStore';
import { useAppStore } from '@/store/appStore';
import { openPlace } from '@/features/place-detail/openPlace';
import { track } from '@/analytics/track';
import { usePlan } from '../hooks/usePlan';
import { sharePlan } from '../share';
import { useSettingsStore } from '@/store/settingsStore';
import type { PlanStop } from '../api';

const GOLD = '#D2B68A';
const NAVY = '#222D52';

export function PlanSection() {
  const router = useRouter();
  const t = useTranslation();
  const { plan, suggestion, isLoading, hasLocation } = usePlan();
  const completeLocalitySelection = useAppStore((s) => s.completeLocalitySelection);
  const locale = useSettingsStore((s) => s.locale);

  const permission = useLocationStore((s) => s.permission);
  const requestPermission = useLocationStore((s) => s.requestPermission);
  const fetchPosition = useLocationStore((s) => s.fetchPosition);
  const [requesting, setRequesting] = useState(false);

  // Sin ubicación: invitación, no bloqueo. Si ya la denegó, no insistimos.
  if (!hasLocation) {
    if (permission === 'denied') return null;
    return (
      <PlanFrame t={t}>
        <Text style={{ color: 'rgba(255,255,255,0.66)', fontSize: 12.5, lineHeight: 19, marginBottom: 14 }}>
          {(t.plan as any)?.locationPitch ??
            'Activa la ubicación y te armamos tres paradas a un paseo de donde estás.'}
        </Text>
        <TouchableOpacity
          onPress={async () => {
            setRequesting(true);
            const result = await requestPermission();
            if (result === 'granted') await fetchPosition();
            setRequesting(false);
          }}
          disabled={requesting}
          activeOpacity={0.85}
          style={{
            alignSelf: 'flex-start', backgroundColor: GOLD,
            borderRadius: 8, paddingHorizontal: 18, paddingVertical: 11,
          }}
        >
          {requesting ? (
            <ActivityIndicator size="small" color={NAVY} />
          ) : (
            <Text style={{ color: NAVY, fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' }}>
              {(t.plan as any)?.enableLocation ?? 'Activar ubicación'}
            </Text>
          )}
        </TouchableOpacity>
      </PlanFrame>
    );
  }

  if (isLoading) {
    return (
      <PlanFrame t={t}>
        <ActivityIndicator size="small" color={GOLD} />
      </PlanFrame>
    );
  }

  // El usuario está en otra ciudad que sí cubrimos. Ofrecemos cambiar en vez
  // de desaparecer: el plan existe, solo que en otro destino.
  if (suggestion) {
    return (
      <PlanFrame t={t}>
        <Text style={{ color: 'rgba(255,255,255,0.66)', fontSize: 12.5, lineHeight: 19, marginBottom: 14 }}>
          {((t.plan as any)?.wrongCity ?? 'Parece que estás en {city}. Cambia de destino y te armamos el plan de aquí.')
            .replace('{city}', suggestion.cityName)}
        </Text>
        <TouchableOpacity
          onPress={() => {
            track('now_used', { metadata: { surface: 'plan', action: 'switch_city', to: suggestion.citySlug } });
            completeLocalitySelection(suggestion.citySlug);
          }}
          activeOpacity={0.85}
          style={{ alignSelf: 'flex-start', backgroundColor: GOLD, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 11 }}
        >
          <Text style={{ color: NAVY, fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' }}>
            {((t.plan as any)?.switchTo ?? 'Cambiar a {city}').replace('{city}', suggestion.cityName)}
          </Text>
        </TouchableOpacity>
      </PlanFrame>
    );
  }

  // Sin plan posible a esta hora y en esta zona. Silencio.
  if (!plan || plan.stops.length === 0) return null;

  return (
    <PlanFrame
      t={t}
      subtitle={(t.plan as any)?.summary
        ?.replace('{stops}', String(plan.stops.length))
        ?.replace('{min}', String(plan.totalWalkMinutes))
        ?? `${plan.stops.length} paradas, ${plan.totalWalkMinutes} min andando en total`}
    >
      <View style={{ marginTop: 4 }}>
        {plan.stops.map((stop, i) => (
          <PlanStopRow
            key={stop.placeId}
            stop={stop}
            index={i}
            isLast={i === plan.stops.length - 1}
            t={t}
            onPress={() => {
              track('now_used', {
                placeId: stop.placeId,
                metadata: { surface: 'plan', position: i + 1, stops: plan.stops.length },
              });
              openPlace(router, stop.slug, { source: 'plan', placeId: stop.placeId, rank: i + 1 });
            }}
          />
        ))}
      </View>

      {/* Compartir: el enlace lleva a una página real con la secuencia, no a
          la ficha de la App Store como el resto de compartires de la app. */}
      <TouchableOpacity
        onPress={async () => {
          const shared = await sharePlan({
            plan,
            locale,
            strings: {
              headline: (t.plan as any)?.shareHeadline,
              footer: (t.plan as any)?.shareFooter,
            },
          });
          if (shared) {
            track('now_used', {
              metadata: { surface: 'plan', action: 'share', stops: plan.stops.length },
            });
          }
        }}
        activeOpacity={0.7}
        style={{
          marginTop: 18, paddingTop: 14, borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.08)',
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}
      >
        <Ionicons name="share-outline" size={13} color={GOLD} />
        <Text style={{ color: GOLD, fontSize: 10, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' }}>
          {(t.plan as any)?.share ?? 'Compartir plan'}
        </Text>
      </TouchableOpacity>
    </PlanFrame>
  );
}

// ─── Marco ──────────────────────────────────────────────────────────────────

function PlanFrame({ t, subtitle, children }: { t: any; subtitle?: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        marginHorizontal: 24, marginTop: 8, marginBottom: 4,
        backgroundColor: NAVY, borderRadius: 16, padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18, shadowRadius: 20, elevation: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: subtitle ? 4 : 12 }}>
        <View style={{ width: 20, height: 1, backgroundColor: GOLD }} />
        <Text style={{ color: GOLD, fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
          {(t.plan as any)?.eyebrow ?? 'Tu plan de hoy'}
        </Text>
      </View>
      {subtitle ? (
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 14 }}>{subtitle}</Text>
      ) : null}
      {children}
    </View>
  );
}

// ─── Parada ─────────────────────────────────────────────────────────────────

function PlanStopRow({
  stop, index, isLast, t, onPress,
}: { stop: PlanStop; index: number; isLast: boolean; t: any; onPress: () => void }) {
  const imageUrl = getStorageUrl(stop.heroImage.bucket, stop.heroImage.path, 'thumb');

  return (
    <View>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        {/* Número de parada, que es lo que convierte una lista en un recorrido */}
        <View
          style={{
            width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: GOLD,
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Text style={{ color: GOLD, fontSize: 11, fontWeight: '700' }}>{index + 1}</Text>
        </View>

        <View style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
          <ProgressiveImage uri={imageUrl} height={52} borderRadius={10} placeholderColor="#161E38" style={{ width: 52 }} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>
            {stop.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10.5 }}>
              {(t.plan as any)?.walkLeg?.replace('{min}', String(stop.legWalkMinutes))
                ?? `${stop.legWalkMinutes} min a pie`}
            </Text>
            <View style={{ width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: 'rgba(255,255,255,0.3)' }} />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10.5 }}>
              {(t.plan as any)?.until?.replace('{time}', stop.closesAt) ?? `hasta las ${stop.closesAt}`}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.28)" />
      </TouchableOpacity>

      {/* Línea que une una parada con la siguiente: el paseo, dibujado */}
      {!isLast && (
        <View style={{ height: 18, marginLeft: 13, borderLeftWidth: 1, borderLeftColor: 'rgba(210,182,138,0.28)' }} />
      )}
    </View>
  );
}
