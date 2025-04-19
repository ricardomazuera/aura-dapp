"use client";

// Initialize SDK
import { ChipiProvider } from "@chipi-pay/chipi-sdk";

const AVNU_API_KEY = process.env.NEXT_PUBLIC_AVNU_API_KEY!;
const INFURA_API_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY!;

if (!AVNU_API_KEY || !INFURA_API_KEY) {
  throw new Error("AVNU_API_KEY or INFURA_API_KEY is not set");
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChipiProvider
      config={{
        apiKey: AVNU_API_KEY,
        rpcUrl:
          `https://starknet-mainnet.infura.io/v3/${INFURA_API_KEY}`,
        network: "mainnet",
      }}
    >
      {children}
    </ChipiProvider>
  );
}