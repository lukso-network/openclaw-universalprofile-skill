---
name: universal-profile
description: Manage LUKSO Universal Profile interactions - identity, permissions, and blockchain operations
version: 1.0.0
author: Clawdbot
---

# Universal Profile Skill

Enables Clawdbot to interact with LUKSO blockchain via Universal Profiles. Supports profile management, permission handling, key generation, and transaction execution.

## Quick Start

```bash
# 1. Generate a controller key
up key generate

# 2. Check configuration status
up status

# 3. Get profile information
up profile info <address>
```

## Commands

### Key Management

#### `up key generate`
Generate a new controller key pair for Clawdbot.

```bash
up key generate [--save] [--password <password>]
```

Options:
- `--save` - Save the key to encrypted keystore
- `--password` - Password for keystore encryption (prompts if not provided)

Example:
```
$ up key generate --save
🔐 Generating new controller key...
✓ Address: 0x1234...abcd
✓ Public Key: 0x04abcd...
✓ Key saved to keystore

⚠️ IMPORTANT: Backup your key securely!
```

#### `up key list`
List all stored controller keys.

```bash
up key list
```

#### `up key export`
Export a key for backup purposes.

```bash
up key export <address> [--format json|mnemonic]
```

### Profile Management

#### `up status`
Check current UP configuration and connection status.

```bash
up status [--chain <chain>]
```

Example:
```
$ up status
┌─────────────────────────────────────┐
│ Universal Profile Status            │
├─────────────────────────────────────┤
│ Controller: 0x1234...abcd           │
│ Default Chain: lukso (42)           │
│ Profiles Configured: 1              │
│ Keystore: ✓ Encrypted               │
└─────────────────────────────────────┘
```

#### `up profile info`
Display information about a Universal Profile.

```bash
up profile info [<address>] [--chain <chain>]
```

Example:
```
$ up profile info 0x1234...
┌─────────────────────────────────────┐
│ Universal Profile Info              │
├─────────────────────────────────────┤
│ Address: 0x1234...abcd              │
│ Name: MyProfile                     │
│ Key Manager: 0x5678...efgh          │
│ Controllers: 2                      │
│ Balance: 45.23 LYX                  │
│ LSP7 Tokens: 5                      │
│ LSP8 NFTs: 12                       │
└─────────────────────────────────────┘
```

#### `up profile configure`
Configure a Universal Profile for use with Clawdbot.

```bash
up profile configure <up-address> [--key-manager <km-address>] [--chain <chain>]
```

### Permission System

#### `up permissions encode`
Encode permissions into bytes32 format.

```bash
up permissions encode <permission1> [<permission2> ...]
```

Available permissions:
- `CHANGEOWNER` - Transfer profile ownership
- `ADDCONTROLLER` - Add new controllers
- `EDITPERMISSIONS` - Modify controller permissions
- `ADDEXTENSIONS` - Add profile extensions
- `CHANGEEXTENSIONS` - Modify profile extensions
- `ADDUNIVERSALRECEIVERDELEGATE` - Add receiver delegates
- `CHANGEUNIVERSALRECEIVERDELEGATE` - Modify receiver delegates
- `REENTRANCY` - Allow reentrant calls
- `SUPER_TRANSFERVALUE` - Transfer value without restrictions
- `TRANSFERVALUE` - Transfer native tokens
- `SUPER_CALL` - Call any contract without restrictions
- `CALL` - Call contracts (with AllowedCalls)
- `SUPER_STATICCALL` - Static call without restrictions
- `STATICCALL` - Static call contracts
- `SUPER_DELEGATECALL` - Delegatecall without restrictions
- `DELEGATECALL` - Delegatecall (dangerous)
- `DEPLOY` - Deploy contracts
- `SUPER_SETDATA` - Set any data
- `SETDATA` - Set data (with AllowedERC725YDataKeys)
- `ENCRYPT` - Encrypt data
- `DECRYPT` - Decrypt data
- `SIGN` - Sign messages
- `EXECUTE_RELAY_CALL` - Execute relay calls

Example:
```
$ up permissions encode CALL TRANSFERVALUE STATICCALL
0x0000000000000000000000000000000000000000000000000000000000040801
```

#### `up permissions decode`
Decode permissions from bytes32 format.

```bash
up permissions decode <permissions-hex>
```

