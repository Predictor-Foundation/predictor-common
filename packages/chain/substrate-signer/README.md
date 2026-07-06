# @predictor-foundation/substrate-signer

sr25519 key derivation and address/public-key helpers for the Predictor Foundation PAPI services.

The centrepiece is **`parseSuri`** - the single, shared interpretation of a secret URI that both
signing and address-only derivation route through, so they can never disagree about what a URI means.
It accepts a BIP39 mnemonic (optionally with a `//junction` path), a bare `//Alice`-style dev path,
or a raw `0x` 32-byte mini-secret, and **rejects the `<phrase>///password` form** (subkey folds the
password into the mini-secret, so parsing it as a path would silently derive a *different* key).

## Install

```bash
pnpm add @predictor-foundation/substrate-signer
# peers (the PAPI signing + hd-key-derivation stack)
pnpm add polkadot-api @polkadot-labs/hdkd @polkadot-labs/hdkd-helpers @polkadot-api/substrate-bindings
```

## API

| Export | Description |
|---|---|
| `deriveKeypair(secret)` | `Keypair` from any `parseSuri`-accepted secret. |
| `deriveDev("//Name")` | `Keypair` for a well-known dev account. |
| `parseSuri(secret)` | `{ miniSecret, path }` - the shared secret-URI interpretation. |
| `type Keypair` | `{ publicKey, address, signer, sign }` - PAPI signer + raw sr25519 `sign`. |
| `AccountUtils` | `addressToPublicKey`, `addressToPublicKeyBytes`, `publicKeyToAddress`, `isAccountPK`, `convertToAddress`, `convertToPublicKeyIfNeeded`, `convertToPublicKeyBytes`, `generateNewAccount`, `addressFromSuri`. |

```ts
import { deriveKeypair, AccountUtils } from "@predictor-foundation/substrate-signer";

const alice = deriveKeypair("//Alice");
const pubkey = AccountUtils.addressToPublicKey(alice.address);
```

## Scripts

```bash
pnpm build        # tsc -> lib/
pnpm test         # unit tests (needs Node >= 22.6)
pnpm types:check  # tsc --noEmit
```
