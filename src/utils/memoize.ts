export const memoize = <T>(fn: (arg: string) => T) => {
  const cache = new Map<string, T>();

  return (arg: string) => {
    const val = cache.get(arg);
    if (val) return val;

    const newVal = fn(arg);
    cache.set(arg, newVal);
    return newVal;
  };
};
