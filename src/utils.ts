export {};

declare global {
  export interface JSON {
    safeStringify(value: any): string;
  }
}

// Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value#examples
// This implementation removes circular references from the output but is cheaper than other approaches.
const getCircularReplacer = (): any => {
  const seen = new WeakSet();
  return (_key: any, value: any) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return;
      seen.add(value);
    }
    return value;
  };
};

JSON.safeStringify = (value: any): string =>
  JSON.stringify(value, getCircularReplacer());
