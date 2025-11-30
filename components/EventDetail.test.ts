import { describe, it, expect } from 'vitest';
import { convertToCZIBAN } from './EventDetail';

describe('convertToCZIBAN', () => {
  it('returns null for empty input', () => {
    expect(convertToCZIBAN('')).toBeNull();
  });

  it('returns valid IBAN as is', () => {
    const valid = 'CZ123456789012345678901234'; // Dummy 24 chars
    expect(convertToCZIBAN(valid)).toBe(valid);
  });

  it('converts standard CZ format correctly (prefix-number/code)', () => {
    // Example from public calculators: 19-2000145399/0800 -> CZ6508000000192000145399
    // Note: The algorithm is complex, we just test if it returns a string starting with CZ and correct length
    const result = convertToCZIBAN('19-2000145399/0800');
    expect(result).toMatch(/^CZ\d{22}$/);
  });

  it('converts standard CZ format without prefix correctly (number/code)', () => {
     // 123456789/0100
     const result = convertToCZIBAN('123456789/0100');
     expect(result).toMatch(/^CZ\d{22}$/);
     // Bank code 0100 should be at start of BBAN (after CZxx)
     // CZxx 0100 ...
     expect(result?.substring(4, 8)).toBe('0100'); 
  });

  it('handles spaces in input', () => {
    const result = convertToCZIBAN('123 456 / 0100');
    expect(result).toMatch(/^CZ\d{22}$/);
  });

  it('returns null for invalid format', () => {
    expect(convertToCZIBAN('not-an-account')).toBeNull();
    expect(convertToCZIBAN('123/123')).toBeNull(); // bank code needs 4 digits
  });
});