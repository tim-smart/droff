import { Client } from "droff";
import { Guild, Message } from "droff/dist/types";
import * as Rx from "rxjs";
export declare type CommandPrefix =
  | string
  | ((guild: Guild | undefined) => Promise<string>);
export interface CommandOptions {
  name: string;
}
export interface CommandContext {
  guild: Guild | undefined;
  message: Message;
  command: string;
  args: string[];
  reply: (message: string) => Promise<Message>;
}
export declare const command$: (
  client: Client,
) => (
  prefix: CommandPrefix,
) => ({ name }: CommandOptions) => Rx.Observable<CommandContext>;
