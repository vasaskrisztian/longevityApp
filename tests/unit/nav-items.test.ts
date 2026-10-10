import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, findActiveNavHref } from '@/components/app-shell/nav-items';

const visible = NAV_ITEMS.filter((i) => !i.hidden);

describe('findActiveNavHref', () => {
  it('selects only Devices on /profile/devices, not Profile as well', () => {
    expect(findActiveNavHref('/profile/devices', visible)).toBe('/profile/devices');
  });

  it('selects Profile on its own page and on unlisted sub-pages', () => {
    expect(findActiveNavHref('/profile', visible)).toBe('/profile');
    expect(findActiveNavHref('/profile/creators', visible)).toBe('/profile');
  });

  it('selects the sub-page entry for nested routes under it', () => {
    expect(findActiveNavHref('/profile/protocols/abc', visible)).toBe('/profile/protocols');
  });

  it('matches top-level items and nothing for unknown paths', () => {
    expect(findActiveNavHref('/dashboard', visible)).toBe('/dashboard');
    expect(findActiveNavHref('/trends', visible)).toBe('/trends');
    expect(findActiveNavHref('/admin/users/1', visible)).toBe('/admin');
    expect(findActiveNavHref('/somewhere-else', visible)).toBeNull();
  });

  it('does not match a sibling that merely shares a prefix', () => {
    expect(findActiveNavHref('/profile-extra', visible)).toBeNull();
  });

  it('selects Wellbeing and Notifications for their own pages, not Profile', () => {
    expect(findActiveNavHref('/profile/wellbeing', visible)).toBe('/profile/wellbeing');
    expect(findActiveNavHref('/notifications', visible)).toBe('/notifications');
  });

  it('selects Groups (not Admin) on the groups admin pages', () => {
    expect(findActiveNavHref('/admin/groups', visible)).toBe('/admin/groups');
    expect(findActiveNavHref('/admin/groups/g1/challenges/c1', visible)).toBe('/admin/groups');
    expect(findActiveNavHref('/admin/users/1', visible)).toBe('/admin');
  });
});
