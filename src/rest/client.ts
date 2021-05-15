const Pkg = require("../../package.json");

import Axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { APIApplicationCommand, Routes, Snowflake } from "discord-api-types/v8";
import * as Types from "discord-api-types/v8";
import * as RateLimits from "./rate-limits";

const VERSION = 8;

export interface Options {
  /** Global rate limit in requests per second */
  rateLimit?: number;
}

export function create(token: string, { rateLimit = 50 }: Options = {}) {
  const client = Axios.create({
    baseURL: `https://discord.com/api/v${VERSION}`,
    headers: {
      Authorization: `Bot ${token}`,
      UserAgent: `DiscordBot (https://github.com/tim-smart/droff, ${Pkg.version})`,
    },
  });

  const { request, response, error } = RateLimits.interceptors(
    rateLimit,
    1000,
  )(client);

  client.interceptors.request.use(request);
  client.interceptors.response.use(response, error);

  return client;
}

const handleError = (err: AxiosError) => {
  err.message = `REST error: ${err.code} ${err.config.url} ${err.message}`;
  throw err;
};

const getRoute =
  (client: AxiosInstance) =>
  <F extends (...args: any[]) => any>(fn: F) =>
  <T, Q = any>() =>
  (args: Parameters<F>, params?: Q, config?: AxiosRequestConfig): Promise<T> =>
    client
      .get<T>(fn(...args), {
        ...config,
        params: {
          ...(params || {}),
          ...(config?.params || {}),
        },
      })
      .then((r) => r.data, handleError);

const postRoute =
  (client: AxiosInstance) =>
  <F extends (...args: any[]) => any>(fn: F) =>
  <T, D = any>() =>
  (args: Parameters<F>, data?: D, config?: AxiosRequestConfig) =>
    client.post<T>(fn(...args), data, config).then((r) => r.data, handleError);

const patchRoute =
  (client: AxiosInstance) =>
  <F extends (...args: any[]) => any>(fn: F) =>
  <T, D = any>() =>
  (args: Parameters<F>, data?: D, config?: AxiosRequestConfig) =>
    client.patch<T>(fn(...args), data, config).then((r) => r.data, handleError);

const putRoute =
  (client: AxiosInstance) =>
  <F extends (...args: any[]) => any>(fn: F) =>
  <T, D = undefined>() =>
  (args: Parameters<F>, data?: D, config?: AxiosRequestConfig) =>
    client.put<T>(fn(...args), data, config).then((r) => r.data, handleError);

const deleteRoute =
  (client: AxiosInstance) =>
  <F extends (...args: any[]) => any>(fn: F) =>
  <T = never>() =>
  (args: Parameters<F>, config?: AxiosRequestConfig) =>
    client.delete<T>(fn(...args), config).catch(handleError);

