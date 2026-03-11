# audit

A CLI tool for querying EVM chains via the Etherscan API v2. Supports 25+ chains including Ethereum, Arbitrum, Polygon, BSC, Optimism, Base, and more.

## Installation

```bash
npm install -g .
```

## Configuration

Get a free API key at [etherscan.io/myapikey](https://etherscan.io/myapikey), then set it:

```bash
audit config set-key <YOUR_API_KEY>
```

Or use an environment variable:

```bash
export ETHERSCAN_API_KEY=<YOUR_API_KEY>
```

Other config commands:

```bash
audit config show                      # show current config
audit config set-chain arbitrum        # set default chain
audit config set-output json           # set default output format (table or json)
```

## Supported Chains

```bash
audit chains
```

25+ chains supported. All commands accept `-c <chain>` (chain name or chainId). If no `-c` is provided, the default chain set via `config set-chain` is used. Commands that involve an address **require** a chain to be specified.

## Commands

### balance

Get native token balance for an address.

```bash
audit balance <address> -c <chain> [--json]
```

```bash
audit balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 -c ethereum
audit balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 -c polygon
```

---

### txlist

Get transaction history for an address.

```bash
audit txlist <address> -c <chain> [-p <page>] [-l <limit>] [-s asc|desc] [--start-block <n>] [--end-block <n>] [--json]
```

```bash
audit txlist 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 -c ethereum
audit txlist 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 -c ethereum -l 10 -s asc
```

---

### transfers

Get token transfer events for an address.

```bash
audit transfers <address> -c <chain> [-t erc20|erc721|erc1155] [--token <contractAddress>] [-p <page>] [-l <limit>] [--json]
```

```bash
audit transfers 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 -c ethereum
audit transfers 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 -c ethereum -t erc721
audit transfers 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 -c ethereum --token 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

---

### tx

Query transaction status.

```bash
audit tx status <txhash> -c <chain> [--json]
audit tx receipt <txhash> -c <chain> [--json]
```

```bash
audit tx status 0xabc123... -c ethereum
audit tx receipt 0xabc123... -c arbitrum
```

---

### contract

Query contract ABI and verified source code.

```bash
audit contract abi <address> -c <chain> [--json]
audit contract source <address> -c <chain> [--print] [--save <dir>] [--json]
```

```bash
# View ABI
audit contract abi 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -c ethereum

# Show source metadata
audit contract source 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -c ethereum

# Print full source to stdout
audit contract source 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -c ethereum --print

# Save source files to a directory
audit contract source 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -c ethereum --save ./usdc-src
```

---

### call

Call a `view`/`pure` function on a contract via `eth_call`. Automatically fetches the ABI from Etherscan.

```bash
audit call <address> <functionName> [args...] -c <chain> [--abi <address>] [--from <address>] [--block <block>] [--json]
```

| Option | Description |
|--------|-------------|
| `--abi <address>` | Fetch ABI from this address instead of the target (useful for proxy contracts) |

```bash
# Read ERC20 name
audit call 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 name -c ethereum

# Read token balance
audit call 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 balanceOf 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 -c ethereum

# Pass array arguments
audit call 0x... getAmountsOut 1000000 "[0xWETH,0xUSDC]" -c arbitrum

# Proxy contract: use implementation ABI against the proxy address
audit call 0x<proxy> balanceOf 0x<wallet> -c arbitrum --abi 0x<implementation>
```

#### Proxy contract workflow

```bash
# 1. Detect proxy pattern and find the beacon address
audit proxy 0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8 -c arbitrum
#    → EIP-1967 beacon: 0xe72ba9418b5f2ce0a6a40501fe77c6839aa37333

# 2. Get the actual implementation from the beacon
audit call 0xe72ba9418b5f2ce0a6a40501fe77c6839aa37333 implementation -c arbitrum
#    → 0x3f770Ac673856F105b586bb393d122721265aD46

# 3. Call the proxy using the implementation's ABI
audit call 0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8 balanceOf 0x<wallet> -c arbitrum \
  --abi 0x3f770Ac673856F105b586bb393d122721265aD46
```

---

### storage

Read a raw storage slot from a contract via `eth_getStorageAt`. Accepts decimal or hex slot index. Auto-decodes the value as `uint256`, `address`, `bool`, and short `string`.

```bash
audit storage <address> <slot> -c <chain> [--block <block>] [--json]
```

```bash
audit storage 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 0 -c ethereum
audit storage 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 0x0 -c ethereum
```

---

### token

Get token metadata (name, symbol, decimals, total supply, price).

```bash
audit token info <contractAddress> -c <chain> [--json]
```

```bash
audit token info 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -c ethereum
```

---

### gas

Get current gas price oracle (low / average / high).

```bash
audit gas -c <chain> [--json]
```

```bash
audit gas -c ethereum
audit gas -c polygon
```

---

### block

Get block reward info by block number.

```bash
audit block <blockNumber> -c <chain> [--json]
```

```bash
audit block 19000000 -c ethereum
```

---

### proxy

Detect proxy pattern and resolve the implementation address. Checks all common proxy storage slots:

| Pattern | Standard | Notes |
|---------|----------|-------|
| EIP-1967 implementation | Most common | Used by Hardhat/Foundry by default |
| EIP-1967 beacon | BeaconProxy | Returns beacon address — call `beacon.implementation()` for the actual impl |
| EIP-1822 / UUPS | UUPS | Upgrade logic lives in the implementation itself |
| OpenZeppelin legacy | Pre-EIP-1967 | Deprecated but still in use |

```bash
audit proxy <address> -c <chain> [--block <block>] [--json]
```

```bash
audit proxy 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -c ethereum
audit proxy 0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8 -c arbitrum
```

> **BeaconProxy note:** The `proxy` command returns the beacon contract address, not the final implementation. Run `audit call <beacon> implementation -c <chain>` to resolve the actual logic contract.

---

## Rate Limiting

The free Etherscan API tier allows 3 requests/sec. The CLI automatically throttles to 2.5 req/sec and retries with exponential backoff (1s → 2s → 4s) if a rate limit error is returned.

---

## Config file location

```
~/.audit-cli/config.json
```
