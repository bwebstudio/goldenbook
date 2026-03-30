import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Linking, type NativeSyntheticEvent, type TextLayoutEventData } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/i18n';
import type { PlaceDetailDTO } from '../types';

const MAX_LINES = 4;

interface InfoSectionProps {
  shortDescription: string | null;
  fullDescription: string | null;
  contact: PlaceDetailDTO['contact'];
  location: PlaceDetailDTO['location'];
}

export function InfoSection({ shortDescription, fullDescription, contact, location }: InfoSectionProps) {
  const t = useTranslation();
  const hasDescription = shortDescription || fullDescription;
  const hasContact = contact.phone || contact.email || contact.website;
  const hasAddress = location.address;

  const [expanded, setExpanded] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);

  const onTextLayout = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (e.nativeEvent.lines.length > MAX_LINES) {
      setNeedsTruncation(true);
    }
  }, []);

  if (!hasDescription && !hasContact && !hasAddress) return null;

  return (
    <View className="px-5 pb-2">
      {/* Description */}
      {hasDescription && (
        <View className="mb-6">
          {shortDescription && (
            <Text
              className="text-base text-navy leading-relaxed mb-3"
              style={{ fontFamily: 'Inter_500Medium' }}
            >
              {shortDescription}
            </Text>
          )}
          {fullDescription && fullDescription !== shortDescription && (
            <View>
              <Text
                className="text-sm text-navy/70 leading-relaxed"
                style={{ fontFamily: 'Inter_300Light' }}
                numberOfLines={expanded ? undefined : MAX_LINES}
                onTextLayout={onTextLayout}
              >
                {fullDescription}
              </Text>
              {needsTruncation && (
                <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.7} className="mt-2">
                  <Text className="text-xs font-semibold text-primary">
                    {expanded ? t.place.readLess : t.place.readMore}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* Address */}
      {hasAddress && (
        <View className="flex-row items-start gap-3 mb-3">
          <Ionicons name="location-outline" size={16} color="rgba(34,45,82,0.45)" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-sm text-navy/60">{location.address}</Text>
        </View>
      )}

      {/* Contact */}
      {contact.phone && (
        <TouchableOpacity
          className="flex-row items-center gap-3 mb-2"
          onPress={() => Linking.openURL(`tel:${contact.phone}`)}
        >
          <Ionicons name="call-outline" size={16} color="rgba(34,45,82,0.45)" />
          <Text className="text-sm text-navy/60">{contact.phone}</Text>
        </TouchableOpacity>
      )}
      {contact.email && (
        <TouchableOpacity
          className="flex-row items-center gap-3 mb-2"
          onPress={() => Linking.openURL(`mailto:${contact.email}`)}
        >
          <Ionicons name="mail-outline" size={16} color="rgba(34,45,82,0.45)" />
          <Text className="text-sm text-navy/60">{contact.email}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
