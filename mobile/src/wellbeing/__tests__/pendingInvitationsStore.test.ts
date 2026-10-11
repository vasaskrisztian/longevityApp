import {
  _resetPendingInvitationsForTests,
  getPendingInvitations,
  setPendingInvitations,
} from '@/src/wellbeing/pendingInvitationsStore';

describe('pendingInvitationsStore', () => {
  beforeEach(() => _resetPendingInvitationsForTests());

  it('starts at zero and stores the count', () => {
    expect(getPendingInvitations()).toBe(0);
    setPendingInvitations(3);
    expect(getPendingInvitations()).toBe(3);
  });

  it('clamps negative and fractional values', () => {
    setPendingInvitations(-2);
    expect(getPendingInvitations()).toBe(0);
    setPendingInvitations(2.9);
    expect(getPendingInvitations()).toBe(2);
  });
});
