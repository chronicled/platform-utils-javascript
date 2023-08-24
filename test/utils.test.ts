import '../src/utils';

interface DummyCircularRef {
  dummyNumber: number;
  myself?: DummyCircularRef;
}

describe('JSON extensions', () => {
  test('safeStringify', () => {
    const circularReference: DummyCircularRef = { dummyNumber: 123 };
    const safe = JSON.safeStringify(circularReference);
    expect(safe).toBe('{"dummyNumber":123}');

    const unsafe = JSON.stringify(circularReference);
    expect(safe).toBe(unsafe); // Not circular yet.

    circularReference.myself = circularReference;
    const circularReferenceThrows = () => JSON.stringify(circularReference);
    expect(circularReferenceThrows).toThrowError(TypeError);

    expect(JSON.safeStringify(circularReference)).toBe('{"dummyNumber":123}');
  });
});
