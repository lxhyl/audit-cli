import { Command } from 'commander'
import { spawnSync } from 'child_process'
import { loadConfig, requireChain, requireRpcUrl } from '../config.js'
import { handleError } from '../formatter.js'
import { checkFoundry } from '../foundry.js'
import chalk from 'chalk'

export function registerRunCommand(program: Command): void {
  program
    .command('run <txhash>')
    .description('Replay an on-chain transaction on a fork and show execution trace (requires Foundry)')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('--verbose', 'Show full call trace with sub-calls')
    .option('--label <addr:name>', 'Label an address in the trace (repeatable)', (v, acc: string[]) => [...acc, v], [] as string[])
    .addHelpText('after', `
Examples:
  audit run 0xabc123... --chain ethereum
  audit run 0xabc123... --chain arbitrum --verbose
  audit run 0xabc123... --label 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48:USDC`)
    .action(async (txhash: string, opts: { chain?: string; verbose?: boolean; label: string[] }) => {
      checkFoundry()
      const config = loadConfig()
      const chainName = requireChain(opts, config)
      const rpcUrl = requireRpcUrl(chainName, config)

      console.log(`\n  ${chalk.bold('Transaction Replay')}`)
      console.log(`  ${chalk.cyan('Tx:')}    ${txhash}`)
      console.log(`  ${chalk.cyan('Chain:')} ${chainName}`)
      console.log()

      const args = ['run', txhash, '--rpc-url', rpcUrl]
      if (opts.verbose) args.push('--verbose')
      for (const label of opts.label) {
        args.push('--label', label)
      }

      try {
        // Stream cast run output directly — it already formats traces nicely
        const result = spawnSync('cast', args, {
          stdio: 'inherit',
          encoding: 'utf-8',
          timeout: 120000,
        })
        if (result.status !== 0) process.exit(result.status ?? 1)
      } catch (err) {
        handleError(err)
      }
    })
}
