export const memoize = <T>(fn: (arg: string) => T) => {
  let cache: T;

  return (arg: string) => {
    if (cache) return cache;
    cache = fn(arg);
    return cache;
  };
};
