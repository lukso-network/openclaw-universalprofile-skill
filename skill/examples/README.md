# Example Metadata Files

These are template and example files for use with `up profile update` and `up grid update` commands.

## File Types

### `.example` Files (Recommended Starting Point)
- **profile.json.example** - Real working example (🆙chan's profile)
- **grid.json.example** - Real working example

**Use these to:**
- See the correct format
- Copy and modify for your own profile
- Understand required fields

### `.template` Files (For Customization)
- **profile.json.template** - Blank template with placeholders
- **grid.json.template** - Blank template with placeholders

**Use these to:**
- Start from scratch
- Fill in your own values

---

## How to Use

### Quick Start (Recommended)

1. **Copy the example file:**
   ```bash
   cp examples/profile.json.example my-profile.json
   cp examples/grid.json.example my-grid.json
   ```

2. **Edit with your information:**
   - Replace `name`, `description`, `tags`
   - Update image CIDs with your own IPFS CIDs
   - Change `ownerUP` to your Universal Profile address

3. **Upload your images to IPFS first:**
   ```bash
   # Use Pinata web interface or CLI
   # Get CID after upload
   ```

4. **Run the update command:**
   ```bash
   # One-time setup: Create ~/.openclaw/credentials/pinata.json
   up profile update --up 0xYourUP --key 0xYourKey --json my-profile.json
   up grid update --up 0xYourUP --key 0xYourKey --json my-grid.json
   ```

---

## Important Notes

### ⚠️ Never Use Placeholder CIDs

**Wrong:**
```json
"url": "ipfs://QmYourImageCIDHere"  ← This will 404!
```

**Right:**
```json
"url": "ipfs://QmWZtr9GGsYH97jjJKrL3xoYnu8AqyXJKkXBuXjfufEPjD"  ← Real CID
```

### Image Hash

For each image, compute the keccak256 hash:
```javascript
const hash = ethers.keccak256(ethers.toUtf8Bytes(imageContent));
```

The update command will automatically:
1. Upload JSON to IPFS
2. Compute the correct hash
3. Build VerifiableURI in legacy format (89 bytes)
4. Update on-chain

---

## File Structure

### Profile (LSP3)
```json
{
  "LSP3Profile": {
    "name": "Your Name",
    "description": "Your bio",
    "profileImage": [{"url": "ipfs://Qm..."}],
    "backgroundImage": [{"url": "ipfs://Qm..."}]
  }
}
```

### Grid (LSP28)
```json
{
  "LSP28TheGrid": [{
    "title": "Your Grid",
    "gridColumns": 2,
    "grid": [
      {"type": "TEXT", "properties": {...}},
      {"type": "IMAGES", "properties": {...}}
    ]
  }]
}
```

Grid item types: `TEXT`, `IMAGES`, `IFRAME`, `X`, `INSTAGRAM`, `QR_CODE`

---

See SKILL.md for full documentation.
