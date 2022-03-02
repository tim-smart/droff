import { RawData } from "ws";

type Encode = (payload: unknown) => RawData;
type Decode = (bloc: RawData) => unknown;

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
    encode: JSON.stringify as any,
    decode: (blob) => JSON.parse(blob.toString("utf8")),
    encoding: "json",
  };
};
