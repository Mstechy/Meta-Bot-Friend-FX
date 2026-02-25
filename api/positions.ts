import type { VercelRequest, VercelResponse } from "@vercel/node";
import MetaApi from "metaapi.cloud-sdk";

const TOKEN = process.env.METAAPI_TOKEN || "";

interface Position {
  id: string;
  symbol: string;
  type: number;
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  stopLoss: number;
  takeProfit: number;
  openTime: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const api = new MetaApi(TOKEN);
    
    const accounts = await (api.metatraderAccountApi as unknown as {
      getAccounts(): Promise<unknown[]>;
    }).getAccounts();

    if (accounts.length === 0) {
      return res.status(200).json([]);
    }

    const account = accounts[0] as {
      waitConnected(): Promise<void>;
      getRPCConnection(): unknown;
    };
    
    await account.waitConnected();
    
    const connection = account.getRPCConnection() as {
      waitSynchronized(): Promise<void>;
      getPositions(): Promise<Position[]>;
    };
    
    await connection.waitSynchronized();

    const positions = await connection.getPositions();

    const formattedPositions = positions.map((pos: Position) => ({
      ticket: pos.id,
      symbol: pos.symbol,
      type: pos.type === 0 ? "BUY" : "SELL",
      volume: pos.volume,
      price: pos.openPrice,
      current_price: pos.currentPrice,
      profit: pos.profit,
      sl: pos.stopLoss,
      tp: pos.takeProfit,
      open_time: pos.openTime,
    }));

    return res.status(200).json(formattedPositions);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("MetaApi positions error:", errorMessage);
    return res.status(500).json({ error: errorMessage });
  }
}
