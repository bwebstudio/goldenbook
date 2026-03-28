import { View, StyleSheet } from 'react-native';
import { colors } from '@/design/tokens';

interface MapPinProps {
  selected?: boolean;
}

export function MapPin({ selected = false }: MapPinProps) {
  return (
    <View style={[styles.outer, selected && styles.outerSelected]}>
      <View style={[styles.inner, selected && styles.innerSelected]} />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  outerSelected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.navy.DEFAULT,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  inner: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  innerSelected: {
    backgroundColor: colors.primary,
  },
});
