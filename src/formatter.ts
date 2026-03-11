import chalk from 'chalk'
import Table from 'cli-table3'
import type { Transaction, TokenTransfer, GasOracle, ContractSourceCode, TokenInfo, BlockReward, TransactionStatus, TransactionReceiptStatus } from './types.js'

export type OutputFormat = 'table' | 'json'

// --- Utilities ---

export function formatEther(wei: string, decimals = 18): string {
  if (!wei || wei === '0') return '0'
  try {
    const big = BigInt(wei)
    const divisor = 10n ** BigInt(decimals)
    const whole = big / divisor
    const remainder = big % divisor
    if (remainder === 0n) return whole.toString()
    const remStr = remainder.toString().padStart(decimals, '0').replace(/0+$/, '')
    return `${whole}.${remStr}`
  } catch {
    return wei
  }
}

export function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function formatTimestamp(ts: string): string {
  const ms = parseInt(ts, 10) * 1000
  if (isNaN(ms)) return ts
  return new Date(ms).toLocaleString()
}

export function formatTxHash(hash: string): string {
  if (!hash || hash.length < 10) return hash
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`
}

export function formatGwei(gwei: string): string {
  return `${gwei} Gwei`
}

// --- Generic output ---

export function printTable(headers: string[], rows: (string | number)[][]): void {
  const table = new Table({
    head: headers.map(h => chalk.cyan(h)),
    style: { head: [], border: [] },
  })
  for (const row of rows) {
    table.push(row.map(c => String(c)))
  }
  console.log(table.toString())
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

export function printSuccess(msg: string): void {
  console.log(chalk.green('✓') + ' ' + msg)
}

export function printError(msg: string): void {
  console.error(chalk.red('✗') + ' ' + msg)
}

export function handleError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err)
  printError(msg)
  process.exit(1)
}

// --- Per-command formatters ---

export function formatBalance(wei: string, symbol: string, address: string, chainId: number, format: OutputFormat): void {
  if (format === 'json') {
    printJson({ address, balance: wei, symbol, chainId })
    return
  }
  const eth = formatEther(wei)
  console.log(`\n  ${chalk.bold('Address:')} ${address}`)
  console.log(`  ${chalk.bold('Balance:')} ${chalk.yellow(eth)} ${symbol}\n`)
}

export function formatTransactionList(txs: Transaction[], symbol: string, format: OutputFormat): void {
  if (format === 'json') {
    printJson(txs)
    return
  }
  if (txs.length === 0) {
    console.log(chalk.yellow('No transactions found.'))
    return
  }
  printTable(
    ['Hash', 'Block', 'Time', 'From', 'To', `Value (${symbol})`, 'Status'],
    txs.map(tx => [
      formatTxHash(tx.hash),
      tx.blockNumber,
      formatTimestamp(tx.timeStamp),
      formatAddress(tx.from),
      tx.to ? formatAddress(tx.to) : chalk.gray('(contract creation)'),
      formatEther(tx.value),
      tx.isError === '1' ? chalk.red('Failed') : chalk.green('Success'),
    ])
  )
  console.log(chalk.gray(`  Showing ${txs.length} transaction(s)`))
}

export function formatTokenTransfers(transfers: TokenTransfer[], format: OutputFormat): void {
  if (format === 'json') {
    printJson(transfers)
    return
  }
  if (transfers.length === 0) {
    console.log(chalk.yellow('No token transfers found.'))
    return
  }
  printTable(
    ['Hash', 'Block', 'Time', 'From', 'To', 'Value', 'Token'],
    transfers.map(t => [
      formatTxHash(t.hash),
      t.blockNumber,
      formatTimestamp(t.timeStamp),
      formatAddress(t.from),
      formatAddress(t.to),
      t.tokenID != null ? `#${t.tokenID}` : formatEther(t.value, parseInt(t.tokenDecimal || '18', 10)),
      `${t.tokenSymbol} (${t.tokenName})`,
    ])
  )
  console.log(chalk.gray(`  Showing ${transfers.length} transfer(s)`))
}

