import { shortenNodeName } from '../src/mediledger';

describe('shortenName', () => {
  test('returns input as is if length is 10 or less', () => {
    expect(shortenNodeName('')).toBe('');
    expect(shortenNodeName('a')).toBe('a');
    expect(shortenNodeName('a-b')).toBe('a-b');
    expect(shortenNodeName('a-be-ce')).toBe('a-be-ce');
    expect(shortenNodeName('1234567890')).toBe('1234567890');
  });

  test('shortens the input correctly when length is greater than 10', () => {
    expect(shortenNodeName('baptist-health-system')).toBe('baptisths');
    expect(shortenNodeName('osf-healthcare')).toBe('osfh');
    expect(shortenNodeName('verylargename-health-system')).toBe(
      'verylargenamehs'
    );
  });
});
