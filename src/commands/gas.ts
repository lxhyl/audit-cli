import { Command } from 'commander'
import { loadConfig, requireApiKey } from '../config.js'
import { EtherscanClient } from '../client.js'
import { resolveChain } from '../chains.js'
import { formatGasOracle, handleError, type OutputFormat } from '../formatter.js'
import type { GasOracle } from '../types.js'

export function registerGasCommand(program: Command): void {
  program
    .command('gas')
    .description('Get current gas price oracle')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { chain?: string; json?: boolean }) => {
      const config = loadConfig()
      const apiKey = requireApiKey(config)
      const chainName = opts.chain ?? config.defaultChain ?? 'ethereum'
      const chainId = resolveChain(chainName)
      const format: OutputFormat = opts.json ? 'json' : (config.defaultOutput ?? 'table')

      const client = new EtherscanClient(apiKey, chainId)
      try {
        const gas = await client.call<GasOracle>('gastracker', 'gasoracle')
        formatGasOracle(gas, format)
      } catch (err) {
        handleError(err)
      }
    })
}
