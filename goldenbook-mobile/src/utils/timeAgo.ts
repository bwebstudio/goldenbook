// Tiny duration formatter for "Last updated …" labels. We don't pull in
// dayjs/luxon for this — three branches and a locale lookup is cheaper than
// shipping a whole i18n library client-side.

export type TimeAgoLocale = 'en' | 'es' | 'pt';

interface TimeAgoStrings {
  justNow: string;
  minutes: (n: number) => string;
  hours: (n: number) => string;
  days: (n: number) => string;
}

const STRINGS: Record<TimeAgoLocale, TimeAgoStrings> = {
  en: {
    justNow: 'just now',
    minutes: (n) => `${n} min ago`,
    hours:   (n) => (n === 1 ? '1 hour ago' : `${n} hours ago`),
    days:    (n) => (n === 1 ? '1 day ago'  : `${n} days ago`),
  },
  es: {
    justNow: 'hace un momento',
    minutes: (n) => `hace ${n} min`,
    hours:   (n) => (n === 1 ? 'hace 1 hora'   : `hace ${n} horas`),
    days:    (n) => (n === 1 ? 'hace 1 día'    : `hace ${n} días`),
  },
  pt: {
    justNow: 'agora mesmo',
    minutes: (n) => `há ${n} min`,
    hours:   (n) => (n === 1 ? 'há 1 hora'   : `há ${n} horas`),
    days:    (n) => (n === 1 ? 'há 1 dia'    : `há ${n} dias`),
  },
};

export function formatTimeAgo(updatedAtMs: number, locale: string): string {
  const key: TimeAgoLocale =
    locale.startsWith('es') ? 'es' :
    locale.startsWith('pt') ? 'pt' :
    'en';
  const strings = STRINGS[key];

  const diffMs = Math.max(0, Date.now() - updatedAtMs);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1)  return strings.justNow;
  if (minutes < 60) return strings.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return strings.hours(hours);
  const days = Math.floor(hours / 24);
  return strings.days(days);
}
