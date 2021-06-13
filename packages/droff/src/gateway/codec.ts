type Encode = (payload: unknown) => string | Buffer;
type Decode = (bloc: Buffer) => unknown;

export interface Codec {
  encode: Encode;
  decode: Decode;
  encoding: "json" | "etf";
}

export const create = (): Codec => {
  try {
    const Erl = require("erlpack");
    return {
      encode: Erl.pack,
      decode: Erl.unpack,
      encoding: "etf",
    };
  } catch (_) {}

  return {
    encode: JSON.stringify,
    decode: (blob) => JSON.parse(blob.toString("utf8")),
    encoding: "json",
  };
};
