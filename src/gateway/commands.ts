import {
  GatewayHeartbeat,
  GatewayIdentify,
  GatewayOPCodes,
  GatewayRequestGuildMembers,
  GatewayResume,
  GatewayUpdatePresence,
  GatewayVoiceStateUpdate,
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

export const requestGuildMembers = (
  d: GatewayRequestGuildMembers["d"],
): GatewayRequestGuildMembers => ({
  op: GatewayOPCodes.RequestGuildMembers,
  d,
});

export const voiceStateUpdate = (
  d: GatewayVoiceStateUpdate["d"],
): GatewayVoiceStateUpdate => ({
  op: GatewayOPCodes.VoiceStateUpdate,
  d,
});

export const presenceUpdate = (
  d: GatewayUpdatePresence["d"],
): GatewayUpdatePresence => ({
  op: GatewayOPCodes.PresenceUpdate,
  d,
});
