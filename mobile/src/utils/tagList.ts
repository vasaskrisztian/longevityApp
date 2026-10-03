/** Mirrors lib/utils.ts's parseTagList/formatTagList exactly — the comma-
 * separated-text-field <-> string[] convention every tag-like field
 * (customActivities, allergies, intolerances, avoidedFoods) uses on both
 * the web app and here. */
export function parseTagList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function formatTagList(values: string[] | undefined | null): string {
  return (values ?? []).join(', ');
}
