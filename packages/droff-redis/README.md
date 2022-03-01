# droff-redis

Implementations of redis backed cache and rate limit stores.

It also comes with redis backed gateway proxy helpers.

## Why?

Larger bots may want to seperate gateway handling from bot logic, so the bot
logic can be scaled seperately.

To do this you need to use some kind of proxy between the gateway handling and
your bot.

This library provides an implemenation use redis as the proxy. It has:

- Rate limit store
- Cache store
- Gateway events proxy

## Example

See [example/basic.ts](example/basic.ts).
