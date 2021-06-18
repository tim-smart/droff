export type Flags<T extends number | bigint> = Record<string, T>;

export interface AllFn {
  (flags: Flags<number>): number;
  (flags: Flags<bigint>): bigint;
}

export const all: AllFn = (flags) =>
  Object.values(flags).reduce((acc, flag) => acc | flag);

export interface ListFn {
  <T extends Flags<number>>(flags: T): (value: number) => (keyof T)[];
  <T extends Flags<bigint>>(flags: T): (value: bigint) => (keyof T)[];
}

export const list: ListFn = (flags: Flags<any>) => {
  const entries = Object.entries(flags);
  return (val: any) =>
    entries.reduce(
      (acc, [key, flag]) => ((val & flag) === flag ? [...acc, key] : acc),
      [] as string[],
    );
};
