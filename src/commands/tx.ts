import { Command } from 'commander'
import { loadConfig, requireApiKey, requireChain } from '../config.js'
import { EtherscanClient } from '../client.js'
import { resolveChain } from '../chains.js'
import { formatTxStatus, formatTxReceipt, handleError, type OutputFormat } from '../formatter.js'
import type { TransactionStatus, TransactionReceiptStatus } from '../types.js'

export function registerTxCommand(program: Command): void {
  const tx = program
    .command('tx')
    .description('Query transaction details')

  tx
    .command('status <txhash>')
    .description('Get transaction execution status (success/fail)')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('--json', 'Output raw JSON')
    .action(async (txhash: string, opts: { chain?: string; json?: boolean }) => {
      const config = loadConfig()
      const apiKey = requireApiKey(config)
      const chainName = requireChain(opts, config)
      const chainId = resolveChain(chainName)
      const format: OutputFormat = opts.json ? 'json' : (config.defaultOutput ?? 'table')

      const client = new EtherscanClient(apiKey, chainId)
      try {
        const status = await client.call<TransactionStatus>('transaction', 'getstatus', { txhash })
        formatTxStatus(status, txhash, format)
      } catch (err) {
        handleError(err)
      }
    })

  tx
    .command('receipt <txhash>')
    .description('Get transaction receipt status')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('--json', 'Output raw JSON')
    .action(async (txhash: string, opts: { chain?: string; json?: boolean }) => {
      const config = loadConfig()
      const apiKey = requireApiKey(config)
      const chainName = requireChain(opts, config)
      const chainId = resolveChain(chainName)
      const format: OutputFormat = opts.json ? 'json' : (config.defaultOutput ?? 'table')

      const client = new EtherscanClient(apiKey, chainId)
      try {
        const receipt = await client.call<TransactionReceiptStatus>(
          'transaction', 'gettxreceiptstatus', { txhash }
        )
        formatTxReceipt(receipt, txhash, format)
      } catch (err) {
        handleError(err)
      }
    })
}
