import type { VercelRequest, VercelResponse } from "@vercel/node";
import MetaApi from "metaapi.cloud-sdk";

const TOKEN = process.env.METAAPI_TOKEN || "";

interface Position {
  id: string;
  symbol: string;
  type: number;
  volume: number;
  profit: number;
}

interface TradeResult {
  returnCode: string;
  comment?: string;
  orderId?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ticket } = req.body;

  if (!ticket) {
    return res.status(400).json({ success: false, error: "Ticket is required" });
  }

  try {
    const api = new MetaApi(TOKEN);
    
    const accounts = await (api.metatraderAccountApi as unknown as {
      getAccounts(): Promise<unknown[]>;
    }).getAccounts();

    if (accounts.length === 0) {
      return res.status(400).json({ success: false, error: "No account connected" });
    }

    const account = accounts[0] as {
      waitConnected(): Promise<void>;
      getRPCConnection(): unknown;
    };
    
    await account.waitConnected();
    
    const connection = account.getRPCConnection() as {
      waitSynchronized(): Promise<void>;
      getPositions(): Promise<Position[]>;
      trade(order: Record<string, unknown>): Promise<TradeResult>;
    };
    
    await connection.waitSynchronized();

    // Get positions to find the one to close
    const positions = await connection.getPositions();
    const position = positions.find((pos: Position) => 
      pos.id === ticket || pos.id === String(ticket)
    );

    if (!position) {
      return res.status(404).json({ success: false, error: "Position not found" });
    }

    // Close the position
    const result = await connection.trade({
      symbol: position.symbol,
      type: position.type === 0 ? 1 : 0, // Reverse the position type
      volume: position.volume,
      deviation: 20,
    });

    if (result.returnCode !== "ERR_NO_ERROR") {
      return res.status(400).json({ 
        success: false, 
        error: result.comment || "Close failed" 
      });
    }

    return res.status(200).json({
      success: true,
      profit: position.profit,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("MetaApi close error:", errorMessage);
    return res.status(500).json({ success: false, error: errorMessage });
  }
}
