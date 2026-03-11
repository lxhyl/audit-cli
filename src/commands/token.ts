import { Command } from 'commander'
import { loadConfig, requireApiKey, requireChain } from '../config.js'
import { EtherscanClient } from '../client.js'
import { resolveChain } from '../chains.js'
import { formatTokenInfo, handleError, type OutputFormat } from '../formatter.js'
import type { TokenInfo } from '../types.js'

export function registerTokenCommand(program: Command): void {
  const token = program
    .command('token')
    .description('Query token information')

  token
    .command('info <contractAddress>')
    .description('Get token info (name, symbol, supply, price)')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('--json', 'Output raw JSON')
    .action(async (contractAddress: string, opts: { chain?: string; json?: boolean }) => {
      const config = loadConfig()
      const apiKey = requireApiKey(config)
      const chainName = requireChain(opts, config)
      const chainId = resolveChain(chainName)
      const format: OutputFormat = opts.json ? 'json' : (config.defaultOutput ?? 'table')

      const client = new EtherscanClient(apiKey, chainId)
      try {
        const infos = await client.call<TokenInfo[]>('token', 'tokeninfo', {
          contractaddress: contractAddress,
        })
        if (!infos?.length) {
          console.log('No token info found.')
          return
        }
        formatTokenInfo(infos[0]!, format)
      } catch (err) {
        handleError(err)
      }
    })
}
