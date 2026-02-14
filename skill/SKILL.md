---
name: universal-profile
description: Manage LUKSO Universal Profiles — identity, permissions, tokens, and blockchain operations via direct or gasless relay transactions
version: 0.4.0
author: frozeman
---

# Universal Profile Skill

> To authorize your OpenClaw bot, create a profile at [my.universalprofile.cloud](https://my.universalprofile.cloud), generate a controller key, then authorize it via the [Authorization UI](https://lukso-network.github.io/openclaw-universalprofile-skill/).

## Installation

```bash
npm install
```

## CLI Commands

```bash
up status                                      # Config, keys, connectivity
up profile info [<address>] [--chain <chain>]  # Profile details
up profile configure <address> [--chain lukso]  # Save UP for use
up key generate [--save] [--password <pw>]     # Generate controller keypair
up permissions encode <perm1> [<perm2> ...]    # Encode to bytes32
up permissions decode <hex>                    # Decode to names
up permissions presets                         # List presets
up authorize url [--permissions <preset|hex>]  # Generate auth URL
up quota                                       # Check relay gas quota
```

**Permission presets:** `read-only` 🟢 | `token-operator` 🟡 | `nft-trader` 🟡 | `defi-trader` 🟠 | `profile-manager` 🟡 | `full-access` 🔴

## Credentials

### Required Environment Variables (optional — file-based fallback available)

| Variable | Purpose |
|----------|---------|
| `UP_CREDENTIALS_PATH` | Path to config.json with UP address and controller info |
| `UP_KEY_PATH` | Path to JSON file containing controller private key |

### File-Based Credential Locations (checked in order)

**Config:** `UP_CREDENTIALS_PATH` env → `~/.openclaw/universal-profile/config.json` → `~/.clawdbot/universal-profile/config.json`

**Key:** `UP_KEY_PATH` env → `~/.openclaw/credentials/universal-profile-key.json` → `~/.clawdbot/credentials/universal-profile-key.json`

### Key Storage

The controller private key can be provided via:

1. **Environment variable** (recommended for CI/automated use): Set `UP_KEY_PATH` pointing to a secure JSON key file
2. **JSON key file** at `~/.openclaw/credentials/universal-profile-key.json`
3. **macOS Keychain** (optional, macOS only): Store the key in Keychain using `security add-generic-password`. The skill's credentials loader will check Keychain as a fallback if no file-based key is found.

**Security best practices:**
- Restrict key file permissions: `chmod 600 ~/.openclaw/credentials/universal-profile-key.json`
- Private keys are only loaded into memory for signing, then cleared
- Consider using a dedicated controller key with minimal permissions (see Permission Best Practices below)
- On Linux, use environment variables or a secrets manager

## Transactions

### Direct (controller pays gas)

```
Controller EOA → KeyManager.execute(payload) → UP.execute(...) → Target
```

```javascript
const payload = up.interface.encodeFunctionData('execute', [0, recipient, ethers.parseEther('1.5'), '0x']);
await (await km.execute(payload)).wait();
```

### Relay / Gasless (LSP25)

Controller signs off-chain, relayer submits on-chain. UPs created via universalprofile.cloud have monthly gas quota from LUKSO.

**LSP25 Signature (EIP-191 v0 — CRITICAL: do NOT use `signMessage()`):**

```javascript
const encodedMessage = ethers.solidityPacked(
  ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
  [25, chainId, nonce, validityTimestamps, msgValue, payload]
);

// EIP-191 v0: keccak256(0x19 || 0x00 || keyManagerAddress || encodedMessage)
const prefix = new Uint8Array([0x19, 0x00]);
const msg = new Uint8Array([...prefix, ...ethers.getBytes(keyManagerAddress), ...ethers.getBytes(encodedMessage)]);
const hash = ethers.keccak256(msg);

const signature = ethers.Signature.from(new ethers.SigningKey(privateKey).sign(hash)).serialized;
```

Or use `@lukso/eip191-signer.js`:
```javascript
const { signature } = await new EIP191Signer().signDataWithIntendedValidator(kmAddress, encodedMessage, privateKey);
```

**Relay API (LSP-15):**
```bash
POST https://relayer.mainnet.lukso.network/api/execute
{ "address": "0xUP", "transaction": { "abi": "0xpayload", "signature": "0x...", "nonce": 0, "validityTimestamps": "0x0" } }
```

**Quota check** requires signed request — use `up quota` CLI or `checkRelayQuota()` from `lib/execute/relay.js`.

**Nonce channels:** `getNonce(controller, channelId)` — same channel = sequential, different = parallel.

**Validity timestamps:** `(startTimestamp << 128) | endTimestamp`. Use `0` for no restriction.

## Permission System

Permissions are a bytes32 BitArray at `AddressPermissions:Permissions:<address>`. Combine with bitwise OR.

| Permission | Hex | Risk |
|------------|-----|------|
| CHANGEOWNER | `0x01` | 🔴 |
| ADDCONTROLLER | `0x02` | 🟠 |
| EDITPERMISSIONS | `0x04` | 🟠 |
| ADDEXTENSIONS | `0x08` | 🟡 |
| CHANGEEXTENSIONS | `0x10` | 🟡 |
| ADDUNIVERSALRECEIVERDELEGATE | `0x20` | 🟡 |
| CHANGEUNIVERSALRECEIVERDELEGATE | `0x40` | 🟡 |
| REENTRANCY | `0x80` | 🟡 |
| SUPER_TRANSFERVALUE | `0x0100` | 🟠 |
| TRANSFERVALUE | `0x0200` | 🟡 |
| SUPER_CALL | `0x0400` | 🟠 |
| CALL | `0x0800` | 🟡 |
| SUPER_STATICCALL | `0x1000` | 🟢 |
| STATICCALL | `0x2000` | 🟢 |
| SUPER_DELEGATECALL | `0x4000` | 🔴 |
| DELEGATECALL | `0x8000` | 🔴 |
| DEPLOY | `0x010000` | 🟡 |
| SUPER_SETDATA | `0x020000` | 🟠 |
| SETDATA | `0x040000` | 🟡 |
| ENCRYPT | `0x080000` | 🟢 |
| DECRYPT | `0x100000` | 🟢 |
| SIGN | `0x200000` | 🟢 |
| EXECUTE_RELAY_CALL | `0x400000` | 🟢 |

**SUPER vs Regular:** SUPER_CALL = any contract; CALL = only AllowedCalls. SUPER_SETDATA = any key; SETDATA = only AllowedERC725YDataKeys. Prefer restricted.

**AllowedCalls:** CompactBytesArray at `AddressPermissions:AllowedCalls:<addr>`. Each entry: `<callTypes(4)><address(20)><interfaceId(4)><selector(4)>`.

## LSP Ecosystem

| LSP | Name | Purpose |
|-----|------|---------|
| LSP0 (`0x24871b3d`) | ERC725Account | Smart contract account (UP) |
| LSP1 (`0x6bb56a14`) | UniversalReceiver | Notification hooks |
| LSP2 | ERC725Y JSON Schema | Key encoding for on-chain data |
| LSP3 | Profile Metadata | Name, avatar, links, tags |
| LSP4 | Digital Asset Metadata | Token name, symbol, type |
| LSP5 | ReceivedAssets | Tracks owned tokens/NFTs |
| LSP6 (`0x23f34c62`) | KeyManager | Permission-based access control |
| LSP7 (`0xc52d6008`) | DigitalAsset | Fungible tokens (like ERC20) |
| LSP8 (`0x3a271706`) | IdentifiableDigitalAsset | NFTs (bytes32 token IDs) |
| LSP9 (`0x28af17e6`) | Vault | Sub-account for asset segregation |
| LSP28 | The Grid | Customizable profile grid layouts |
| LSP14 (`0x94be5999`) | Ownable2Step | Two-step ownership transfer |
| LSP25 (`0x5ac79908`) | ExecuteRelayCall | Gasless meta-transactions |
| LSP26 (`0x2b299cea`) | FollowerSystem | On-chain follow/unfollow |

Full ABIs, interface IDs, and ERC725Y data keys are in `lib/constants.js`.

## VerifiableURI Encoding (LSP2)

Used for LSP3 profile metadata, LSP4 asset metadata, and any on-chain JSON reference.

**Format (hex):** `0x` + `0000` (2 bytes verification method) + `6f357c6a` (4 bytes = keccak256(utf8) hash function) + `0020` (2 bytes = hash length 32) + `<keccak256 hash>` (32 bytes) + `<url as UTF-8 hex>`

**Header is always `00006f357c6a0020` (16 hex chars = 8 bytes).**

```javascript
const jsonBytes = fs.readFileSync('metadata.json');
const jsonHash = ethers.keccak256(jsonBytes);
const url = `ipfs://${cid}`;
const urlHex = Buffer.from(url, 'utf8').toString('hex');
const verifiableURI = '0x' + '00006f357c6a0020' + jsonHash.slice(2) + urlHex;
```

**Decoding:**
```javascript
const hex = data.slice(2);        // remove 0x
// Skip: 0000(4) + 6f357c6a(8) + 0020(4) + hash(64) = 80 hex chars
const url = Buffer.from(hex.slice(80), 'hex').toString('utf8');
```

**⚠️ Common mistakes:**
1. **Forgetting `0020`** — the 2-byte hash length between the hash function selector and the actual hash. Without it, the URL offset is wrong and parsers read garbage, breaking the entire profile.
2. **Not pinning to a public IPFS service before setting on-chain** — local IPFS nodes are not reachable by gateways. Always pin via a service (e.g. Forever Moments Pinata proxy at `POST /api/pinata`) and verify the file is accessible via `https://api.universalprofile.cloud/ipfs/<CID>` BEFORE submitting the on-chain transaction.
3. **Hash must match the exact bytes stored on IPFS** — compute keccak256 from the exact JSON string you upload, not a re-serialized version.
4. **Using `hashFunction`/`hash` instead of `verification` object** in LSP3 metadata JSON — image entries (profileImage, backgroundImage) should use `{ "verification": { "method": "keccak256(bytes)", "data": "0x..." }, "url": "ipfs://..." }` format, NOT the legacy `{ "hashFunction": "...", "hash": "0x..." }` format.

**LSP3Profile data key:** `0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5`

### Updating LSP3 Profile Metadata — Full Procedure

1. **Read current profile** — `getData(LSP3_KEY)` → decode VerifiableURI → fetch JSON from IPFS
2. **Modify the JSON** — update fields (name, description, links, images, etc.)
3. **Use `verification` format for images** — `{ verification: { method: "keccak256(bytes)", data: "0x..." }, url: "ipfs://..." }`
4. **Pin new images to IPFS** — upload via pinning service, get CID, verify accessible
5. **Pin updated JSON to IPFS** — upload, get CID, verify accessible via gateway
6. **Compute hash** — `keccak256(exactJsonBytes)` of the uploaded file
7. **Encode VerifiableURI** — `0x00006f357c6a0020` + hash + url hex
8. **Set on-chain** — `up.setData(LSP3_KEY, verifiableUri)` from controller
9. **Verify** — read back on-chain data, decode, fetch from IPFS, confirm profile loads

**NEVER submit the on-chain transaction until step 5 is verified.**

**LSP28TheGrid data key:** `0x724141d9918ce69e6b8afcf53a91748466086ba2c74b94cab43c649ae2ac23ff`

## LSP28 — The Grid

Customizable grid layouts for profiles/tokens. Stored as VerifiableURI at the LSP28 data key.

```json
{
  "LSP28TheGrid": [{
    "title": "My Grid",
    "gridColumns": 2,
    "visibility": "public",
    "grid": [
      { "width": 1, "height": 1, "type": "IFRAME", "properties": { "src": "https://..." } },
      { "width": 1, "height": 1, "type": "TEXT", "properties": { "title": "Hello", "text": "World", "backgroundColor": "#1a1a2e", "textColor": "#fff", "link": "https://..." } },
      { "width": 2, "height": 2, "type": "IMAGES", "properties": { "type": "grid", "images": ["https://..."] } },
      { "width": 1, "height": 1, "type": "X", "properties": { "type": "post", "username": "handle", "id": "tweetId", "theme": "dark" } }
    ]
  }]
}
```

**Grid types:** `IFRAME`, `TEXT`, `IMAGES`, `X` (Twitter embed), `INSTAGRAM`, `QR_CODE`, `ELFSIGHT` (custom widget).
**Recommended:** `gridColumns` 2–4, `width`/`height` 1–3.

## setData via Gasless Relay (Direct Pattern)

For setting ERC725Y data (LSP3 profile, LSP28 grid, custom keys) via relay — use `setData` payload directly (do NOT wrap in `execute`):

```javascript
// 1. Build setData payload
const iface = new ethers.Interface(['function setData(bytes32 dataKey, bytes dataValue)']);
const payload = iface.encodeFunctionData('setData', [dataKey, verifiableURI]);

// 2. Get nonce from KeyManager
const km = new ethers.Contract(KM_ADDRESS, ['function getNonce(address,uint128) view returns (uint256)'], provider);
const nonce = await km.getNonce(controllerAddress, 0);

// 3. LSP25 signature
const encoded = ethers.solidityPacked(
  ['uint256','uint256','uint256','uint256','uint256','bytes'],
  [25, chainId, nonce, '0x' + '00'.repeat(32), 0, payload]
);
const msg = new Uint8Array([0x19, 0x00, ...ethers.getBytes(KM_ADDRESS), ...ethers.getBytes(encoded)]);
const signature = ethers.Signature.from(new ethers.SigningKey(privateKey).sign(ethers.keccak256(msg))).serialized;

// 4. Submit to relay
await fetch('https://relayer.mainnet.lukso.network/api/execute', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: UP, transaction: { abi: payload, signature, nonce: Number(nonce), validityTimestamps: '0x0' } })
});
```

**⚠️ Key distinction:** `setData` payload goes directly to the KeyManager — do NOT wrap it in `execute(CALL, self, setData(...))`. The KeyManager forwards calls to the UP automatically. Only use `execute()` wrapper for operations targeting *other* contracts.

## Network Config

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | 42 | 4201 |
| RPC | `https://42.rpc.thirdweb.com` | `https://rpc.testnet.lukso.network` |
| Explorer | `https://explorer.lukso.network` | `https://explorer.testnet.lukso.network` |
| Relay | `https://relayer.mainnet.lukso.network/api` | `https://relayer.testnet.lukso.network/api` |
| Token | LYX (18 dec) | LYXt (18 dec) |

## Security

### Permission Best Practices
- Grant minimum permissions. Prefer CALL over SUPER_CALL.
- Use AllowedCalls/AllowedERC725YDataKeys to restrict access.
- Avoid DELEGATECALL and CHANGEOWNER unless absolutely necessary.
- Use validity timestamps for relay calls.
- Test on testnet (chain 4201) first.
- Never log private keys.

### Key Management
- Restrict key file permissions: `chmod 600` on all credential files
- Private keys are only loaded into memory for signing, then cleared
- Use a dedicated controller key with minimal permissions — never use the UP owner key
- The `config set` command is restricted to safe keys only — `keystorePath` and `profiles` cannot be modified at runtime to prevent path redirection attacks
- Never log, print, or transmit private keys

### Network Access
This skill only communicates with known LUKSO ecosystem endpoints:
- **RPC:** `https://42.rpc.thirdweb.com` (mainnet), `https://rpc.testnet.lukso.network` (testnet)
- **Relay:** `https://relayer.mainnet.lukso.network/api` (gasless transactions)
- **IPFS:** `https://api.universalprofile.cloud/ipfs/` (metadata), `https://www.forevermoments.life/api/pinata` (pinning)
- **Forever Moments API:** `https://www.forevermoments.life/api/agent/v1` (NFT minting)

No other external network calls are made. All transaction signing happens locally.

## Forever Moments (NFT Moments & Collections)

Forever Moments is a social NFT platform on LUKSO. The Agent API lets you mint Moment NFTs, join/create collections, and pin images to IPFS — all via gasless relay.

**Base URL:** `https://www.forevermoments.life/api/agent/v1`

### IPFS Pinning

```bash
# Pin image via FM's Pinata proxy (multipart form upload)
POST /api/pinata   # NOTE: /api/pinata, NOT /api/agent/v1/pinata
Content-Type: multipart/form-data
Body: file=@image.png
Response: { "IpfsHash": "Qm...", "PinSize": 123456 }
```

### Relay Flow (3-step pattern for all on-chain actions)

1. **Build** — call build endpoint → get `derived.upExecutePayload`
2. **Prepare** — `POST /relay/prepare` with payload → get `hashToSign` + `nonce`
3. **Sign & Submit** — sign `hashToSign` as RAW DIGEST (not `signMessage`!) → `POST /relay/submit`

```javascript
// Step 1: Build (example: mint moment)
const build = await fetch(`${API}/moments/build-mint`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userUPAddress: UP, collectionUP: COLLECTION, metadataJson: { LSP4Metadata: { name, description, images, icon, tags } } })
});
const { data: { derived: { upExecutePayload } } } = await build.json();

// Step 2: Prepare
const prep = await fetch(`${API}/relay/prepare`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ upAddress: UP, controllerAddress: CONTROLLER, payload: upExecutePayload })
});
const { data: { hashToSign, nonce, relayerUrl } } = await prep.json();

// Step 3: Sign as raw digest + submit
const signature = ethers.Signature.from(new ethers.SigningKey(privateKey).sign(hashToSign)).serialized;
await fetch(`${API}/relay/submit`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ upAddress: UP, payload: upExecutePayload, signature, nonce, validityTimestamps: '0x0', relayerUrl })
});
```

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/collections/build-join` | POST | Join an existing collection |
| `/collections/build-create` | POST | Create collection (step 1: LSP23 deploy) |
| `/collections/finalize-create` | POST | Finalize collection (step 2: register) |
| `/moments/build-mint` | POST | Mint a Moment NFT in a collection |
| `/relay/prepare` | POST | Get hashToSign + nonce for relay |
| `/relay/submit` | POST | Submit signed relay tx to LUKSO relayer |
| `/api/pinata` | POST | Pin file to IPFS (multipart) |

### Metadata Format (LSP4)

```json
{
  "LSP4Metadata": {
    "name": "Moment Title",
    "description": "Description text",
    "images": [[{ "width": 1024, "height": 1024, "url": "ipfs://Qm..." }]],
    "icon": [{ "width": 1024, "height": 1024, "url": "ipfs://Qm..." }],
    "tags": ["tag1", "tag2"],
    "createdAt": "2026-02-08T16:30:00.000Z"
  }
}
```

Pass `metadataJson` to build-mint and the API auto-pins it to IPFS.

### Key Notes

- **Signing:** The `hashToSign` from `/relay/prepare` is already a full hash — sign it as a raw digest with `SigningKey.sign()`, NOT `wallet.signMessage()`
- **Join before mint:** You may need to join a collection before minting. If join fails with gas estimation error, you might already be a member
- **Collection creation** is 2-step: `build-create` (deploys contracts via LSP23) → `finalize-create` (registers)
- **Known collection:** "Art by the Machine" = `0x439f6793b10b0a9d88ad05293a074a8141f19d77`

### Forever Moments URL Patterns

| Page | URL |
|------|-----|
| Collection | `https://www.forevermoments.life/collections/<collectionAddress>` |
| Moment | `https://www.forevermoments.life/moments/<momentTokenAddress>` |
| Profile | `https://www.forevermoments.life/profile/<upAddress>` |
| Feed | `https://www.forevermoments.life/moments` |

## Error Codes

| Code | Cause |
|------|-------|
| `UP_PERMISSION_DENIED` | Controller lacks required permission |
| `UP_RELAY_FAILED` | Relay execution error — check quota |
| `UP_INVALID_SIGNATURE` | Wrong chainId, used nonce, or expired timestamps |
| `UP_QUOTA_EXCEEDED` | Monthly relay quota exhausted |
| `UP_NOT_AUTHORIZED` | Address not a controller — use [Authorization UI](https://lukso-network.github.io/openclaw-universalprofile-skill/) |

## Dependencies

- Node.js 18+ / ethers.js v6
- `@lukso/lsp-smart-contracts` / `@erc725/erc725.js` (optional)

## Links

- [LUKSO Docs](https://docs.lukso.tech/) · [Universal Everything (Profile Viewer)](https://universaleverything.io/) · [LSP6 Spec](https://docs.lukso.tech/standards/access-control/lsp6-key-manager) · [Authorization UI](https://lukso-network.github.io/openclaw-universalprofile-skill/)

**Profile URLs:** Always use `https://universaleverything.io/<address>` to link to Universal Profiles (NOT universalprofile.cloud).
