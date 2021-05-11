import * as GT from "discord-api-types/v8";
import { GatewayDispatchEvents } from "discord-api-types/v8";
import { memoize } from "fp-ts-std/Function";
import { eqString } from "fp-ts/lib/Eq";
import * as O from "fp-ts/Option";
import * as Rx from "rxjs";
import * as RxO from "rxjs/operators";

export interface EventMap {
  [GatewayDispatchEvents.ApplicationCommandCreate]: GT.GatewayApplicationCommandCreateDispatch;
  [GatewayDispatchEvents.ApplicationCommandDelete]: GT.GatewayApplicationCommandDeleteDispatch;
  [GatewayDispatchEvents.ApplicationCommandUpdate]: GT.GatewayApplicationCommandUpdateDispatch;
  [GatewayDispatchEvents.ChannelCreate]: GT.GatewayChannelCreateDispatch;
  [GatewayDispatchEvents.ChannelDelete]: GT.GatewayChannelDeleteDispatch;
  [GatewayDispatchEvents.ChannelPinsUpdate]: GT.GatewayChannelPinsUpdateDispatch;
  [GatewayDispatchEvents.ChannelUpdate]: GT.GatewayChannelUpdateDispatch;
  [GatewayDispatchEvents.GuildBanAdd]: GT.GatewayGuildBanAddDispatch;
  [GatewayDispatchEvents.GuildBanRemove]: GT.GatewayGuildBanRemoveDispatch;
  [GatewayDispatchEvents.GuildCreate]: GT.GatewayGuildCreateDispatch;
  [GatewayDispatchEvents.GuildDelete]: GT.GatewayGuildDeleteDispatch;
  [GatewayDispatchEvents.GuildEmojisUpdate]: GT.GatewayGuildEmojisUpdateDispatch;
  [GatewayDispatchEvents.GuildIntegrationsUpdate]: GT.GatewayGuildIntegrationsUpdateDispatch;
  [GatewayDispatchEvents.GuildMemberAdd]: GT.GatewayGuildMemberAddDispatch;
  [GatewayDispatchEvents.GuildMemberRemove]: GT.GatewayGuildMemberRemoveDispatch;
  [GatewayDispatchEvents.GuildMembersChunk]: GT.GatewayGuildMembersChunkDispatch;
  [GatewayDispatchEvents.GuildMemberUpdate]: GT.GatewayGuildMemberUpdateDispatch;
  [GatewayDispatchEvents.GuildRoleCreate]: GT.GatewayGuildRoleCreateDispatch;
  [GatewayDispatchEvents.GuildRoleDelete]: GT.GatewayGuildRoleDeleteDispatch;
  [GatewayDispatchEvents.GuildRoleUpdate]: GT.GatewayGuildRoleUpdateDispatch;
  [GatewayDispatchEvents.GuildUpdate]: GT.GatewayGuildUpdateDispatch;
  [GatewayDispatchEvents.IntegrationCreate]: GT.GatewayIntegrationCreateDispatch;
  [GatewayDispatchEvents.IntegrationDelete]: GT.GatewayIntegrationDeleteDispatch;
  [GatewayDispatchEvents.IntegrationUpdate]: GT.GatewayIntegrationUpdateDispatch;
  [GatewayDispatchEvents.InteractionCreate]: GT.GatewayInteractionCreateDispatch;
  [GatewayDispatchEvents.InviteCreate]: GT.GatewayInviteCreateDispatch;
  [GatewayDispatchEvents.InviteDelete]: GT.GatewayInviteDeleteDispatch;
  [GatewayDispatchEvents.MessageCreate]: GT.GatewayMessageCreateDispatch;
  [GatewayDispatchEvents.MessageDelete]: GT.GatewayMessageDeleteDispatch;
  [GatewayDispatchEvents.MessageDeleteBulk]: GT.GatewayMessageDeleteBulkDispatch;
  [GatewayDispatchEvents.MessageReactionAdd]: GT.GatewayMessageReactionAddDispatch;
  [GatewayDispatchEvents.MessageReactionRemove]: GT.GatewayMessageReactionRemoveDispatch;
  [GatewayDispatchEvents.MessageReactionRemoveEmoji]: GT.GatewayMessageReactionRemoveEmojiDispatch;
  [GatewayDispatchEvents.MessageUpdate]: GT.GatewayMessageUpdateDispatch;
  [GatewayDispatchEvents.PresenceUpdate]: GT.GatewayPresenceUpdateDispatch;
  [GatewayDispatchEvents.Ready]: GT.GatewayReadyDispatch;
  [GatewayDispatchEvents.Resumed]: GT.GatewayResumedDispatch;
  [GatewayDispatchEvents.TypingStart]: GT.GatewayTypingStartDispatch;
  [GatewayDispatchEvents.UserUpdate]: GT.GatewayUserUpdateDispatch;
  [GatewayDispatchEvents.VoiceServerUpdate]: GT.GatewayVoiceServerUpdateDispatch;
  [GatewayDispatchEvents.VoiceStateUpdate]: GT.GatewayVoiceStateUpdateDispatch;
  [GatewayDispatchEvents.WebhooksUpdate]: GT.GatewayWebhooksUpdateDispatch;
}

export type Dispatch = <E extends keyof EventMap>(
  event: E,
) => Rx.Observable<EventMap[E]["d"]>;

export const listen$ = (source$: Rx.Observable<any>): Dispatch =>
  memoize(eqString)((event) =>
    source$.pipe(
      RxO.filter((p) => p.t === event),
      RxO.map((p) => p.d),
      RxO.share(),
    ),
  );

export const latest$ =
  (dispatch$: Dispatch) =>
  <E extends keyof EventMap>(
    event: E,
  ): Rx.Observable<O.Option<EventMap[E]["d"]>> =>
    Rx.merge(Rx.of(O.none), dispatch$(event).pipe(RxO.map(O.some))).pipe(
      RxO.shareReplay(1),
    );
