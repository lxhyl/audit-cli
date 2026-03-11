import { Command } from 'commander'
import {
  encodeFunctionData,
  decodeFunctionResult,
  type Abi,
  type AbiFunction,
} from 'viem'
import { loadConfig, requireApiKey, requireChain } from '../config.js'
import { EtherscanClient } from '../client.js'
import { resolveChain } from '../chains.js'
import { handleError, printJson } from '../formatter.js'
import chalk from 'chalk'

// Coerce a string CLI argument to the right JS type for viem
function coerceArg(value: string, abiType: string): unknown {
  const t = abiType.replace(/\s/g, '')

  // Arrays: "[a,b,c]" or "a,b,c"
  if (t.endsWith(']')) {
    const innerType = t.slice(0, t.lastIndexOf('['))
    let arr: string[]
    try {
      const parsed = JSON.parse(value) as unknown
      arr = Array.isArray(parsed) ? (parsed as string[]).map(String) : [value]
    } catch {
      arr = value.split(',').map(s => s.trim())
    }
    return arr.map(v => coerceArg(v, innerType))
  }

  // Tuples: "(a,b)" → parse as JSON array
  if (t.startsWith('(')) {
    const vals = JSON.parse(value) as unknown[]
    return vals
  }

  if (t === 'bool') return value === 'true' || value === '1'
  if (t.startsWith('uint') || t.startsWith('int')) return BigInt(value)
  if (t.startsWith('bytes') && t !== 'bytes') return value as `0x${string}`
  if (t === 'bytes') return value as `0x${string}`
  if (t === 'address') return value as `0x${string}`

  return value
}

function formatReturnValue(value: unknown, depth = 0): string {
  const indent = '  '.repeat(depth)
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map(v => `${indent}  ${formatReturnValue(v, depth + 1)}`).join(',\n')
    return `[\n${items}\n${indent}]`
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([k]) => isNaN(Number(k))) // Skip numeric indices (tuple duplicates)
      .map(([k, v]) => `${indent}  ${chalk.cyan(k)}: ${formatReturnValue(v, depth + 1)}`)
      .join('\n')
    return `{\n${entries}\n${indent}}`
  }
  return String(value)
}

export function registerCallCommand(program: Command): void {
  program
    .command('call <address> <function> [args...]')
    .description('Call a view/pure function on a contract (static call via eth_call)')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('--abi <address>', 'Fetch ABI from this address instead (useful for proxy contracts)')
    .option('--from <address>', 'Sender address for the call', '0x0000000000000000000000000000000000000000')
    .option('--block <block>', 'Block number or "latest"', 'latest')
    .option('--json', 'Output raw JSON')
    .addHelpText('after', `
Examples:
  audit call 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 name
  audit call 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 balanceOf 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
  audit call 0x... decimals --chain polygon
  audit call 0x... getAmountsOut 1000000 "[0xWETH,0xUSDC]"`)
    .action(async (
      address: string,
      functionName: string,
      args: string[],
      opts: { chain?: string; abi?: string; from: string; block: string; json?: boolean }
    ) => {
      const config = loadConfig()
      const apiKey = requireApiKey(config)
      const chainName = requireChain(opts, config)
      const chainId = resolveChain(chainName)

      const client = new EtherscanClient(apiKey, chainId)

      try {
        // 1. Fetch contract ABI (from --abi address if provided, else from target address)
        const abiSource = opts.abi ?? address
        process.stderr.write(chalk.gray('  Fetching ABI...\n'))
        const abiRaw = await client.call<string>('contract', 'getabi', { address: abiSource })
        const abi = JSON.parse(abiRaw) as Abi

        // 2. Find matching function (by name + arg count)
        const candidates = abi.filter(
          (item): item is AbiFunction =>
            item.type === 'function' && item.name === functionName
        )

        if (candidates.length === 0) {
          const available = abi
            .filter((item): item is AbiFunction => item.type === 'function')
            .map(f => `${f.name}(${f.inputs.map(i => i.type).join(',')})`)
            .join('\n    ')
          console.error(chalk.red(`Function "${functionName}" not found in ABI.`))
          console.error(chalk.gray(`  Available functions:\n    ${available}`))
          process.exit(1)
        }

        // Pick best match by arg count, fallback to first
        const fn = candidates.find(f => f.inputs.length === args.length) ?? candidates[0]!

        if (args.length !== fn.inputs.length) {
          console.error(chalk.red(
            `Argument count mismatch: expected ${fn.inputs.length} (${fn.inputs.map(i => i.type).join(', ')}), got ${args.length}`
          ))
          process.exit(1)
        }

        // 3. Coerce args to proper types
        const coercedArgs = fn.inputs.map((input, i) => coerceArg(args[i]!, input.type))

        // 4. Encode call data (use full ABI to avoid strict tuple typing)
        const data = encodeFunctionData({
          abi,
          functionName: fn.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          args: coercedArgs as any,
        })

        // 5. eth_call via proxy
        process.stderr.write(chalk.gray('  Calling...\n'))
        const result = await client.proxy<string>('eth_call', {
          to: address,
          data,
          from: opts.from,
          tag: opts.block,
        })

        // 6. Decode result
        const decoded = decodeFunctionResult({
          abi,
          functionName: fn.name,
          data: result as `0x${string}`,
        })

        if (opts.json) {
          const serialize = (v: unknown): unknown => {
            if (typeof v === 'bigint') return v.toString()
            if (Array.isArray(v)) return v.map(serialize)
            if (typeof v === 'object' && v !== null)
              return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, serialize(val)]))
            return v
          }
          printJson({
            address,
            function: `${fn.name}(${fn.inputs.map(i => `${i.type} ${i.name}`).join(', ')})`,
            args: coercedArgs.map(String),
            result: serialize(decoded),
          })
          return
        }

        // Pretty print
        const sig = `${fn.name}(${fn.inputs.map(i => `${i.type} ${i.name}`).join(', ')})`
        const returns = fn.outputs.map(o => `${o.type}${o.name ? ' ' + o.name : ''}`).join(', ')
        console.log(`\n  ${chalk.bold('Static Call Result')}`)
        console.log(`  ${chalk.cyan('Contract:')}  ${address}`)
        console.log(`  ${chalk.cyan('Function:')}  ${sig}`)
        console.log(`  ${chalk.cyan('Returns:')}   ${returns}`)
        console.log(`  ${chalk.cyan('Block:')}     ${opts.block}\n`)

        // Handle single vs multi return values
        if (fn.outputs.length === 1) {
          console.log(`  ${chalk.green('→')} ${formatReturnValue(decoded)}`)
        } else if (Array.isArray(decoded)) {
          for (let i = 0; i < fn.outputs.length; i++) {
            const out = fn.outputs[i]!
            console.log(`  ${chalk.green(`[${i}]`)} ${chalk.cyan(out.name || out.type)}: ${formatReturnValue((decoded as unknown[])[i])}`)
          }
        } else {
          console.log(`  ${chalk.green('→')} ${formatReturnValue(decoded)}`)
        }
        console.log()
      } catch (err) {
        handleError(err)
      }
    })
}
