import type { VercelRequest, VercelResponse } from "@vercel/node";
import MetaApi from "metaapi.cloud-sdk";

const TOKEN = process.env.METAAPI_TOKEN || "";

interface SymbolInfo {
  digits: number;
  point: number;
  ask?: number;
  bid?: number;
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

  const { symbol, type, volume, sl_pips, tp_pips } = req.body;

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
      getSymbolSpecification(symbol: string): Promise<SymbolInfo>;
      trade(order: Record<string, unknown>): Promise<TradeResult>;
    };
    
    await connection.waitSynchronized();

    // Get symbol info for pip calculation
    const symbolInfo = await connection.getSymbolSpecification(symbol);
    const digits = symbolInfo.digits;
    const point = symbolInfo.point;
    const pipMultiplier = digits === 3 || digits === 5 ? 10 : 1;
    const pipSize = point * pipMultiplier;

    // Calculate SL and TP prices
    const sl = sl_pips ? (type === "BUY" 
      ? (symbolInfo.ask || 0) - (sl_pips * pipSize)
      : (symbolInfo.bid || 0) + (sl_pips * pipSize)) : undefined;

    const tp = tp_pips ? (type === "BUY"
      ? (symbolInfo.ask || 0) + (tp_pips * pipSize)
      : (symbolInfo.bid || 0) - (tp_pips * pipSize)) : undefined;

    // Open the trade
    const result = await connection.trade({
      symbol,
      type: type === "BUY" ? 0 : 1,
      volume: volume || 0.01,
      sl: sl,
      tp: tp,
    });

    if (result.returnCode !== "ERR_NO_ERROR") {
      return res.status(400).json({ 
        success: false, 
        error: result.comment || "Trade failed" 
      });
    }

    return res.status(200).json({
      success: true,
      trade: {
        ticket: result.orderId,
        symbol,
        type,
        volume: volume || 0.01,
        price: type === "BUY" ? symbolInfo.ask : symbolInfo.bid,
        sl,
        tp,
        open_time: new Date().toISOString(),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("MetaApi order error:", errorMessage);
    return res.status(500).json({ success: false, error: errorMessage });
  }
}
