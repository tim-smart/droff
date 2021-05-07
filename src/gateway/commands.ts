import {
  GatewayHeartbeat,
  GatewayIdentify,
  GatewayOPCodes,
  GatewayResume,
} from "discord-api-types/gateway/v8";

export const heartbeat = (d: GatewayHeartbeat["d"]): GatewayHeartbeat => ({
  op: GatewayOPCodes.Heartbeat,
  d,
});

export const identify = (d: GatewayIdentify["d"]): GatewayIdentify => ({
  op: GatewayOPCodes.Identify,
  d,
});

export const resume = (d: GatewayResume["d"]): GatewayResume => ({
  op: GatewayOPCodes.Resume,
  d,
});
