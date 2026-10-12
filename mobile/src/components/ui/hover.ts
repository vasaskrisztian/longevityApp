import type { PressableStateCallbackType } from 'react-native';

/** react-native-web reports `hovered` on a Pressable's state (desktop pointer
 * only); RN's own type does not declare it. False everywhere else. */
export function isHovered(state: PressableStateCallbackType): boolean {
  return Boolean((state as PressableStateCallbackType & { hovered?: boolean }).hovered);
}