Example:
```
$ up permissions decode 0x0000000000000000000000000000000000000000000000000000000000040801
Permissions:
  ✓ TRANSFERVALUE (0x1)
  ✓ CALL (0x800)
  ✓ STATICCALL (0x40000)
```

#### `up permissions presets`
List available permission presets.

```bash
up permissions presets
```

Presets:
- `read-only` - Can only read data (STATICCALL)
- `token-operator` - Can transfer tokens/NFTs (CALL + TRANSFERVALUE)
- `nft-trader` - Marketplace operations
- `defi-trader` - DEX + marketplace operations
- `profile-manager` - Can update profile data
- `full-access` - All permissions (use with caution)

#### `up permissions validate`
Validate a permission set for security risks.

```bash
up permissions validate <permissions-hex>
```

Example:
```
$ up permissions validate 0x0001
⚠️ WARNING: CHANGEOWNER permission detected!
   This allows transferring profile ownership.
   Risk Level: CRITICAL

Recommendation: Only grant this permission to recovery addresses.
```

### Authorization

#### `up authorize url`
Generate authorization URL for users to add Clawdbot as controller.

```bash
up authorize url [--permissions <preset|hex>] [--chain <chain>]
```

Example:
```
$ up authorize url --permissions token-operator
✓ Controller Address: 0xabcd...1234

Authorization URL:
https://up-auth.example.com/?controller=0xabcd...&permissions=0x...&chain=42

QR Code saved to: /tmp/up-auth-qr.png

Instructions:
1. Open the URL in a browser with UP extension
2. Connect your Universal Profile
3. Review and approve the permissions
4. Clawdbot will be added as a controller
```

### Configuration

#### `up config show`
Display current configuration.

```bash
up config show
```

#### `up config set`
Set configuration values.

```bash
up config set <key> <value>
```

Keys:
- `defaultChain` - Default chain (lukso, lukso-testnet)
- `keystorePath` - Path to encrypted keystore
- `rpcUrl` - Custom RPC URL

#### `up config chain`
Configure chain-specific settings.

```bash
up config chain <chain> --rpc <url> [--explorer <url>]
```

## Configuration

Configuration is stored in `~/.clawdbot/skills/universal-profile/config.json`:

```json
{
  "keystorePath": "~/.clawdbot/skills/universal-profile/keystore.json",
  "defaultChain": "lukso",
  "chains": {
    "lukso": {
      "chainId": 42,
      "rpcUrl": "https://42.rpc.thirdweb.com",
      "explorer": "https://explorer.lukso.network"
    },
    "lukso-testnet": {
      "chainId": 4201,
      "rpcUrl": "https://rpc.testnet.lukso.network",
      "explorer": "https://explorer.testnet.lukso.network"
    }
  },
  "profiles": {
    "42": {
      "upAddress": "0x...",
      "keyManagerAddress": "0x...",
      "controllerAddress": "0x...",
      "permissions": "0x..."
    }
  }
}
```

## Security

### Key Storage
- Private keys are encrypted at rest using AES-256-GCM
- PBKDF2 with 100,000 iterations for key derivation
- Keys are never logged or exposed in output

### Permission Safety
- Dangerous permissions (CHANGEOWNER, DELEGATECALL) trigger warnings
- Permission validation before execution
- AllowedCalls restrictions recommended for CALL permission
- AllowedERC725YDataKeys restrictions recommended for SETDATA

### Best Practices
1. **Principle of Least Privilege** - Grant minimum necessary permissions
2. **Use Presets** - Start with restrictive presets, expand as needed
3. **Backup Keys** - Store encrypted backups securely
4. **Review Transactions** - Inspect payloads before signing
5. **Test First** - Use testnet before mainnet operations

## Error Codes

| Code | Description |
|------|-------------|
| `UP001` | Key not found in keystore |
| `UP002` | Invalid password for keystore |
| `UP003` | Profile not configured |
| `UP004` | Insufficient permissions |
| `UP005` | Invalid permission format |
| `UP006` | Chain not supported |
| `UP007` | RPC connection failed |
| `UP008` | Transaction failed |

## Dependencies

This skill requires:
- Node.js 18+
- ethers.js v6
- Network access to LUKSO RPC

## Links

- [LUKSO Documentation](https://docs.lukso.tech/)
- [LSP6 Key Manager](https://docs.lukso.tech/standards/universal-profile/lsp6-key-manager)
- [Universal Profile](https://universalprofile.cloud/)
