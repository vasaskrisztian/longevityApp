import { legacyProfileHref } from '@/src/navigation/legacyRoutes';

describe('legacyProfileHref', () => {
  it('maps the Plan pages', () => {
    for (const page of ['supplements', 'protocols', 'challenges']) {
      expect(legacyProfileHref([page])).toBe(`/plan/${page}`);
    }
  });

  it('sends the old Goals page to Protocols, where goals now live', () => {
    expect(legacyProfileHref(['goals'])).toBe('/plan/protocols');
  });

  it('maps community pages', () => {
    expect(legacyProfileHref(['wellbeing'])).toBe('/community');
    expect(legacyProfileHref(['discover'])).toBe('/community?tab=creators');
    expect(legacyProfileHref(['creators'])).toBe('/community/browse');
    expect(legacyProfileHref(['creators', 'abc'])).toBe('/community/creators/abc');
  });

  it('maps the profile forms and body pages', () => {
    expect(legacyProfileHref([])).toBe('/me');
    expect(legacyProfileHref(['nutrition'])).toBe('/me/about?tab=nutrition');
    expect(legacyProfileHref(['lifestyle'])).toBe('/me/about?tab=exercise');
    expect(legacyProfileHref(['inbody'])).toBe('/?tab=body');
  });

  it('sends unknown pages to Me', () => {
    expect(legacyProfileHref(['nope'])).toBe('/me');
  });
});
