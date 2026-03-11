import { Command } from 'commander'
import { loadConfig, requireApiKey, requireChain } from '../config.js'
import { EtherscanClient } from '../client.js'
import { resolveChain, getChainSymbol } from '../chains.js'
import { formatBalance, handleError, type OutputFormat } from '../formatter.js'

export function registerBalanceCommand(program: Command): void {
  program
    .command('balance <address>')
    .description('Get native token balance for an address')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('--json', 'Output raw JSON')
    .action(async (address: string, opts: { chain?: string; json?: boolean }) => {
      const config = loadConfig()
      const apiKey = requireApiKey(config)
      const chainName = requireChain(opts, config)
      const chainId = resolveChain(chainName)
      const format: OutputFormat = opts.json ? 'json' : (config.defaultOutput ?? 'table')

      const client = new EtherscanClient(apiKey, chainId)
      try {
        const balance = await client.call<string>('account', 'balance', {
          address,
          tag: 'latest',
        })
        const symbol = getChainSymbol(chainId)
        formatBalance(balance, symbol, address, chainId, format)
      } catch (err) {
        handleError(err)
      }
    })
}
