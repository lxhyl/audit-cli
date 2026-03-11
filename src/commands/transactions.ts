import { Command } from 'commander'
import { loadConfig, requireApiKey, requireChain } from '../config.js'
import { EtherscanClient } from '../client.js'
import { resolveChain, getChainSymbol } from '../chains.js'
import { formatTransactionList, handleError, type OutputFormat } from '../formatter.js'
import type { Transaction } from '../types.js'

export function registerTransactionsCommand(program: Command): void {
  program
    .command('txlist <address>')
    .description('Get transaction list for an address')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('-p, --page <page>', 'Page number', '1')
    .option('-l, --limit <limit>', 'Number of results per page (max 10000)', '25')
    .option('-s, --sort <sort>', 'Sort order: asc or desc', 'desc')
    .option('--start-block <block>', 'Start block number')
    .option('--end-block <block>', 'End block number')
    .option('--json', 'Output raw JSON')
    .action(async (address: string, opts: {
      chain?: string
      page: string
      limit: string
      sort: string
      startBlock?: string
      endBlock?: string
      json?: boolean
    }) => {
      const config = loadConfig()
      const apiKey = requireApiKey(config)
      const chainName = requireChain(opts, config)
      const chainId = resolveChain(chainName)
      const format: OutputFormat = opts.json ? 'json' : (config.defaultOutput ?? 'table')

      const client = new EtherscanClient(apiKey, chainId)
      try {
        const params: Record<string, string> = {
          address,
          page: opts.page,
          offset: opts.limit,
          sort: opts.sort,
        }
        if (opts.startBlock) params['startblock'] = opts.startBlock
        if (opts.endBlock) params['endblock'] = opts.endBlock

        const txs = await client.call<Transaction[]>('account', 'txlist', params)
        const symbol = getChainSymbol(chainId)
        formatTransactionList(txs, symbol, format)
      } catch (err) {
        handleError(err)
      }
    })
}
