import { Command } from 'commander'
import { loadConfig, requireApiKey, requireChain } from '../config.js'
import { EtherscanClient } from '../client.js'
import { resolveChain } from '../chains.js'
import { handleError, printJson } from '../formatter.js'
import chalk from 'chalk'
import Table from 'cli-table3'

function toHexSlot(slot: string): string {
  if (slot.startsWith('0x') || slot.startsWith('0X')) {
    return slot.toLowerCase()
  }
  // Decimal → hex, padded to 32 bytes
  return `0x${BigInt(slot).toString(16).padStart(64, '0')}`
}

function decodeStorageValue(hex: string): Record<string, string> {
  const raw = hex.toLowerCase().replace('0x', '').padStart(64, '0')
  const decoded: Record<string, string> = { hex }

  // Try to decode as common types
  try {
    const bigval = BigInt(hex)
    decoded['uint256'] = bigval.toString()
    decoded['int256'] = BigInt.asIntN(256, bigval).toString()
  } catch { /* skip */ }

  // Check if it looks like an address (last 20 bytes, leading zeros)
  if (raw.startsWith('0'.repeat(24))) {
    decoded['address'] = `0x${raw.slice(24)}`
  }

  // Check if it could be a bool
  if (raw === '0'.repeat(64)) decoded['bool'] = 'false'
  if (raw === '0'.repeat(63) + '1') decoded['bool'] = 'true'

  // Try to decode as UTF-8 string (short strings packed in storage)
  try {
    const bytes = Buffer.from(raw, 'hex')
    // Last byte may encode length for short strings (Solidity storage encoding)
    const lastByte = bytes[31]!
    if (lastByte % 2 === 0 && lastByte <= 62) {
      const len = lastByte / 2
      const str = bytes.slice(0, len).toString('utf8')
      if (/^[\x20-\x7E]*$/.test(str) && str.length > 0) {
        decoded['string (short)'] = JSON.stringify(str)
      }
    }
  } catch { /* skip */ }

  return decoded
}

export function registerStorageCommand(program: Command): void {
  program
    .command('storage <address> <slot>')
    .description('Read a storage slot from a contract (eth_getStorageAt)')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('--block <block>', 'Block number or "latest"', 'latest')
    .option('--json', 'Output raw JSON')
    .action(async (address: string, slot: string, opts: { chain?: string; block: string; json?: boolean }) => {
      const config = loadConfig()
      const apiKey = requireApiKey(config)
      const chainName = requireChain(opts, config)
      const chainId = resolveChain(chainName)

      const client = new EtherscanClient(apiKey, chainId)
      try {
        const hexSlot = toHexSlot(slot)
        const value = await client.proxy<string>('eth_getStorageAt', {
          address,
          position: hexSlot,
          tag: opts.block,
        })

        if (opts.json) {
          printJson({ address, slot: hexSlot, value, block: opts.block })
          return
        }

        const decoded = decodeStorageValue(value)
        console.log(`\n  ${chalk.bold('Storage Read')}`)
        console.log(`  ${chalk.cyan('Address:')} ${address}`)
        console.log(`  ${chalk.cyan('Slot:')}    ${hexSlot} (input: ${slot})`)
        console.log(`  ${chalk.cyan('Block:')}   ${opts.block}\n`)

        const table = new Table({ style: { head: [], border: [] } })
        for (const [type, val] of Object.entries(decoded)) {
          table.push([chalk.cyan(type), val])
        }
        console.log(table.toString())
        console.log()
      } catch (err) {
        handleError(err)
      }
    })
}
