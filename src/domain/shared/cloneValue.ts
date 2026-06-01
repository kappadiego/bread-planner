export const cloneValue = <T,>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value) as T;
  }

  return JSON.parse(JSON.stringify(value)) as T;
};