export function formatGasOracle(gas: GasOracle, format: OutputFormat): void {
  if (format === 'json') {
    printJson(gas)
    return
  }
  console.log(`\n  ${chalk.bold('Gas Prices')} (block #${gas.LastBlock})\n`)
  const table = new Table({ style: { head: [], border: [] } })
  table.push(
    [chalk.green('Safe (slow)'), chalk.green(formatGwei(gas.SafeGasPrice))],
    [chalk.yellow('Standard'),   chalk.yellow(formatGwei(gas.ProposeGasPrice))],
    [chalk.red('Fast'),          chalk.red(formatGwei(gas.FastGasPrice))],
    [chalk.gray('Base fee'),     chalk.gray(formatGwei(gas.suggestBaseFee))],
  )
  console.log(table.toString())
}

export function formatContractSource(sources: ContractSourceCode[], address: string, format: OutputFormat): void {
  if (format === 'json') {
    printJson(sources)
    return
  }
  if (!sources.length || !sources[0]?.ContractName) {
    console.log(chalk.yellow('Contract not verified or not found.'))
    return
  }
  const s = sources[0]!
  const table = new Table({ style: { head: [], border: [] } })
  table.push(
    ['Contract',    s.ContractName],
    ['Compiler',    s.CompilerVersion],
    ['Optimization', s.OptimizationUsed === '1' ? `Yes (${s.Runs} runs)` : 'No'],
    ['EVM Version', s.EVMVersion || 'default'],
    ['License',     s.LicenseType || 'None'],
    ['Proxy',       s.Proxy === '1' ? `Yes → ${s.Implementation}` : 'No'],
  )
  console.log(`\n  ${chalk.bold('Contract:')} ${address}\n`)
  console.log(table.toString())
  console.log(chalk.gray(`\n  Use --json to get full source code and ABI.\n`))
}

export function formatTokenInfo(info: TokenInfo, format: OutputFormat): void {
  if (format === 'json') {
    printJson(info)
    return
  }
  const table = new Table({ style: { head: [], border: [] } })
  table.push(
    ['Name',         info.tokenName],
    ['Symbol',       info.symbol],
    ['Type',         info.tokenType],
    ['Total Supply', formatEther(info.totalSupply, parseInt(info.divisor || '18', 10))],
    ['Price (USD)',  info.tokenPriceUSD ? `$${info.tokenPriceUSD}` : 'N/A'],
    ['Website',      info.officialSite || info.website || 'N/A'],
    ['Verified',     info.blueCheckmark === 'true' ? chalk.cyan('Yes') : 'No'],
  )
  console.log(`\n  ${chalk.bold('Token:')} ${info.contractAddress}\n`)
  console.log(table.toString())
}

export function formatBlockReward(block: BlockReward, format: OutputFormat): void {
  if (format === 'json') {
    printJson(block)
    return
  }
  const table = new Table({ style: { head: [], border: [] } })
  table.push(
    ['Block',    block.blockNumber],
    ['Time',     formatTimestamp(block.timeStamp)],
    ['Miner',    block.blockMiner],
    ['Reward',   `${formatEther(block.blockReward)} ETH`],
    ['Uncles',   String(block.uncles.length)],
  )
  console.log(`\n  ${chalk.bold('Block Reward')}\n`)
  console.log(table.toString())
}

export function formatTxStatus(status: TransactionStatus, txhash: string, format: OutputFormat): void {
  if (format === 'json') {
    printJson({ txhash, ...status })
    return
  }
  const isError = status.isError === '1'
  console.log(`\n  ${chalk.bold('TX:')} ${txhash}`)
  console.log(`  ${chalk.bold('Status:')} ${isError ? chalk.red('Failed') : chalk.green('Success')}`)
  if (isError && status.errDescription) {
    console.log(`  ${chalk.bold('Error:')}  ${chalk.red(status.errDescription)}`)
  }
  console.log()
}

export function formatTxReceipt(receipt: TransactionReceiptStatus, txhash: string, format: OutputFormat): void {
  if (format === 'json') {
    printJson({ txhash, ...receipt })
    return
  }
  const success = receipt.status === '1'
  console.log(`\n  ${chalk.bold('TX:')}     ${txhash}`)
  console.log(`  ${chalk.bold('Receipt:')} ${success ? chalk.green('Success (1)') : chalk.red('Failed (0)')}`)
  console.log()
}
