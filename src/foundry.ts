import { execSync, spawnSync, spawn, type ChildProcess } from 'child_process'
import * as net from 'net'

export function checkFoundry(): void {
  try {
    execSync('cast --version', { stdio: 'pipe' })
  } catch {
    console.error('Foundry (cast) is not installed or not in PATH.')
    console.error('Install it at: https://getfoundry.sh')
    process.exit(1)
  }
}

export function checkAnvil(): void {
  try {
    execSync('anvil --version', { stdio: 'pipe' })
  } catch {
    console.error('Anvil is not installed or not in PATH.')
    console.error('Install Foundry at: https://getfoundry.sh')
    process.exit(1)
  }
}

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo
      server.close(() => resolve(addr.port))
    })
    server.on('error', reject)
  })
}

export interface AnvilInstance {
  process: ChildProcess
  port: number
  rpcUrl: string
}

export async function startAnvil(
  forkUrl: string,
  port: number,
  blockNumber?: string
): Promise<AnvilInstance> {
  const args = ['--fork-url', forkUrl, '--port', String(port), '--silent']
  if (blockNumber && blockNumber !== 'latest') {
    args.push('--fork-block-number', blockNumber)
  }

  const proc = spawn('anvil', args, {
    stdio: ['ignore', 'ignore', 'ignore'],
    detached: false,
  })

  const rpcUrl = `http://127.0.0.1:${port}`

  await new Promise<void>((resolve, reject) => {
    let ready = false
    const startTime = Date.now()
    const interval = setInterval(() => {
      try {
        execSync(`cast block-number --rpc-url ${rpcUrl}`, { stdio: 'pipe', timeout: 2000 })
        clearInterval(interval)
        ready = true
        resolve()
      } catch {
        if (Date.now() - startTime > 20000) {
          clearInterval(interval)
          proc.kill()
          reject(new Error('Anvil did not become ready within 20 seconds'))
        }
      }
    }, 500)

    proc.on('error', (err) => {
      if (!ready) {
        clearInterval(interval)
        reject(new Error(`Failed to start anvil: ${err.message}`))
      }
    })
  })

  return { process: proc, port, rpcUrl }
}

export function stopAnvil(instance: AnvilInstance): void {
  try {
    instance.process.kill('SIGTERM')
  } catch { /* ignore */ }
}

export function runCast(
  args: string[],
  timeoutMs = 60000
): { stdout: string; stderr: string; ok: boolean } {
  const result = spawnSync('cast', args, {
    encoding: 'utf-8',
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  })
  return {
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
    ok: (result.status ?? 1) === 0,
  }
}
