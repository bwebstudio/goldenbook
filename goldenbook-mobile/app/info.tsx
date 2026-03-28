import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { INFO_CONTENT, type ContactPageContent, type EditorialPageContent } from '@/config/infoContent';
import { useTranslation } from '@/i18n';
import { useSettingsStore } from '@/store/settingsStore';

// ─── Sub-renderers ────────────────────────────────────────────────────────────

function EditorialContent({ content }: { content: EditorialPageContent }) {
  return (
    <>
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Inter_400Regular',
          color: 'rgba(34,45,82,0.45)',
          lineHeight: 22,
          marginBottom: 32,
          letterSpacing: 0.1,
        }}
      >
        {content.subtitle}
      </Text>

      {/* Divider */}
      <View
        style={{
          height: 0.5,
          backgroundColor: 'rgba(34,45,82,0.1)',
          marginBottom: 32,
        }}
      />

      <View style={{ gap: 20 }}>
        {content.body.map((paragraph, i) => (
          <Text
            key={i}
            style={{
              fontSize: 15,
              fontFamily: 'Inter_400Regular',
              color: 'rgba(34,45,82,0.72)',
              lineHeight: 26,
              letterSpacing: 0.1,
            }}
          >
            {paragraph}
          </Text>
        ))}
      </View>
    </>
  );
}

function ContactContent({ content }: { content: ContactPageContent }) {
  const t = useTranslation();
  return (
    <>
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Inter_400Regular',
          color: 'rgba(34,45,82,0.45)',
          lineHeight: 22,
          marginBottom: 32,
          letterSpacing: 0.1,
        }}
      >
        {content.subtitle}
      </Text>

      {/* Divider */}
      <View
        style={{
          height: 0.5,
          backgroundColor: 'rgba(34,45,82,0.1)',
          marginBottom: 32,
        }}
      />

      {/* Email */}
      <View style={{ marginBottom: 36 }}>
        <Text
          style={{
            fontSize: 10,
            fontFamily: 'Inter_600SemiBold',
            color: 'rgba(34,45,82,0.35)',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          {t.info.email}
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL(`mailto:${content.email}`)}
          activeOpacity={0.7}
        >
          <Text
            style={{
              fontSize: 16,
              fontFamily: 'Inter_400Regular',
              color: '#222D52',
              letterSpacing: 0.1,
            }}
          >
            {content.email}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Social */}
      <View>
        <Text
          style={{
            fontSize: 10,
            fontFamily: 'Inter_600SemiBold',
            color: 'rgba(34,45,82,0.35)',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          {t.info.followUs}
        </Text>
        <View style={{ gap: 16 }}>
          {content.social.map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => Linking.openURL(item.url)}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(34,45,82,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={item.icon === 'instagram' ? 'logo-instagram' : 'logo-facebook'}
                  size={18}
                  color="rgba(34,45,82,0.55)"
                />
              </View>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Inter_400Regular',
                  color: '#222D52',
                  letterSpacing: 0.1,
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InfoScreen() {
  const router = useRouter();
  const t = useTranslation();
  const locale = useSettingsStore((s) => s.locale);
  const { contentKey = '' } = useLocalSearchParams<{ contentKey: string }>();

  const localizedPage = INFO_CONTENT[contentKey];
  const content = localizedPage ? (localizedPage[locale] ?? localizedPage.en) : null;

  // Fallback — should not happen if navigation is wired correctly
  if (!content) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FDFDFB', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(34,45,82,0.4)', fontSize: 14 }}>
          {t.common.pageNotFound}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: 'Inter_500Medium', color: '#222D52', fontSize: 14 }}>
            {t.common.goBack}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FDFDFB' }}>
      {/* ── Header ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(34,45,82,0.08)',
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={24} color="#222D52" />
        </TouchableOpacity>

        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 16,
            fontFamily: 'Inter_600SemiBold',
            color: '#222D52',
            marginHorizontal: 8,
            letterSpacing: 0.2,
          }}
        >
          {content.title}
        </Text>

        <View style={{ width: 40 }} />
      </View>

      {/* ── Body ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 36, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Large editorial title */}
        <Text
          style={{
            fontSize: 34,
            fontFamily: 'PlayfairDisplay_400Regular',
            color: '#222D52',
            lineHeight: 42,
            marginBottom: 16,
          }}
        >
          {content.title}
        </Text>

        {content.type === 'editorial' ? (
          <EditorialContent content={content} />
        ) : (
          <ContactContent content={content} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
