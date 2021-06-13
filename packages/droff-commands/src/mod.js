"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.command$ = void 0;
const tslib_1 = require("tslib");
const Rx = tslib_1.__importStar(require("rxjs"));
const RxO = tslib_1.__importStar(require("rxjs/operators"));
function escapeRegex(string) {
    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}
const command$ = (client) => (prefix) => ({ name }) => client.dispatch$("MESSAGE_CREATE").pipe(RxO.withLatestFrom(client.guilds$), RxO.flatMap(([message, guilds]) => {
    const guild = guilds.get(message.guild_id);
    const ctx = {
        guild,
        message,
        command: name,
        reply: reply(client)(message),
    };
    return Rx.zip(Rx.of(ctx), typeof prefix === "string" ? Rx.of(prefix) : prefix(guild));
}), RxO.filter(([ctx, prefix]) => new RegExp(`^${escapeRegex(prefix)}${escapeRegex(name)}\\b`).test(ctx.message.content)), RxO.map(([ctx, prefix]) => ({
    ...ctx,
    args: ctx.message.content
        .slice(prefix.length + name.length)
        .trim()
        .replace(/\s+/g, " ")
        .split(" "),
})));
exports.command$ = command$;
const reply = (client) => (message) => (content) => client.createMessage(message.channel_id, {
    message_reference: { message_id: message.id },
    content,
});
