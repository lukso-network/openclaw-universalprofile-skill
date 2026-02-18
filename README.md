# 🐙 OpenClaw Universal Profile Skill

An [OpenClaw](https://openclaw.ai) skill for managing [LUKSO Universal Profiles](https://docs.lukso.tech/standards/accounts/lsp0-erc725account) — identity, permissions, tokens, and blockchain operations via direct or gasless relay transactions.

## What It Does

This skill gives your OpenClaw agent the ability to:

- **Manage Universal Profiles** — read/update profile metadata (LSP3), images, links, tags
- **On-chain social** — follow/unfollow profiles (LSP26), react to content
- **Token operations** — send/receive LSP7 tokens, interact with LSP8 NFTs
- **Permission management** — encode/decode LSP6 KeyManager permissions, generate authorization URLs
- **Gasless transactions** — relay service integration for gas-free operations
- **IPFS pinning** — pin metadata to IPFS before setting on-chain

## Installation

### Via ClawHub (recommended)

```bash
clawhub install universal-profile
```

### Manual

```bash
git clone https://github.com/lukso-network/openclaw-universalprofile-skill.git
cd openclaw-universalprofile-skill
npm install
```

## Setup

1. **Create a Universal Profile** at [my.universalprofile.cloud](https://my.universalprofile.cloud)
2. **Generate a controller key** and authorize it using the [Authorization UI](https://openclaw.universalprofile.cloud)
3. **Configure the skill:**

```bash
up profile configure <your-up-address> --chain lukso
```

4. **Store your controller key** (macOS Keychain recommended):

```bash
security add-generic-password \
  -a "<controller-address>" \
  -s "universalprofile-controller" \
  -l "UP Controller Key" \
  -D "Ethereum Private Key" \
  -w "<private-key>" \
  -T /usr/bin/security -U
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `up status` | Config, keys, connectivity check |
| `up profile info [address]` | View profile details |
| `up profile configure <address>` | Save UP address for use |
| `up key generate [--save]` | Generate controller keypair |
| `up permissions encode <perms>` | Encode permissions to bytes32 |
| `up permissions decode <hex>` | Decode permissions to names |
| `up permissions presets` | List available permission presets |
| `up authorize url` | Generate authorization URL |
| `up quota` | Check relay gas quota |

### Permission Presets

| Preset | Risk | Description |
|--------|------|-------------|
| `read-only` | 🟢 Low | View profile data only |
| `token-operator` | 🟡 Medium | Send/receive tokens |
| `nft-trader` | 🟡 Medium | Trade NFTs |
| `defi-trader` | 🟠 High | DeFi interactions |
| `profile-manager` | 🟡 Medium | Update profile metadata |
| `full-access` | 🔴 Critical | All permissions |

## Credentials

The skill looks for credentials in this order:

1. `UP_CREDENTIALS_PATH` environment variable
2. `~/.openclaw/universal-profile/config.json`
3. `~/.clawdbot/universal-profile/config.json`
4. `./credentials/config.json`

Key files: `UP_KEY_PATH` env → `~/.openclaw/credentials/universal-profile-key.json`

## Tech Stack

- **LUKSO Standards**: LSP0 (ERC725Account), LSP2 (ERC725YJSONSchema), LSP3 (Profile Metadata), LSP6 (KeyManager), LSP7 (Digital Asset), LSP8 (Identifiable Digital Asset), LSP26 (Follower System)
- **Libraries**: ethers.js, @erc725/erc725.js, @lukso/lsp-smart-contracts
- **Network**: LUKSO Mainnet (Chain ID: 42)

## Links

- [LUKSO Documentation](https://docs.lukso.tech)
- [LSP Standards](https://docs.lukso.tech/standards/introduction)
- [OpenClaw](https://openclaw.ai)
- [ClawHub](https://clawhub.com)

## License

MIT
