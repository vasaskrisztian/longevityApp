import { newPasswordProblem } from '../passwordChange';

describe('newPasswordProblem', () => {
  it('requires the current password', () => {
    expect(newPasswordProblem('', 'Abcdefghi1', 'Abcdefghi1')).toMatch(/current password/);
  });
  it('applies the password strength rules', () => {
    expect(newPasswordProblem('Old-pass-1A', 'short', 'short')).toMatch(/10 characters/);
    expect(newPasswordProblem('Old-pass-1A', 'abcdefghij1', 'abcdefghij1')).toMatch(/uppercase/);
  });
  it('rejects reuse of the current password', () => {
    expect(newPasswordProblem('Abcdefghi1', 'Abcdefghi1', 'Abcdefghi1')).toMatch(/different/);
  });
  it('rejects a mismatching confirmation', () => {
    expect(newPasswordProblem('Old-pass-1A', 'Abcdefghi1', 'Abcdefghi2')).toMatch(/do not match/);
  });
  it('accepts a valid change', () => {
    expect(newPasswordProblem('Old-pass-1A', 'Abcdefghi1', 'Abcdefghi1')).toBeNull();
  });
});
