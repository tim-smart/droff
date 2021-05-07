const Pkg = require("../../package.json");

import Axios from "axios";

export interface Options {
  version?: number;
}

export function create(token: string, { version = 9 }: Options = {}) {
  return Axios.create({
    baseURL: `https://discord.com/api/v${version}`,
    headers: {
      Authorization: `Bot ${token}`,
      UserAgent: `DiscordBot (https://github.com/tim-smart/droff, ${Pkg.version})`,
    },
  });
}
