import { _resetUnreadStoreForTests, getUnreadCount, setUnreadCount } from '../unreadStore';

beforeEach(() => _resetUnreadStoreForTests());

describe('unread store', () => {
  it('clamps to non-negative integers', () => {
    setUnreadCount(3.9);
    expect(getUnreadCount()).toBe(3);
    setUnreadCount(-5);
    expect(getUnreadCount()).toBe(0);
  });
});
