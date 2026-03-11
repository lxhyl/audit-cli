import { Command } from 'commander'
import { loadConfig, requireApiKey, requireChain } from '../config.js'
import { EtherscanClient } from '../client.js'
import { resolveChain } from '../chains.js'
import { formatTokenTransfers, handleError, type OutputFormat } from '../formatter.js'
import type { TokenTransfer } from '../types.js'

const TRANSFER_ACTIONS: Record<string, string> = {
  erc20:   'tokentx',
  erc721:  'tokennfttx',
  erc1155: 'token1155tx',
}

export function registerTransfersCommand(program: Command): void {
  program
    .command('transfers <address>')
    .description('Get token transfer events for an address')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('-t, --type <type>', 'Token type: erc20, erc721, erc1155', 'erc20')
    .option('--token <contractAddress>', 'Filter by token contract address')
    .option('-p, --page <page>', 'Page number', '1')
    .option('-l, --limit <limit>', 'Number of results per page', '25')
    .option('-s, --sort <sort>', 'Sort order: asc or desc', 'desc')
    .option('--json', 'Output raw JSON')
    .action(async (address: string, opts: {
      chain?: string
      type: string
      token?: string
      page: string
      limit: string
      sort: string
      json?: boolean
    }) => {
      const config = loadConfig()
      const apiKey = requireApiKey(config)
      const chainName = requireChain(opts, config)
      const chainId = resolveChain(chainName)
      const format: OutputFormat = opts.json ? 'json' : (config.defaultOutput ?? 'table')

      const tokenType = opts.type.toLowerCase()
      const action = TRANSFER_ACTIONS[tokenType]
      if (!action) {
        console.error(`Invalid type: "${opts.type}". Must be erc20, erc721, or erc1155.`)
        process.exit(1)
      }

      const client = new EtherscanClient(apiKey, chainId)
      try {
        const params: Record<string, string> = {
          address,
          page: opts.page,
          offset: opts.limit,
          sort: opts.sort,
        }
        if (opts.token) params['contractaddress'] = opts.token

        const transfers = await client.call<TokenTransfer[]>('account', action, params)
        formatTokenTransfers(transfers, format)
      } catch (err) {
        handleError(err)
      }
    })
}
