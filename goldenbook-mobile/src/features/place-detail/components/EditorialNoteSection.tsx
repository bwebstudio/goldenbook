import { View, Text } from 'react-native';
import { useTranslation } from '@/i18n';

interface EditorialNoteSectionProps {
  /**
   * Editorial note from the Goldenbook team — sourced from admin dashboard.
   * Field: places.goldenbook_note (backend)
   * Falls back to placeholder if null.
   */
  goldenbookNote: string | null;
  /**
   * Insider tip from editors — sourced from admin dashboard.
   * Field: places.insider_tip (backend)
   * Falls back to placeholder if null.
   */
  insiderTip: string | null;
}

export function EditorialNoteSection({
  goldenbookNote,
  insiderTip,
}: EditorialNoteSectionProps) {
  const t = useTranslation();
  // Resolve content: prefer backend data, fall back to locale-aware placeholder.
  // TODO: Once backend consistently populates these fields, the placeholders
  //       can be removed and this section can be made conditional again.
  const perspectiveText = goldenbookNote ?? t.place.goldenbookNotePlaceholder;
  const insiderTipText = insiderTip ?? t.place.insiderTipPlaceholder;

  return (
    <View className="px-8 mt-8 gap-16">
      {/* ── The Goldenbook Perspective ──────────────────────────────────────
          Content source: places.goldenbook_note (admin dashboard)
          Fallback: PLACEHOLDER_GOLDENBOOK_NOTE (demo)
      ─────────────────────────────────────────────────────────────────── */}
      <View className="relative">
        {/* Decorative quote mark */}
        <Text
          className="absolute text-6xl text-primary/10 font-bold select-none"
          style={{ top: -16, left: -8, fontFamily: 'PlayfairDisplay_700Bold', lineHeight: 48 }}
          aria-hidden
        >
          "
        </Text>

        <View className="pt-4">
          <Text className="text-[10px] font-bold text-primary uppercase tracking-widest mb-6">
            {t.place.goldenbookPerspective}
          </Text>

          <View
            className="pl-8 py-2"
            style={{ borderLeftWidth: 1, borderLeftColor: 'rgba(210,182,138,0.35)' }}
          >
            <Text
              className="text-navy text-xl leading-relaxed"
              style={{ fontFamily: 'PlayfairDisplay_400Regular_Italic' }}
            >
              "{perspectiveText}"
            </Text>

            <View className="flex-row items-center gap-3 mt-6">
              <View className="h-px w-8 bg-primary/40" />
              <Text className="text-[10px] font-bold text-navy/40 uppercase tracking-widest">
                {t.place.editorialStaff}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Insider Tip ────────────────────────────────────────────────────
          Content source: places.insider_tip (admin dashboard)
          Fallback: PLACEHOLDER_INSIDER_TIP (demo)
      ─────────────────────────────────────────────────────────────────── */}
      <View
        className="p-6 rounded-2xl gap-4"
        style={{
          backgroundColor: '#F9F7F2',
          borderWidth: 1,
          borderColor: 'rgba(210,182,138,0.18)',
        }}
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-primary text-base">✦</Text>
          <Text
            className="text-[10px] font-bold text-navy uppercase tracking-widest"
            style={{ fontFamily: 'Inter_700Bold' }}
          >
            {t.place.insiderTip}
          </Text>
        </View>
        <Text
          className="text-sm text-navy/70 leading-relaxed"
          style={{ fontFamily: 'Inter_300Light' }}
        >
          {insiderTipText}
        </Text>
      </View>
    </View>
  );
}
