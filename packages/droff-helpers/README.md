# droff-helpers

A collection of helper functions to help making bots with `droff` easier.

## Usage

```typescript
import { Permissions } from "droff";
import * as DH from "droff-helpers";

// If we had a list of roles and a channel:
const memberChannelPermissions =
  DH.Permissions.forChannel(roles)(channel)(member);

// This would return true / false
DH.Permissions.has(Permissions.VIEW_CHANNEL)(memberChannelPermissions);

// You could also use partial application:
const canViewChannel = DH.Permissions.has(Permissions.VIEW_CHANNEL);

// This would return true / false
canViewChannel(memberChannelPermissions);
```
