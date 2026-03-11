import { Command } from 'commander'
import { loadConfig, saveConfig, getConfigPath } from '../config.js'
import { CHAINS } from '../chains.js'
import { printSuccess, printError, printJson } from '../formatter.js'
import chalk from 'chalk'

export function registerConfigCommands(program: Command): void {
  const config = program
    .command('config')
    .description('Manage CLI configuration')

  config
    .command('set-key <apiKey>')
    .description('Set your Etherscan API key')
    .action((apiKey: string) => {
      const cfg = loadConfig()
      cfg.apiKey = apiKey
      saveConfig(cfg)
      printSuccess(`API key saved to ${getConfigPath()}`)
    })

  config
    .command('set-chain <chain>')
    .description('Set the default chain (e.g. ethereum, polygon, bsc)')
    .action((chain: string) => {
      if (!CHAINS[chain.toLowerCase()]) {
        printError(`Unknown chain: "${chain}". Run 'audit chains' to list all supported chains.`)
        process.exit(1)
      }
      const cfg = loadConfig()
      cfg.defaultChain = chain.toLowerCase()
      saveConfig(cfg)
      printSuccess(`Default chain set to: ${chain}`)
    })

  config
    .command('set-output <format>')
    .description('Set default output format (table or json)')
    .action((format: string) => {
      if (format !== 'table' && format !== 'json') {
        printError('Output format must be "table" or "json"')
        process.exit(1)
      }
      const cfg = loadConfig()
      cfg.defaultOutput = format as 'table' | 'json'
      saveConfig(cfg)
      printSuccess(`Default output set to: ${format}`)
    })

  config
    .command('set-rpc <chain> <url>')
    .description('Set an RPC URL for a chain (used by Foundry commands)')
    .action((chain: string, url: string) => {
      const cfg = loadConfig()
      cfg.rpcUrls = { ...cfg.rpcUrls, [chain.toLowerCase()]: url }
      saveConfig(cfg)
      printSuccess(`RPC URL for "${chain}" saved.`)
    })

  config
    .command('show')
    .description('Show current configuration')
    .option('--json', 'Output raw JSON')
    .action((opts: { json: boolean }) => {
      const cfg = loadConfig()
      const display = {
        ...cfg,
        apiKey: cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}${'*'.repeat(cfg.apiKey.length - 4)}` : undefined,
        configPath: getConfigPath(),
        envApiKey: process.env['ETHERSCAN_API_KEY'] ? 'set (ETHERSCAN_API_KEY env var)' : undefined,
      }
      if (opts.json) {
        printJson(display)
        return
      }
      console.log(`\n  ${chalk.bold('Audit CLI Config')}\n`)
      console.log(`  ${chalk.cyan('Path:')}         ${getConfigPath()}`)
      console.log(`  ${chalk.cyan('API Key:')}      ${display.apiKey ?? chalk.gray('(not set)')}`)
      if (display.envApiKey) {
        console.log(`  ${chalk.cyan('Env Key:')}      ${display.envApiKey}`)
      }
      console.log(`  ${chalk.cyan('Default Chain:')}  ${cfg.defaultChain ?? chalk.gray('ethereum')}`)
      console.log(`  ${chalk.cyan('Default Output:')} ${cfg.defaultOutput ?? chalk.gray('table')}`)
      if (cfg.rpcUrls && Object.keys(cfg.rpcUrls).length > 0) {
        console.log(`  ${chalk.cyan('RPC URLs:')}`)
        for (const [chain, url] of Object.entries(cfg.rpcUrls)) {
          console.log(`    ${chalk.gray(chain + ':')} ${url}`)
        }
      } else {
        console.log(`  ${chalk.cyan('RPC URLs:')}       ${chalk.gray('(none set)')}`)
      }
      console.log()
    })
}
