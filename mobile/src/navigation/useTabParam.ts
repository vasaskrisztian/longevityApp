import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

/**
 * State for a segmented control that can also be set from the URL
 * (`?tab=trends`), so deep links, redirects and notifications can open a
 * specific segment. Falls back to `fallback` for a missing/unknown value.
 */
export function useTabParam<T extends string>(allowed: readonly T[], fallback: T): [T, (next: T) => void] {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const fromUrl = allowed.find((value) => value === tab) ?? fallback;
  const [value, setValue] = useState<T>(fromUrl);
  useEffect(() => {
    setValue(fromUrl);
  }, [fromUrl]);
  return [value, setValue];
}
