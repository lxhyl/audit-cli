export interface ChainInfo {
  chainId: number
  name: string
  symbol: string
  explorer: string
}

export const CHAINS: Record<string, ChainInfo> = {
  ethereum:  { chainId: 1,        name: 'Ethereum Mainnet',  symbol: 'ETH',  explorer: 'etherscan.io' },
  sepolia:   { chainId: 11155111, name: 'Sepolia Testnet',   symbol: 'ETH',  explorer: 'sepolia.etherscan.io' },
  holesky:   { chainId: 17000,    name: 'Holesky Testnet',   symbol: 'ETH',  explorer: 'holesky.etherscan.io' },
  polygon:   { chainId: 137,      name: 'Polygon PoS',       symbol: 'POL',  explorer: 'polygonscan.com' },
  amoy:      { chainId: 80002,    name: 'Polygon Amoy',      symbol: 'POL',  explorer: 'amoy.polygonscan.com' },
  bsc:       { chainId: 56,       name: 'BNB Smart Chain',   symbol: 'BNB',  explorer: 'bscscan.com' },
  bsc_test:  { chainId: 97,       name: 'BSC Testnet',       symbol: 'tBNB', explorer: 'testnet.bscscan.com' },
  arbitrum:  { chainId: 42161,    name: 'Arbitrum One',      symbol: 'ETH',  explorer: 'arbiscan.io' },
  arb_nova:  { chainId: 42170,    name: 'Arbitrum Nova',     symbol: 'ETH',  explorer: 'nova.arbiscan.io' },
  arb_sepolia: { chainId: 421614, name: 'Arbitrum Sepolia',  symbol: 'ETH',  explorer: 'sepolia.arbiscan.io' },
  optimism:  { chainId: 10,       name: 'Optimism',          symbol: 'ETH',  explorer: 'optimistic.etherscan.io' },
  op_sepolia: { chainId: 11155420, name: 'Optimism Sepolia', symbol: 'ETH',  explorer: 'sepolia-optimism.etherscan.io' },
  base:      { chainId: 8453,     name: 'Base',              symbol: 'ETH',  explorer: 'basescan.org' },
  base_sepolia: { chainId: 84532, name: 'Base Sepolia',      symbol: 'ETH',  explorer: 'sepolia.basescan.org' },
  avalanche: { chainId: 43114,    name: 'Avalanche C-Chain', symbol: 'AVAX', explorer: 'snowscan.xyz' },
  linea:     { chainId: 59144,    name: 'Linea',             symbol: 'ETH',  explorer: 'lineascan.build' },
  linea_sepolia: { chainId: 59141, name: 'Linea Sepolia',    symbol: 'ETH',  explorer: 'sepolia.lineascan.build' },
  scroll:    { chainId: 534352,   name: 'Scroll',            symbol: 'ETH',  explorer: 'scrollscan.com' },
  scroll_sepolia: { chainId: 534351, name: 'Scroll Sepolia', symbol: 'ETH',  explorer: 'sepolia.scrollscan.com' },
  zksync:    { chainId: 324,      name: 'zkSync Era',        symbol: 'ETH',  explorer: 'era.zksync.network' },
  blast:     { chainId: 81457,    name: 'Blast',             symbol: 'ETH',  explorer: 'blastscan.io' },
  celo:      { chainId: 42220,    name: 'Celo',              symbol: 'CELO', explorer: 'celoscan.io' },
  gnosis:    { chainId: 100,      name: 'Gnosis',            symbol: 'xDAI', explorer: 'gnosisscan.io' },
  moonbeam:  { chainId: 1284,     name: 'Moonbeam',          symbol: 'GLMR', explorer: 'moonscan.io' },
  moonriver: { chainId: 1285,     name: 'Moonriver',         symbol: 'MOVR', explorer: 'moonriver.moonscan.io' },
  fantom:    { chainId: 250,      name: 'Fantom Opera',      symbol: 'FTM',  explorer: 'ftmscan.com' },
  cronos:    { chainId: 25,       name: 'Cronos',            symbol: 'CRO',  explorer: 'cronoscan.com' },
}

export function resolveChain(input: string): number {
  const num = parseInt(input, 10)
  if (!isNaN(num)) return num
  const entry = CHAINS[input.toLowerCase()]
  if (!entry) {
    throw new Error(`Unknown chain: "${input}". Run 'audit chains' to list all supported chains.`)
  }
  return entry.chainId
}

export function getChainSymbol(chainId: number): string {
  const entry = Object.values(CHAINS).find(c => c.chainId === chainId)
  return entry?.symbol ?? 'ETH'
}
