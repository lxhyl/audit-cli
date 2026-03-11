import { Command } from 'commander'
import { loadConfig, requireApiKey, requireChain } from '../config.js'
import { EtherscanClient } from '../client.js'
import { resolveChain } from '../chains.js'
import { handleError, printJson } from '../formatter.js'
import chalk from 'chalk'

// EIP-1967: logic implementation slot
const SLOT_EIP1967_IMPL = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
// EIP-1967: beacon slot
const SLOT_EIP1967_BEACON = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50'
// EIP-1822: UUPS
const SLOT_EIP1822 = '0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7'
// OpenZeppelin legacy (pre-EIP-1967)
const SLOT_OZ_LEGACY = '0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function slotToAddress(hex: string): string | null {
  const cleaned = hex.toLowerCase().replace('0x', '').padStart(64, '0')
  const addr = `0x${cleaned.slice(24)}`
  return addr === ZERO_ADDRESS ? null : addr
}

interface SlotResult {
  label: string
  slot: string
  address: string | null
}

export function registerProxyCommand(program: Command): void {
  program
    .command('proxy <address>')
    .description('Detect proxy pattern and resolve implementation address')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('--block <block>', 'Block number or "latest"', 'latest')
    .option('--json', 'Output raw JSON')
    .action(async (address: string, opts: { chain?: string; block: string; json?: boolean }) => {
      const config = loadConfig()
      const apiKey = requireApiKey(config)
      const chainName = requireChain(opts, config)
      const chainId = resolveChain(chainName)

      const client = new EtherscanClient(apiKey, chainId)

      const slots: { label: string; slot: string }[] = [
        { label: 'EIP-1967 (implementation)', slot: SLOT_EIP1967_IMPL },
        { label: 'EIP-1967 (beacon)',          slot: SLOT_EIP1967_BEACON },
        { label: 'EIP-1822 / UUPS',            slot: SLOT_EIP1822 },
        { label: 'OpenZeppelin legacy',         slot: SLOT_OZ_LEGACY },
      ]

      try {
        const results: SlotResult[] = []

        for (const { label, slot } of slots) {
          const raw = await client.proxy<string>('eth_getStorageAt', {
            address,
            position: slot,
            tag: opts.block,
          })
          results.push({ label, slot, address: slotToAddress(raw) })
        }

        const found = results.filter(r => r.address !== null)

        if (opts.json) {
          printJson({
            proxy: address,
            block: opts.block,
            results: results.map(r => ({ ...r, found: r.address !== null })),
          })
          return
        }

        console.log(`\n  ${chalk.bold('Proxy Detection')}`)
        console.log(`  ${chalk.cyan('Address:')} ${address}`)
        console.log(`  ${chalk.cyan('Block:')}   ${opts.block}\n`)

        if (found.length === 0) {
          console.log(`  ${chalk.gray('No proxy pattern detected. This may be a plain contract.')}\n`)
          return
        }

        for (const r of found) {
          console.log(`  ${chalk.green('✓')} ${chalk.bold(r.label)}`)
          console.log(`    ${chalk.cyan('Implementation:')} ${r.address}`)
          console.log(`    ${chalk.gray('Slot: ' + r.slot)}\n`)
        }
      } catch (err) {
        handleError(err)
      }
    })
}
