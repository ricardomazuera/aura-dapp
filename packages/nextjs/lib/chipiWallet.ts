import { ChipiSDK } from "@chipi-pay/chipi-sdk";

// Define the structure for wallet data
interface WalletData {
  publicKey: string;
  encryptedPrivateKey: string;
  address: string;
  userId: string;
}

// Initialize the SDK with configuration
const initChipiSDK = (): ChipiSDK => {
  const AVNU_API_KEY = process.env.NEXT_PUBLIC_AVNU_API_KEY!;
  const INFURA_API_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY!;
  
  if (!AVNU_API_KEY || !INFURA_API_KEY) {
    throw new Error("AVNU_API_KEY or INFURA_API_KEY is not set");
  }
  
  return new ChipiSDK({
    apiKey: AVNU_API_KEY,
    rpcUrl: `https://starknet-mainnet.infura.io/v3/${INFURA_API_KEY}`,
    network: "mainnet",
  });
};

/**
 * Creates a new wallet using Chipi SDK with account abstraction
 * @param userId The user ID from Supabase auth
 * @param email User's email for encryption purposes
 * @returns Wallet information including public key, encrypted private key, and wallet address
 */
export const createWallet = async (userId: string, email: string): Promise<WalletData> => {
  try {
    // Initialize the SDK
    const chipiSDK = initChipiSDK();
    
    // Generate a user-specific encryption key based on their email
    // In production, consider using a more secure approach
    const encryptKey = `${email}-${userId}`.slice(0, 32);
    
    // Create wallet with account abstraction
    const wallet = await chipiSDK.createWallet(encryptKey);
    
    // Get wallet account
    const account = await chipiSDK.getWalletAccount(encryptKey, wallet);
    
    // Return the wallet data including the Starknet address
    return {
      publicKey: wallet.publicKey,
      encryptedPrivateKey: wallet.encryptedPrivateKey,
      address: account.address,
      userId: userId
    };
  } catch (error) {
    console.error("Error creating wallet with Chipi SDK:", error);
    throw new Error(`Failed to create wallet: ${(error as Error).message}`);
  }
};

/**
 * Saves wallet information to Supabase
 * @param walletData Wallet data including keys and address
 * @param supabaseClient Supabase client instance
 */
export const saveWalletToSupabase = async (walletData: WalletData, supabaseClient: any) => {
  try {
    const { error } = await supabaseClient
      .from('user_wallets')
      .insert({
        user_id: walletData.userId,
        public_key: walletData.publicKey,
        encrypted_private_key: walletData.encryptedPrivateKey,
        wallet_address: walletData.address,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error("Error saving wallet to Supabase:", error);
    throw new Error(`Failed to save wallet data: ${(error as Error).message}`);
  }
};