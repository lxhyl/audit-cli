export type JsonRpcResponse<T> =
  | { jsonrpc: string; id: number; result: T; error?: never; status?: never }
  | { jsonrpc: string; id: number; result?: never; error: { code: number; message: string }; status?: never }
  | { status: '0'; message: string; result: T; jsonrpc?: never }

export interface EtherscanEnvelope<T> {
  status: '0' | '1'
  message: string
  result: T
}

export interface Transaction {
  hash: string
  blockNumber: string
  timeStamp: string
  from: string
  to: string
  value: string
  gas: string
  gasUsed: string
  gasPrice: string
  isError: string
  txreceipt_status: string
  input: string
  nonce: string
  contractAddress: string
  confirmations: string
  methodId: string
  functionName: string
}

export interface TokenTransfer {
  hash: string
  blockNumber: string
  timeStamp: string
  from: string
  to: string
  value: string
  tokenName: string
  tokenSymbol: string
  tokenDecimal: string
  contractAddress: string
  gas: string
  gasUsed: string
  tokenID?: string
}

export interface GasOracle {
  LastBlock: string
  SafeGasPrice: string
  ProposeGasPrice: string
  FastGasPrice: string
  suggestBaseFee: string
  gasUsedRatio: string
}

export interface ContractSourceCode {
  SourceCode: string
  ABI: string
  ContractName: string
  CompilerVersion: string
  OptimizationUsed: string
  Runs: string
  ConstructorArguments: string
  EVMVersion: string
  Library: string
  LicenseType: string
  Proxy: string
  Implementation: string
  SwaggerURL: string
}

export interface TokenInfo {
  contractAddress: string
  tokenName: string
  symbol: string
  divisor: string
  tokenType: string
  totalSupply: string
  blueCheckmark: string
  description: string
  website: string
  twitter: string
  github: string
  officialSite: string
  facebook: string
  telegram: string
  reddit: string
  slack: string
  discord: string
  whitepaper: string
  tokenPriceUSD: string
}

export interface BlockReward {
  blockNumber: string
  timeStamp: string
  blockMiner: string
  blockReward: string
  uncles: { miner: string; unclePosition: string; blockreward: string }[]
  uncleInclusionReward: string
}

export interface TransactionStatus {
  isError: string
  errDescription: string
}

export interface TransactionReceiptStatus {
  status: string
}
