import type { ReactElement } from 'react';
import { View, Text, FlatList, type StyleProp, type ViewStyle } from 'react-native';
import { CategoryPlaceCard } from './CategoryPlaceCard';
import type { CategoryPlaceDTO } from '../types';

interface CategoryPlaceGridProps {
  places: CategoryPlaceDTO[];
  title?: string;
  /**
   * Everything above the grid (intro, chips, featured card...). The grid is
   * the screen's scroller, so the rest of the screen rides along in the
   * list header and footer instead of wrapping it in a ScrollView, which
   * would render every card up front.
   */
  header?: ReactElement | null;
  footer?: ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

// A trailing `null` keeps the last card half-width when the count is odd:
// with numColumns, a lone flex-1 item would otherwise stretch across the row.
type Cell = CategoryPlaceDTO | null;

const GAP = 12;

export function CategoryPlaceGrid({
  places,
  title,
  header,
  footer,
  contentContainerStyle,
}: CategoryPlaceGridProps) {
  const cells: Cell[] = places.length % 2 === 1 ? [...places, null] : places;

  return (
    <FlatList<Cell>
      data={cells}
      numColumns={2}
      keyExtractor={(item, index) => item?.id ?? `filler-${index}`}
      renderItem={({ item }) =>
        item ? <CategoryPlaceCard place={item} /> : <View className="flex-1" />
      }
      columnWrapperStyle={{ gap: GAP, paddingHorizontal: 24 }}
      ItemSeparatorComponent={RowGap}
      ListHeaderComponent={
        <>
          {header}
          {title && places.length > 0 && (
            <Text className="text-[10px] uppercase tracking-widest text-navy/40 font-bold mb-4 px-6">
              {title}
            </Text>
          )}
        </>
      }
      ListFooterComponent={footer}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle}
      initialNumToRender={6}
      windowSize={7}
    />
  );
}

function RowGap() {
  return <View style={{ height: GAP }} />;
}
