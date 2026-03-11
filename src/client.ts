import axios from 'axios'
import type { EtherscanEnvelope, JsonRpcResponse } from './types.js'

const BASE_URL = 'https://api.etherscan.io/v2/api'

// Global rate limiter: stay safely under 3 req/sec free tier limit
const INTERVAL_MS = 400  // 2.5 req/sec
let lastCallAt = 0

async function throttle(): Promise<void> {
  const wait = INTERVAL_MS - (Date.now() - lastCallAt)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastCallAt = Date.now()
}

const RATE_LIMIT_PHRASES = [
  'Max calls per sec rate limit',
  'rate limit',
  'Too Many Requests',
]

function isRateLimit(msg: string): boolean {
  return RATE_LIMIT_PHRASES.some(p => msg.toLowerCase().includes(p.toLowerCase()))
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [1000, 2000, 4000]
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await fn()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (isRateLimit(msg) && i < delays.length) {
        await new Promise(r => setTimeout(r, delays[i]))
        lastCallAt = 0  // reset throttle so next call goes immediately after the wait
        continue
      }
      throw err
    }
  }
  throw new Error('Unreachable')
}

// Errors that indicate "no results" rather than a real error
const EMPTY_RESULT_MESSAGES = [
  'No transactions found',
  'No records found',
  'No token transfers found',
  'Query Timeout occured. Please select a smaller result dataset',
]

export class EtherscanClient {
  constructor(
    private readonly apiKey: string,
    private readonly chainId: number
  ) {}

  async call<T>(
    module: string,
    action: string,
    params: Record<string, string | number> = {}
  ): Promise<T> {
    return withRetry(async () => {
      await throttle()
      const response = await axios.get<EtherscanEnvelope<T>>(BASE_URL, {
        params: {
          chainid: this.chainId,
          module,
          action,
          apikey: this.apiKey,
          ...params,
        },
        timeout: 30000,
      })

      const { status, message, result } = response.data

      if (status === '0') {
        if (
          EMPTY_RESULT_MESSAGES.some(m => message.includes(m)) ||
          (Array.isArray(result) && result.length === 0)
        ) {
          return (Array.isArray(result) ? [] : result) as T
        }
        throw new Error(typeof result === 'string' ? result : message)
      }

      return result
    })
  }

  // Etherscan proxy module wraps JSON-RPC calls (eth_call, eth_getStorageAt, etc.)
  async proxy<T>(action: string, params: Record<string, string> = {}): Promise<T> {
    return withRetry(async () => {
      await throttle()
      const response = await axios.get<JsonRpcResponse<T>>(BASE_URL, {
        params: {
          chainid: this.chainId,
          module: 'proxy',
          action,
          apikey: this.apiKey,
          ...params,
        },
        timeout: 30000,
      })
      const data = response.data
      if ('error' in data && data.error) {
        throw new Error(data.error.message ?? 'RPC error')
      }
      if ('status' in data && data.status === '0') {
        throw new Error(String(data.result) ?? 'Proxy error')
      }
      return data.result as T
    })
  }
}
