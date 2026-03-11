#!/usr/bin/env node
import { Command } from 'commander'
import { registerConfigCommands } from './commands/config.js'
import { registerBalanceCommand } from './commands/balance.js'
import { registerTransactionsCommand } from './commands/transactions.js'
import { registerTransfersCommand } from './commands/transfers.js'
import { registerContractCommands } from './commands/contract.js'
import { registerGasCommand } from './commands/gas.js'
import { registerTokenCommand } from './commands/token.js'
import { registerTxCommand } from './commands/tx.js'
import { registerBlockCommand } from './commands/block.js'
import { registerStorageCommand } from './commands/storage.js'
import { registerCallCommand } from './commands/call.js'
import { registerProxyCommand } from './commands/proxy.js'
import { registerRunCommand } from './commands/run.js'
import { registerSimCommand } from './commands/sim.js'
import { CHAINS } from './chains.js'
import Table from 'cli-table3'
import chalk from 'chalk'

const program = new Command()

program
  .name('audit')
  .description('CLI for Etherscan API v2 - query any EVM chain')
  .version('0.1.0')

registerConfigCommands(program)
registerBalanceCommand(program)
registerTransactionsCommand(program)
registerTransfersCommand(program)
registerContractCommands(program)
registerGasCommand(program)
registerTokenCommand(program)
registerTxCommand(program)
registerBlockCommand(program)
registerStorageCommand(program)
registerCallCommand(program)
registerProxyCommand(program)
registerRunCommand(program)
registerSimCommand(program)

program
  .command('chains')
  .description('List all supported chains')
  .action(() => {
    const table = new Table({
      head: ['Name', 'Chain ID', 'Symbol', 'Network Name', 'Explorer'].map(h => chalk.cyan(h)),
      style: { head: [], border: [] },
    })
    for (const [key, info] of Object.entries(CHAINS)) {
      table.push([key, String(info.chainId), info.symbol, info.name, info.explorer])
    }
    console.log(`\n  ${chalk.bold('Supported Chains')}\n`)
    console.log(table.toString())
    console.log()
  })

program.parse(process.argv)
