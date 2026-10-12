import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * A linear colour wash that fills its parent (position: absolute). Drawn with
 * react-native-svg, which the charts already use, so it needs no extra native
 * module and renders the same on iOS, Android and the web export.
 *
 * `direction` 'horizontal' = left to right (the selected-menu look),
 * 'vertical' = top to bottom (the sidebar wash). Put it as the FIRST child of
 * a parent that has `overflow: 'hidden'` and the wanted `borderRadius`.
 */
export function BrandGradient({
  colors,
  direction = 'horizontal',
  style,
}: {
  colors: readonly [string, string];
  direction?: 'horizontal' | 'vertical';
  style?: StyleProp<ViewStyle>;
}) {
  // useId() returns ':r1:'-style ids; keep it a plain token for url(#...).
  const id = `bg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const horizontal = direction === 'horizontal';
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={horizontal ? '1' : '0'} y2={horizontal ? '0' : '1'}>
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
