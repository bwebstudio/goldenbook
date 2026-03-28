import { View, Text } from 'react-native';
import { useTranslation } from '@/i18n';
import type { PlaceDetailDTO } from '../types';

type OpeningHour = PlaceDetailDTO['openingHours'][number];

function formatTime(t: string | null): string {
  if (!t) return '';
  // "HH:MM:SS" → "HH:MM"
  return t.slice(0, 5);
}

function isCurrentDay(dayOfWeek: number): boolean {
  return new Date().getDay() === dayOfWeek;
}

interface OpeningHoursSectionProps {
  openingHours: OpeningHour[];
}

export function OpeningHoursSection({ openingHours }: OpeningHoursSectionProps) {
  const t = useTranslation();
  const dayNames = [t.days.sun, t.days.mon, t.days.tue, t.days.wed, t.days.thu, t.days.fri, t.days.sat];

  if (!openingHours.length) return null;

  // Sort Mon→Sun (Mon=1 first, Sun=0 last)
  const sorted = [...openingHours].sort((a, b) => {
    const dayA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
    const dayB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
    return dayA - dayB;
  });

  return (
    <View className="px-5 pb-4">
      <Text className="text-xs font-semibold tracking-widest uppercase text-navy/40 mb-3">
        {t.place.openingHours}
      </Text>
      <View className="bg-ivory-soft rounded-2xl overflow-hidden">
        {sorted.map((h, idx) => {
          const isToday = isCurrentDay(h.dayOfWeek);
          return (
            <View
              key={`${h.dayOfWeek}-${h.opensAt ?? 'closed'}-${idx}`}
              className={`flex-row justify-between items-center px-4 py-2.5 ${
                idx < sorted.length - 1 ? 'border-b border-navy/5' : ''
              } ${isToday ? 'bg-primary/8' : ''}`}
            >
              <Text className={`text-sm ${isToday ? 'font-semibold text-navy' : 'text-navy/60'}`}>
                {dayNames[h.dayOfWeek]}
              </Text>
              {h.isClosed ? (
                <Text className="text-sm text-navy/30">{t.place.closed}</Text>
              ) : (
                <Text className={`text-sm ${isToday ? 'font-semibold text-primary' : 'text-navy/60'}`}>
                  {formatTime(h.opensAt)} – {formatTime(h.closesAt)}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
