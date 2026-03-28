import React from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  className?: string;
}

export function Screen({ children, scroll = false, className = '' }: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      className={`flex-1 bg-ivory ${className}`}
      contentContainerClassName="pb-8"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={`flex-1 bg-ivory ${className}`}>{children}</View>
  );

  return (
    <SafeAreaView className="flex-1 bg-ivory">
      {content}
    </SafeAreaView>
  );
}
