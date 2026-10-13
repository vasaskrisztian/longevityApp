import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { GLOSSARY, type GlossaryKey } from '@/src/content/glossary';
import { INFO_TRIGGER_ID_PREFIX } from '@/src/components/ui/InfoTipHost';
import { getOpenTip, hideTip, showTip, useOpenTip, type TipMode } from '@/src/components/ui/infoTipStore';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * A label with a small "i" that explains the term: hover (web) or tap
 * (phone) opens a short popover, drawn by `InfoTipHost` at the root of the
 * app; tapping the label again, the popover, or anywhere else closes it.
 * Only one popover is open at a time.
 */
export function InfoLabel({
  term,
  children,
  textStyle,
  style,
}: {
  term: GlossaryKey;
  children: ReactNode;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const entry = GLOSSARY[term];
  const id = useId();
  const triggerRef = useRef<View>(null);
  const openTip = useOpenTip();
  const isOpen = openTip?.owner === id;

  // If this label goes away while its popover is open (screen change), close it.
  useEffect(() => () => hideTip(id), [id]);

  const open = useCallback(
    (mode: TipMode) => {
      triggerRef.current?.measureInWindow((x, y, width, height) => {
        if (![x, y, width, height].every(Number.isFinite)) return;
        showTip({ owner: id, term, rect: { x, y, width, height }, mode });
      });
    },
    [id, term],
  );

  return (
    <View style={[styles.wrapper, style]}>
      <Pressable
        ref={triggerRef}
        nativeID={`${INFO_TRIGGER_ID_PREFIX}${id}`}
        accessibilityRole="button"
        accessibilityLabel={`${entry.title}: what is this?`}
        accessibilityHint={entry.text}
        accessibilityState={{ expanded: isOpen }}
        onHoverIn={() => {
          if (getOpenTip()?.mode !== 'pinned') open('hover');
        }}
        onHoverOut={() => {
          if (getOpenTip()?.mode === 'hover') hideTip(id);
        }}
        onPress={() => {
          const current = getOpenTip();
          if (current?.owner === id && current.mode === 'pinned') hideTip(id);
          else open('pinned');
        }}
        style={styles.trigger}
      >
        <Text style={textStyle}>{children}</Text>
        <View style={[styles.icon, isOpen ? styles.iconOpen : null]}>
          <Text style={[styles.iconText, isOpen ? styles.iconTextOpen : null]}>i</Text>
        </View>
      </Pressable>
    </View>
  );
}

const ICON_SIZE = 14;

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    // Larger touch area than the 14 px icon without changing the layout.
    paddingVertical: 2,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.muted.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOpen: {
    backgroundColor: colors.primary.default,
    borderColor: colors.primary.default,
  },
  iconText: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 9,
    lineHeight: 11,
    color: colors.muted.foreground,
  },
  iconTextOpen: {
    color: colors.primary.foreground,
  },
});
