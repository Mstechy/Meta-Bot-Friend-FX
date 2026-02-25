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

  const { accountId } = req.query;

  if (!accountId) {
    return res.status(400).json({ error: "Missing accountId parameter" });
  }

  if (!TOKEN) {
    return res.status(500).json({ error: "METAAPI_TOKEN not configured" });
  }

  try {
    const api = new MetaApi(TOKEN);
    
    // Get account
    const account = await (api.metatraderAccountApi as unknown as {
      getAccount(id: string): Promise<{
        id: string;
        getRPCConnection(): Promise<unknown>;
      }>;
    }).getAccount(accountId as string);

    // Get RPC connection
    const connection = await account.getRPCConnection() as {
      waitSynchronized(timeout?: number): Promise<void>;
      getPositions(): Promise<Position[]>;
    };
    
    await connection.waitSynchronized(30000);

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
