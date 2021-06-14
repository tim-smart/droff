export * as Gateway from "./gateway/client";
export * as Commands from "./gateway/commands";
export * as Rest from "./rest/client";

export { create as createClient, createRestClient } from "./client";
export type { Client, ClientExtras, Options, RESTClient } from "./client";

export type { Store as RateLimitStore } from "./rate-limits/store";

export {
  debounceBy,
  groupByTime,
  rateLimit,
  rateLimitBy,
  throttleBy,
} from "./utils/rxjs";

export {
  GatewayIntents as Intents,
  PermissionFlag as Permissions,
} from "./types";

export * as Types from "./types";