import { Platform, useWindowDimensions } from 'react-native';

/** Width at which the web build switches from the phone layout (bottom tab
 * bar) to the desktop layout (left sidebar + centered content column). */
export const DESKTOP_BREAKPOINT = 900;

/** True only on web at a desktop-ish width — native apps (iPhone) always
 * keep the phone layout, regardless of window size. */
export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
}
