import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { GLOSSARY } from '@/src/content/glossary';
import { hideTip, useOpenTip } from '@/src/components/ui/infoTipStore';
import { tipLeft, tipTop, tipWidth } from '@/src/components/ui/infoTipLayout';
import { colors, fontFamily, radii } from '@/src/theme/tokens';

/** Element ids web uses to tell "click on a label or the popover" from "click elsewhere". */
export const INFO_TRIGGER_ID_PREFIX = 'infotip-trigger-';
const BUBBLE_ID = 'infotip-bubble';

/**
 * Draws the open explanation popover. Mounted once, last, in the root layout
 * so it sits above every screen. A hover popover never takes pointer events
 * (moving the mouse onto it would not close it); a pinned one closes when
 * tapped, when the user taps outside (phone: a transparent backdrop; web: any
 * click elsewhere), on scroll (web) and on Escape (web).
 */
export function InfoTipHost() {
  const tip = useOpenTip();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [height, setHeight] = useState<number | null>(null);

  // A new popover is measured again before it is shown at its final spot.
  useEffect(() => {
    setHeight(null);
  }, [tip?.term, tip?.rect.x, tip?.rect.y]);

  const pinned = tip?.mode === 'pinned';
  useEffect(() => {
    if (Platform.OS !== 'web' || !pinned || typeof document === 'undefined') return;
    const onPointerDown = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest?.(`[id^="${INFO_TRIGGER_ID_PREFIX}"], #${BUBBLE_ID}`)) return;
      hideTip();
    };
    const onScroll = () => hideTip();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hideTip();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  if (!tip) return null;
  const entry = GLOSSARY[tip.term];
  const width = tipWidth(windowWidth);
  const left = tipLeft(tip.rect.x, width, windowWidth);
  const top = tipTop(tip.rect, height, windowHeight);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {pinned && Platform.OS !== 'web' ? (
        <Pressable
          accessibilityLabel="Close explanation"
          onPress={() => hideTip()}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Pressable
        nativeID={BUBBLE_ID}
        accessibilityRole="text"
        onPress={() => hideTip()}
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        pointerEvents={pinned ? 'auto' : 'none'}
        style={[styles.bubble, { width, left, top, opacity: height === null ? 0 : 1 }]}
        testID={`info-popover-${tip.term}`}
      >
        <Text style={styles.title}>{entry.title}</Text>
        <Text style={styles.text}>{entry.text}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    backgroundColor: colors.card.default,
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: radii.xl,
    padding: 12,
    gap: 4,
    shadowColor: '#10181B',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  title: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 13,
    color: colors.foreground,
  },
  text: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted.foreground,
  },
});