export const routes = (client: AxiosInstance) => {
  const get = getRoute(client);
  const post = postRoute(client);
  const patch = patchRoute(client);
  const put = putRoute(client);
  const del = deleteRoute(client);

  return {
    getGuildAuditLog: get(Routes.guildAuditLog)<
      Types.RESTGetAPIAuditLogResult,
      Types.RESTGetAPIAuditLogQuery
    >(),

    getChannel: get(Routes.channel)<Types.RESTGetAPIChannelResult>(),
    patchChannel: patch(Routes.channel)<
      Types.RESTPatchAPIChannelResult,
      Types.RESTPatchAPIChannelJSONBody
    >(),
    deleteChannel: del(Routes.channel)<Types.RESTDeleteAPIChannelResult>(),

    getChannelMessages: get(Routes.channelMessages)<
      Types.RESTGetAPIChannelMessagesResult,
      Types.RESTGetAPIChannelMessagesQuery
    >(),
    postChannelMessages: post(Routes.channelMessages)<
      Types.RESTPostAPIChannelMessageResult,
      Types.RESTPostAPIChannelMessageJSONBody
    >(),

    getChannelMessage: get(
      Routes.channelMessage,
    )<Types.RESTGetAPIChannelMessageResult>(),
    patchChannelMessage: patch(Routes.channelMessage)<
      Types.RESTPatchAPIChannelMessageResult,
      Types.RESTPatchAPIChannelMessageJSONBody
    >(),
    deleteChannelMessage: del(
      Routes.channelMessage,
    )<Types.RESTDeleteAPIChannelMessageResult>(),

    postChannelMessageCrosspost: post(
      Routes.channelMessageCrosspost,
    )<Types.RESTPostAPIChannelMessageCrosspostResult>(),

    putChannelMessageOwnReaction: put(Routes.channelMessageOwnReaction)(),
    deleteChannelMessageOwnReaction: del(Routes.channelMessageOwnReaction)(),

    deleteChannelMessageUserReaction: del(
      Routes.channelMessageUserReaction,
    )<Types.RESTDeleteAPIChannelMessageUserReactionResult>(),

    getChannelMessageReaction: get(Routes.channelMessageReaction)<
      Types.RESTGetAPIChannelMessageReactionUsersResult,
      Types.RESTGetAPIChannelMessageReactionUsersQuery
    >(),
    deleteChannelMessageReaction: del(
      Routes.channelMessageReaction,
    )<Types.RESTDeleteAPIChannelMessageReactionResult>(),

    deleteChannelMessageAllReactions: del(
      Routes.channelMessageAllReactions,
    )<Types.RESTDeleteAPIChannelAllMessageReactionsResult>(),

    postChannelBulkDelete: post(Routes.channelBulkDelete)<
      Types.RESTPostAPIChannelMessagesBulkDeleteResult,
      Types.RESTPostAPIChannelMessagesBulkDeleteJSONBody
    >(),

    putChannelPermission: put(Routes.channelPermission)<
      Types.RESTPutAPIChannelPermissionResult,
      Types.RESTPutAPIChannelPermissionJSONBody
    >(),
    deleteChannelPermission: del(
      Routes.channelPermission,
    )<Types.RESTDeleteAPIChannelPermissionResult>(),

    getChannelInvites: get(
      Routes.channelInvites,
    )<Types.RESTGetAPIChannelInvitesResult>(),

    postChannelInvites: post(Routes.channelInvites)<
      Types.RESTPostAPIChannelInviteResult,
      Types.RESTPostAPIChannelInviteJSONBody
    >(),

    postChannelFollowers: post(Routes.channelFollowers)<
      Types.RESTPostAPIChannelFollowersResult,
      Types.RESTPostAPIChannelFollowersJSONBody
    >(),

    postChannelTyping: post(
      Routes.channelTyping,
    )<Types.RESTPostAPIChannelTypingResult>(),

    getChannelPins: get(
      Routes.channelPins,
    )<Types.RESTGetAPIChannelPinsResult>(),

    putChannelPin: put(Routes.channelPin)<Types.RESTPutAPIChannelPinResult>(),
    deleteChannelPin: del(
      Routes.channelPin,
    )<Types.RESTDeleteAPIChannelPinResult>(),

    putChannelRecipient: put(Routes.channelRecipient)<
      Types.RESTPutAPIChannelRecipientResult,
      Types.RESTPutAPIChannelRecipientJSONBody
    >(),
    deleteChannelRecipient: del(
      Routes.channelRecipient,
    )<Types.RESTDeleteAPIChannelRecipientResult>(),

    getGuildEmojis: get(
      Routes.guildEmojis,
    )<Types.RESTGetAPIGuildEmojisResult>(),
    postGuildEmojis: post(Routes.guildEmojis)<
      Types.RESTPostAPIGuildEmojiResult,
      Types.RESTPostAPIGuildEmojiJSONBody
    >(),

    getGuildEmoji: get(Routes.guildEmoji)<Types.RESTGetAPIGuildEmojiResult>(),
    patchGuildEmoji: patch(Routes.guildEmoji)<
      Types.RESTPatchAPIGuildEmojiResult,
      Types.RESTPatchAPIGuildEmojiJSONBody
    >(),
    deleteGuildEmoji: del(
      Routes.guildEmoji,
    )<Types.RESTDeleteAPIGuildEmojiResult>(),

    postGuilds: post(Routes.guilds)<
      Types.RESTPostAPIGuildsResult,
      Types.RESTPostAPIGuildsJSONBody
    >(),

    getGuild: get(Routes.guild)<
      Types.RESTGetAPIGuildResult,
      Types.RESTGetAPIGuildQuery
    >(),
    patchGuild: patch(Routes.guild)<
      Types.RESTPatchAPIGuildResult,
      Types.RESTPatchAPIGuildJSONBody
    >(),
    deleteGuild: del(Routes.guild)<Types.RESTDeleteAPIGuildResult>(),

    getGuildPreview: get(
      Routes.guildPreview,
    )<Types.RESTGetAPIGuildPreviewResult>(),

    getGuildChannels: get(
      Routes.guildChannels,
    )<Types.RESTGetAPIGuildChannelsResult>(),
    postGuildChannels: post(Routes.guildChannels)<
      Types.RESTPostAPIGuildChannelResult,
      Types.RESTPostAPIGuildChannelJSONBody
    >(),
    patchGuildChannels: patch(Routes.guildChannels)<
      Types.RESTPatchAPIGuildChannelPositionsResult,
      Types.RESTPatchAPIGuildChannelPositionsJSONBody
    >(),

    getGuildMember: get(
      Routes.guildMember,
    )<Types.RESTGetAPIGuildMemberResult>(),
    patchGuildMember: patch(Routes.guildMember)<
      Types.RESTPatchAPIGuildMemberResult,
      Types.RESTPatchAPIGuildMemberJSONBody
    >(),
    putGuildMember: put(Routes.guildMember)<
      Types.RESTPutAPIGuildMemberResult,
      Types.RESTPutAPIGuildMemberJSONBody
    >(),
    deleteGuildMember: del(
      Routes.guildMember,
    )<Types.RESTDeleteAPIGuildMemberResult>(),

    getGuildMembers: get(Routes.guildMembers)<
      Types.RESTGetAPIGuildMembersResult,
      Types.RESTGetAPIGuildMembersQuery
    >(),

    getGuildMembersSearch: get(Routes.guildMembersSearch)<
      Types.RESTGetAPIGuildMembersSearchResult,
      Types.RESTGetAPIGuildMembersSearchQuery
    >(),

    patchGuildCurrentMemberNickname: patch(Routes.guildCurrentMemberNickname)<
      Types.RESTPatchAPICurrentGuildMemberNicknameResult,
      Types.RESTPatchAPICurrentGuildMemberNicknameJSONBody
    >(),

    putGuildMemberRole: put(
      Routes.guildMemberRole,
    )<Types.RESTPutAPIGuildMemberRoleResult>(),
    deleteGuildMemberRole: del(
      Routes.guildMemberRole,
    )<Types.RESTDeleteAPIGuildMemberRoleResult>(),

    getGuildBans: get(Routes.guildBans)<Types.RESTGetAPIGuildBansResult>(),

    getGuildBan: get(Routes.guildBan)<Types.RESTGetAPIGuildBanResult>(),
    putGuildBan: put(Routes.guildBan)<
      Types.RESTPutAPIGuildBanResult,
      Types.RESTPutAPIGuildBanJSONBody
    >(),
    deleteGuildBan: del(Routes.guildBan)<Types.RESTDeleteAPIGuildBanResult>(),

    getGuildRoles: get(Routes.guildRoles)<Types.RESTGetAPIGuildRolesResult>(),
    postGuildRoles: post(Routes.guildRoles)<
      Types.RESTPostAPIGuildRoleResult,
      Types.RESTPostAPIGuildRoleJSONBody
    >(),
    patchGuildRoles: patch(Routes.guildRoles)<
      Types.RESTPatchAPIGuildRolePositionsResult,
      Types.RESTPatchAPIGuildRolePositionsJSONBody
    >(),

    patchGuildRole: patch(Routes.guildRole)<
      Types.RESTPatchAPIGuildRoleResult,
      Types.RESTPatchAPIGuildRoleJSONBody
    >(),
    deleteGuildRole: del(
      Routes.guildRole,
    )<Types.RESTDeleteAPIGuildRoleResult>(),

    getGuildPrune: get(Routes.guildPrune)<
      Types.RESTGetAPIGuildPruneCountResult,
      Types.RESTGetAPIGuildPruneCountQuery
    >(),
    postGuildPrune: post(Routes.guildPrune)<
      Types.RESTPostAPIGuildPruneResult,
      Types.RESTPostAPIGuildPruneJSONBody
    >(),

    getGuildVoiceRegions: get(
      Routes.guildVoiceRegions,
    )<Types.RESTGetAPIGuildVoiceRegionsResult>(),

    getGuildInvites: get(
      Routes.guildInvites,
    )<Types.RESTGetAPIGuildInvitesResult>(),

    getGuildIntegrations: get(
      Routes.guildIntegrations,
    )<Types.RESTGetAPIGuildIntegrationsResult>(),

    deleteGuildIntegration: del(
      Routes.guildIntegration,
    )<Types.RESTDeleteAPIGuildIntegrationResult>(),

    getGuildWidgetSettings: get(
      Routes.guildWidgetSettings,
    )<Types.RESTGetAPIGuildWidgetSettingsResult>(),
    patchGuildWidgetSettings: patch(Routes.guildWidgetSettings)<
      Types.RESTPatchAPIGuildWidgetSettingsResult,
      Types.RESTPatchAPIGuildWidgetSettingsJSONBody
    >(),

    getGuildWidgetJSON: get(
      Routes.guildWidgetJSON,
    )<Types.RESTGetAPIGuildWidgetJSONResult>(),

    getGuildVanityUrl: get(
      Routes.guildVanityUrl,
    )<Types.RESTGetAPIGuildVanityUrlResult>(),

    getGuildWidgetImage: get(Routes.guildWidgetImage)<
      Types.RESTGetAPIGuildWidgetImageResult,
      Types.RESTGetAPIGuildWidgetImageQuery
    >(),

    getInvite: get(Routes.invite)<
      Types.RESTGetAPIInviteResult,
      Types.RESTGetAPIInviteQuery
    >(),
    deleteInvite: del(Routes.invite)<Types.RESTDeleteAPIInviteResult>(),

    getTemplate: get(Routes.template)<Types.RESTGetAPITemplateResult>(),
    postTemplate: post(Routes.template)<
      Types.RESTPostAPITemplateCreateGuildResult,
      Types.RESTPostAPITemplateCreateGuildJSONBody
    >(),

    getGuildTemplates: get(
      Routes.guildTemplates,
    )<Types.RESTGetAPIGuildTemplatesResult>(),
    postGuildTemplates: post(Routes.guildTemplates)<
      Types.RESTPostAPIGuildTemplatesResult,
      Types.RESTPostAPIGuildTemplatesJSONBody
    >(),

    patchGuildTemplate: patch(Routes.guildTemplate)<
      Types.RESTPatchAPIGuildTemplateResult,
      Types.RESTPatchAPIGuildTemplateJSONBody
    >(),
    putGuildTemplate: put(
      Routes.guildTemplate,
    )<Types.RESTPutAPIGuildTemplateSyncResult>(),
    deleteGuildTemplate: del(
      Routes.guildTemplate,
    )<Types.RESTDeleteAPIGuildTemplateResult>(),

    getUser: get(Routes.user)<Types.RESTGetAPIUserResult>(),
    patchUser: patch(Routes.user)<
      Types.RESTPatchAPICurrentUserResult,
      Types.RESTPatchAPICurrentUserJSONBody
    >(),

    getUserGuilds: get(Routes.userGuilds)<
      Types.RESTGetAPICurrentUserGuildsResult,
      Types.RESTGetAPICurrentUserGuildsQuery
    >(),

    deleteUserGuild: del(
      Routes.userGuild,
    )<Types.RESTDeleteAPICurrentUserGuildResult>(),

    postUserChannels: post(Routes.userChannels)<
      Types.RESTPostAPICurrentUserCreateDMChannelResult,
      Types.RESTPostAPICurrentUserCreateDMChannelJSONBody
    >(),

    getUserConnections: get(
      Routes.userConnections,
    )<Types.RESTGetAPICurrentUserConnectionsResult>(),

    getVoiceRegions: get(
      Routes.voiceRegions,
    )<Types.RESTGetAPIGuildVoiceRegionsResult>(),

    getChannelWebhooks: get(
      Routes.channelWebhooks,
    )<Types.RESTGetAPIChannelWebhooksResult>(),
    postChannelWebhooks: post(Routes.channelWebhooks)<
      Types.RESTPostAPIChannelWebhookResult,
      Types.RESTPostAPIChannelWebhookJSONBody
    >(),

    getGuildWebhooks: get(
      Routes.guildWebhooks,
    )<Types.RESTGetAPIGuildWebhooksResult>(),

    getWebhook: get(Routes.webhook)<Types.RESTGetAPIWebhookResult>(),
    postWebhook: post(Routes.webhook)<
      Types.RESTPostAPIChannelWebhookResult,
      Types.RESTPostAPIChannelWebhookJSONBody
    >(),
    patchWebhook: patch(Routes.webhook)<
      Types.RESTPatchAPIWebhookResult,
      Types.RESTPatchAPIWebhookJSONBody
    >(),
    deleteWebhook: del(Routes.webhook)<Types.RESTDeleteAPIWebhookResult>(),

    getWebhookMessage: get(Routes.webhookMessage)<
      Types.RESTGetAPIWebhookWithTokenMessageResult,
      Types.RESTGetAPIWebhookWithTokenMessageResult
    >(),
    patchWebhookMessage: patch(Routes.webhookMessage)<
      Types.RESTPatchAPIWebhookWithTokenMessageResult,
      Types.RESTPatchAPIWebhookWithTokenMessageJSONBody
    >(),
    deleteWebhookMessage: del(
      Routes.webhookMessage,
    )<Types.RESTDeleteAPIWebhookWithTokenMessageResult>(),

    postWebhookPlatform: post(Routes.webhookPlatform)<
      | Types.RESTPostAPIWebhookWithTokenSlackResult
      | Types.RESTPostAPIWebhookWithTokenSlackWaitResult,
      Types.RESTPostAPIWebhookWithTokenSlackQuery
    >(),

    getGateway: get(Routes.gateway)<Types.RESTGetAPIGatewayResult>(),

    getGatewayBot: get(Routes.gatewayBot)<Types.RESTGetAPIGatewayBotResult>(),

    getOauth2CurrentApplication: get(
      Routes.oauth2CurrentApplication,
    )<Types.RESTGetAPIOauth2CurrentApplicationResult>(),

    getOauth2CurrentAuthorization: get(
      Routes.oauth2CurrentAuthorization,
    )<Types.RESTGetAPIOauth2CurrentAuthorizationResult>(),

    getApplicationCommands: get(
      Routes.applicationCommands,
    )<Types.RESTGetAPIApplicationCommandsResult>(),
    postApplicationCommands: post(Routes.applicationCommands)<
      Types.RESTPostAPIApplicationCommandsResult,
      Types.RESTPostAPIApplicationCommandsJSONBody
    >(),
    putApplicationCommands: put(Routes.applicationCommands)<
      Types.RESTPutAPIApplicationCommandsResult,
      Types.RESTPutAPIApplicationCommandsJSONBody
    >(),

    getApplicationCommand: get(
      Routes.applicationCommand,
    )<Types.RESTGetAPIApplicationCommandResult>(),
    patchApplicationCommand: patch(Routes.applicationCommand)<
      Types.RESTPatchAPIApplicationCommandResult,
      Types.RESTPatchAPIApplicationCommandJSONBody
    >(),
    deleteApplicationCommand: del(Routes.applicationCommand)(),

    getApplicationGuildCommands: get(Routes.applicationGuildCommands)<
      /** Types.RESTGetAPIApplicationGuildCommandsResult */ (APIApplicationCommand & {
        guild_id: Snowflake;
      })[]
    >(),
    postApplicationGuildCommands: post(Routes.applicationGuildCommands)<
      Types.RESTPostAPIApplicationGuildCommandsResult,
      Types.RESTPostAPIApplicationGuildCommandsJSONBody
    >(),
    putApplicationGuildCommands: put(Routes.applicationGuildCommands)<
      Types.RESTPutAPIApplicationGuildCommandsResult,
      Types.RESTPutAPIApplicationGuildCommandsJSONBody
    >(),

    getApplicationGuildCommand: get(
      Routes.applicationGuildCommand,
    )<Types.RESTGetAPIApplicationGuildCommandResult>(),
    patchApplicationGuildCommand: patch(Routes.applicationGuildCommand)<
      Types.RESTPatchAPIApplicationGuildCommandResult,
      Types.RESTPatchAPIApplicationGuildCommandJSONBody
    >(),
    deleteApplicationGuildCommand: del(Routes.applicationGuildCommand)(),

    postInteractionCallback: post(Routes.interactionCallback)<
      never,
      Types.RESTPostAPIInteractionCallbackJSONBody
    >(),

    getGuildMemberVerification: get(
      Routes.guildMemberVerification,
    )<Types.RESTGetAPIGuildMemberVerificationResult>(),
    patchGuildMemberVerification: patch(Routes.guildMemberVerification)<
      Types.RESTPatchAPIGuildMemberVerificationResult,
      Types.RESTPatchAPIGuildMemberVerificationJSONBody
    >(),

    patchGuildVoiceState: patch(Routes.guildVoiceState)<
      never,
      | Types.RESTPatchAPIGuildVoiceStateUserJSONBody
      | Types.RESTPatchAPIGuildVoiceStateCurrentMemberJSONBody
    >(),

    getGuildApplicationCommandsPermissions: get(
      Routes.guildApplicationCommandsPermissions,
    )<Types.RESTGetAPIGuildApplicationCommandsPermissionsResult>(),
    putGuildApplicationCommandsPermissions: put(
      Routes.guildApplicationCommandsPermissions,
    )<
      Types.RESTPutAPIGuildApplicationCommandsPermissionsResult,
      Types.RESTPutAPIGuildApplicationCommandsPermissionsJSONBody
    >(),

    getApplicationCommandPermissions: get(
      Routes.applicationCommandPermissions,
    )<Types.RESTGetAPIApplicationCommandPermissionsResult>(),
    putApplicationCommandPermissions: put(Routes.applicationCommandPermissions)<
      Types.RESTPutAPIApplicationCommandPermissionsResult,
      Types.RESTPutAPIApplicationCommandPermissionsJSONBody
    >(),

    getGuildWelcomeScreen: get(
      Routes.guildWelcomeScreen,
    )<Types.RESTGetAPIGuildWelcomeScreenResult>(),
    patchGuildWelcomeScreen: patch(Routes.guildWelcomeScreen)<
      never,
      Types.RESTPatchAPIGuildWelcomeScreenJSONBody
    >(),
  };
};

export type Routes = ReturnType<typeof routes>;
