interface WalletData {
  publicKey: string;
  encryptedPrivateKey: string;
}

interface TransferParams {
  encryptKey: string;
  wallet: WalletData;
  contractAddress: string;
  recipient: string;
  amount: string | number;
  decimals?: number;
}