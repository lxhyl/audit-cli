import { Command } from 'commander'
import { loadConfig, requireApiKey } from '../config.js'
import { EtherscanClient } from '../client.js'
import { resolveChain } from '../chains.js'
import { formatBlockReward, handleError, type OutputFormat } from '../formatter.js'
import type { BlockReward } from '../types.js'

export function registerBlockCommand(program: Command): void {
  program
    .command('block <number>')
    .description('Get block reward info by block number')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('--json', 'Output raw JSON')
    .action(async (number: string, opts: { chain?: string; json?: boolean }) => {
      const config = loadConfig()
      const apiKey = requireApiKey(config)
      const chainName = opts.chain ?? config.defaultChain ?? 'ethereum'
      const chainId = resolveChain(chainName)
      const format: OutputFormat = opts.json ? 'json' : (config.defaultOutput ?? 'table')

      const client = new EtherscanClient(apiKey, chainId)
      try {
        const block = await client.call<BlockReward>('block', 'getblockreward', {
          blockno: number,
        })
        formatBlockReward(block, format)
      } catch (err) {
        handleError(err)
      }
    })
}
