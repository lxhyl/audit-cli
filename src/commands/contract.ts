import { Command } from 'commander'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { loadConfig, requireApiKey, requireChain } from '../config.js'
import { EtherscanClient } from '../client.js'
import { resolveChain } from '../chains.js'
import { formatContractSource, handleError, printJson, printSuccess, type OutputFormat } from '../formatter.js'
import type { ContractSourceCode } from '../types.js'

interface MultiFileSource {
  sources: Record<string, { content: string }>
}

function parseSourceFiles(raw: string): Record<string, string> {
  // Hardhat/Foundry multi-file: starts with {{ (double brace)
  if (raw.startsWith('{{')) {
    const inner = raw.slice(1, -1)
    const parsed = JSON.parse(inner) as MultiFileSource
    return Object.fromEntries(
      Object.entries(parsed.sources).map(([path, { content }]) => [path, content])
    )
  }
  // Standard JSON input format: starts with {
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as MultiFileSource
      if (parsed.sources) {
        return Object.fromEntries(
          Object.entries(parsed.sources).map(([path, { content }]) => [path, content])
        )
      }
    } catch { /* fall through */ }
  }
  // Single file
  return { 'Contract.sol': raw }
}

export function registerContractCommands(program: Command): void {
  const contract = program
    .command('contract')
    .description('Query contract information')

  contract
    .command('abi <address>')
    .description('Get contract ABI')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('--json', 'Output raw JSON')
    .action(async (address: string, opts: { chain?: string; json?: boolean }) => {
      const config = loadConfig()
      const apiKey = requireApiKey(config)
      const chainName = requireChain(opts, config)
      const chainId = resolveChain(chainName)

      const client = new EtherscanClient(apiKey, chainId)
      try {
        const abi = await client.call<string>('contract', 'getabi', { address })
        if (opts.json) {
          // Parse and re-format the ABI JSON for pretty output
          printJson(JSON.parse(abi))
        } else {
          const parsed = JSON.parse(abi) as unknown[]
          console.log(`\n  ABI for ${address} (${parsed.length} entries)\n`)
          for (const item of parsed as Record<string, unknown>[]) {
            const type = String(item['type'] ?? '')
            const name = String(item['name'] ?? '')
            if (type === 'function') {
              const inputs = (item['inputs'] as { type: string; name: string }[] ?? [])
                .map(i => `${i.type} ${i.name}`.trim())
                .join(', ')
              const outputs = (item['outputs'] as { type: string }[] ?? [])
                .map(o => o.type)
                .join(', ')
              const stateMutability = String(item['stateMutability'] ?? '')
              console.log(`  fn ${name}(${inputs}) → (${outputs}) [${stateMutability}]`)
            } else if (type === 'event') {
              const inputs = (item['inputs'] as { type: string; name: string }[] ?? [])
                .map(i => `${i.type} ${i.name}`.trim())
                .join(', ')
              console.log(`  event ${name}(${inputs})`)
            } else {
              console.log(`  ${type}${name ? ' ' + name : ''}`)
            }
          }
          console.log()
        }
      } catch (err) {
        handleError(err)
      }
    })

  contract
    .command('source <address>')
    .description('Get verified contract source code')
    .option('-c, --chain <chain>', 'Chain name or chainId')
    .option('--print', 'Print full source code to stdout')
    .option('--save <dir>', 'Save source files to directory')
    .option('--json', 'Output raw JSON (metadata + source)')
    .action(async (address: string, opts: { chain?: string; print?: boolean; save?: string; json?: boolean }) => {
      const config = loadConfig()
      const apiKey = requireApiKey(config)
      const chainName = requireChain(opts, config)
      const chainId = resolveChain(chainName)
      const format: OutputFormat = opts.json ? 'json' : (config.defaultOutput ?? 'table')

      const client = new EtherscanClient(apiKey, chainId)
      try {
        const sources = await client.call<ContractSourceCode[]>('contract', 'getsourcecode', { address })

        if (opts.json) {
          printJson(sources)
          return
        }

        // Always show metadata summary
        formatContractSource(sources, address, format)

        if (!sources.length || !sources[0]?.ContractName) return

        const s = sources[0]!
        const files = parseSourceFiles(s.SourceCode)

        if (opts.save) {
          const outDir = opts.save
          if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
          for (const [filePath, content] of Object.entries(files)) {
            const outPath = join(outDir, filePath.replace(/^.*\//, ''))
            writeFileSync(outPath, content)
          }
          printSuccess(`Saved ${Object.keys(files).length} file(s) to ${outDir}/`)
          for (const filePath of Object.keys(files)) {
            console.log(`    ${filePath}`)
          }
        } else if (opts.print) {
          for (const [filePath, content] of Object.entries(files)) {
            console.log(`\n${'─'.repeat(60)}`)
            console.log(`// ${filePath}`)
            console.log('─'.repeat(60))
            console.log(content)
          }
        } else if (Object.keys(files).length > 1) {
          console.log(`\n  Files (${Object.keys(files).length}): use --print or --save <dir> to get source`)
          for (const f of Object.keys(files)) console.log(`    ${f}`)
          console.log()
        }
      } catch (err) {
        handleError(err)
      }
    })
}
