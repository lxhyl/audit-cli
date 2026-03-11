import { Command } from 'commander'
import { loadConfig, requireChain, requireRpcUrl } from '../config.js'
import { handleError, printJson } from '../formatter.js'
import { checkFoundry, checkAnvil, findFreePort, startAnvil, stopAnvil, runCast, type AnvilInstance } from '../foundry.js'
import chalk from 'chalk'

// Collect repeatable CLI options into an array
function collect(val: string, acc: string[]): string[] {
  return [...acc, val]
}

interface SlotWatch {
  contract: string
  slot: string
}

function parseSlot(raw: string, defaultContract: string): SlotWatch {
  const idx = raw.indexOf(':')
  if (idx === -1) return { contract: defaultContract, slot: raw }
  return { contract: raw.slice(0, idx), slot: raw.slice(idx + 1) }
}

function formatWei(wei: bigint): string {
  const eth = Number(wei) / 1e18
  if (eth === 0) return '0 ETH'
  return `${eth.toFixed(6)} ETH`
}

function formatDiff(before: bigint, after: bigint): string {
  const diff = after - before
  if (diff === 0n) return chalk.gray('  (no change)')
  const sign = diff > 0n ? '+' : ''
  const color = diff > 0n ? chalk.green : chalk.red
  return color(`  ${sign}${formatWei(diff)}`)
}

function getBalance(address: string, rpcUrl: string): bigint {
  const { stdout, ok } = runCast(['balance', address, '--rpc-url', rpcUrl])
  if (!ok) return 0n
  // cast balance returns wei by default
  try { return BigInt(stdout.trim()) } catch { return 0n }
}

function getStorage(contract: string, slot: string, rpcUrl: string): string {
  const { stdout } = runCast(['storage', contract, slot, '--rpc-url', rpcUrl])
  return stdout.trim()
}

function impersonate(address: string, rpcUrl: string): void {
  runCast(['rpc', 'anvil_impersonateAccount', address, '--rpc-url', rpcUrl])
}

function fundAccount(address: string, rpcUrl: string): void {
  // Set balance to 10000 ETH so gas + value is never a blocker
  const tenThousandEth = '0x' + (10000n * 10n ** 18n).toString(16)
  runCast(['rpc', 'anvil_setBalance', address, tenThousandEth, '--rpc-url', rpcUrl])
}

interface SimResult {
  status: 'success' | 'reverted' | 'error'
  txHash?: string
  gasUsed?: string
  blockNumber?: string
  error?: string
  receiptRaw?: string
}

function sendTx(
  from: string,
  to: string,
  sig: string,
  args: string[],
  valueEther: string,
  rpcUrl: string
): SimResult {
  const castArgs = [
    'send', '--unlocked', '--from', from,
    '--rpc-url', rpcUrl,
    '--json',
  ]
  if (parseFloat(valueEther) > 0) {
    castArgs.push('--value', `${valueEther}ether`)
  }
  castArgs.push(to, sig, ...args)

  const { stdout, stderr, ok } = runCast(castArgs, 60000)

  if (!ok) {
    // Check if it's a revert
    const combined = stdout + stderr
    if (combined.includes('reverted') || combined.includes('revert')) {
      const match = combined.match(/reason: (.+)/i) ?? combined.match(/custom error (.+)/i)
      return { status: 'reverted', error: match?.[1]?.trim() ?? 'Transaction reverted', receiptRaw: combined }
    }
    return { status: 'error', error: stderr || 'Unknown error' }
  }

  try {
    const receipt = JSON.parse(stdout) as Record<string, unknown>
    return {
      status: receipt['status'] === '0x1' ? 'success' : 'reverted',
      txHash: receipt['transactionHash'] as string,
      gasUsed: receipt['gasUsed'] as string,
      blockNumber: receipt['blockNumber'] as string,
      receiptRaw: stdout,
    }
  } catch {
    return { status: 'success', receiptRaw: stdout }
  }
}

