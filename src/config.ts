import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export interface Config {
  apiKey?: string
  defaultChain?: string
  defaultOutput?: 'table' | 'json'
}

const CONFIG_DIR = join(homedir(), '.audit-cli')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

export function loadConfig(): Config {
  if (!existsSync(CONFIG_FILE)) return {}
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as Config
  } catch {
    return {}
  }
}

export function saveConfig(config: Config): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

export function requireChain(opts: { chain?: string }, config: Config): string {
  const chainName = opts.chain ?? config.defaultChain
  if (!chainName) {
    console.error('Chain is required. Use -c <chain> or set a default with: audit config set-chain <chain>')
    console.error('Run "audit chains" to see all supported chains.')
    process.exit(1)
  }
  return chainName
}

export function requireApiKey(config: Config): string {
  const key = process.env['ETHERSCAN_API_KEY'] ?? config.apiKey
  if (!key) {
    console.error('No API key found. Set it with: audit config set-key <apiKey>')
    console.error('Or set the ETHERSCAN_API_KEY environment variable.')
    process.exit(1)
  }
  return key
}

export function getConfigPath(): string {
  return CONFIG_FILE
}
