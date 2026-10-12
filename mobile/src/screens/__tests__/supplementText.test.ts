import { describeSupplement } from '../supplementText';

describe('describeSupplement', () => {
  it('joins dose, frequency and timing', () => {
    expect(describeSupplement({ dosage: 400, unit: 'mg', frequency: 'DAILY', timing: 'EVENING' })).toBe('400mg · Daily · Evening');
  });
  it('skips what is missing', () => {
    expect(describeSupplement({ dosage: null, unit: null, frequency: null, timing: null })).toBe('');
    expect(describeSupplement({ dosage: 5, unit: null, frequency: 'AS_NEEDED', timing: null })).toBe('5 · As needed');
  });
});