export function registerSimCommand(program: Command): void {
  program
    .command('sim <address> <sig> [args...]')
    .description('Simulate a write transaction on a forked chain and show state diffs (requires Foundry)')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('--from <address>', 'Sender address to impersonate (default: anvil account 0)', '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')
    .option('--value <ether>', 'ETH value to send with the call (in ether)', '0')
    .option('--block <number>', 'Fork at this specific block number (default: latest)')
    .option('--slot <contract:slot>', 'Watch a storage slot for changes (repeatable, format: 0xAddr:0xSlot)', collect, [] as string[])
    .option('--json', 'Output result as JSON')
    .addHelpText('after', `
Sig format: same as cast — "funcName(type1,type2)" or just "funcName" for no-arg calls.

Examples:
  # Simulate a token transfer
  audit sim 0xA0b8...eB48 "transfer(address,uint256)" 0xRecipient 1000000 --from 0xHolder --chain ethereum

  # Simulate adding liquidity, watch a storage slot
  audit sim 0xPool "deposit(uint256)" 1000000000 --from 0xUser --value 0.1 --slot 0xPool:0x0 --chain arbitrum

  # Fork at a specific block
  audit sim 0xContract "execute()" --from 0xOwner --block 19000000 --chain ethereum`)
    .action(async (
      address: string,
      sig: string,
      args: string[],
      opts: { chain?: string; from: string; value: string; block?: string; slot: string[]; json?: boolean }
    ) => {
      checkFoundry()
      checkAnvil()

      const config = loadConfig()
      const chainName = requireChain(opts, config)
      const rpcUrl = requireRpcUrl(chainName, config)

      const slots: SlotWatch[] = opts.slot.map(s => parseSlot(s, address))

      if (!opts.json) {
        console.log(`\n  ${chalk.bold('Fork Simulation')}`)
        console.log(`  ${chalk.cyan('Chain:')}   ${chainName}`)
        console.log(`  ${chalk.cyan('Fork:')}    ${opts.block ? `block ${opts.block}` : 'latest'}`)
        console.log(`  ${chalk.cyan('From:')}    ${opts.from}`)
        console.log(`  ${chalk.cyan('To:')}      ${address}`)
        console.log(`  ${chalk.cyan('Call:')}    ${sig}${args.length ? '(' + args.join(', ') + ')' : '()'}`)
        if (parseFloat(opts.value) > 0) {
          console.log(`  ${chalk.cyan('Value:')}   ${opts.value} ETH`)
        }
        console.log()
        process.stdout.write(chalk.gray('  Starting anvil fork...\n'))
      }

      let anvil: AnvilInstance | undefined
      try {
        const port = await findFreePort()
        anvil = await startAnvil(rpcUrl, port, opts.block)

        if (!opts.json) {
          process.stdout.write(chalk.gray(`  Anvil ready on port ${port}. Preparing accounts...\n`))
        }

        // Impersonate and fund the sender
        impersonate(opts.from, anvil.rpcUrl)
        fundAccount(opts.from, anvil.rpcUrl)

        // --- Pre-state snapshot ---
        const preSender = getBalance(opts.from, anvil.rpcUrl)
        const preTarget = getBalance(address, anvil.rpcUrl)
        const preSlots = slots.map(s => ({
          ...s,
          value: getStorage(s.contract, s.slot, anvil!.rpcUrl),
        }))

        if (!opts.json) {
          process.stdout.write(chalk.gray('  Sending transaction...\n\n'))
        }

        // --- Execute ---
        const result = sendTx(opts.from, address, sig, args, opts.value, anvil.rpcUrl)

        // --- Post-state snapshot ---
        const postSender = getBalance(opts.from, anvil.rpcUrl)
        const postTarget = getBalance(address, anvil.rpcUrl)
        const postSlots = slots.map(s => ({
          ...s,
          value: getStorage(s.contract, s.slot, anvil!.rpcUrl),
        }))

        stopAnvil(anvil)
        anvil = undefined

        // ---- Output ----
        if (opts.json) {
          printJson({
            status: result.status,
            txHash: result.txHash,
            gasUsed: result.gasUsed ? parseInt(result.gasUsed, 16) : undefined,
            blockNumber: result.blockNumber ? parseInt(result.blockNumber, 16) : undefined,
            error: result.error,
            balanceDiffs: {
              sender: { before: preSender.toString(), after: postSender.toString() },
              target: { before: preTarget.toString(), after: postTarget.toString() },
            },
            storageDiffs: preSlots.map((pre, i) => ({
              contract: pre.contract,
              slot: pre.slot,
              before: pre.value,
              after: postSlots[i]!.value,
            })),
          })
          return
        }

        // Status
        const statusLine = result.status === 'success'
          ? chalk.green('✓ Success')
          : result.status === 'reverted'
            ? chalk.red('✗ Reverted')
            : chalk.red('✗ Error')

        console.log(`  ${chalk.bold('Result:')} ${statusLine}`)
        if (result.error) {
          console.log(`  ${chalk.red('Reason:')} ${result.error}`)
        }
        if (result.gasUsed) {
          console.log(`  ${chalk.cyan('Gas used:')} ${parseInt(result.gasUsed, 16).toLocaleString()}`)
        }
        if (result.txHash) {
          console.log(`  ${chalk.cyan('Tx hash:')} ${result.txHash}`)
        }

        // ETH balance diffs
        console.log(`\n  ${chalk.bold('ETH Balance Changes')}`)
        console.log(`  ${chalk.cyan('Sender')} (${opts.from})`)
        console.log(`    Before: ${formatWei(preSender)}`)
        console.log(`    After:  ${formatWei(postSender)}`)
        console.log(`   ${formatDiff(preSender, postSender)}`)

        if (address.toLowerCase() !== opts.from.toLowerCase()) {
          console.log(`  ${chalk.cyan('Target')} (${address})`)
          console.log(`    Before: ${formatWei(preTarget)}`)
          console.log(`    After:  ${formatWei(postTarget)}`)
          console.log(`   ${formatDiff(preTarget, postTarget)}`)
        }

        // Storage diffs
        if (preSlots.length > 0) {
          console.log(`\n  ${chalk.bold('Storage Changes')}`)
          for (let i = 0; i < preSlots.length; i++) {
            const pre = preSlots[i]!
            const post = postSlots[i]!
            const changed = pre.value !== post.value
            console.log(`  ${chalk.cyan(pre.contract)} slot ${pre.slot}`)
            console.log(`    Before: ${pre.value}`)
            console.log(`    After:  ${post.value}  ${changed ? chalk.yellow('← changed') : chalk.gray('(no change)')}`)
          }
        }

        console.log()
      } catch (err) {
        if (anvil) stopAnvil(anvil)
        handleError(err)
      }
    })
}
