import type { VercelRequest, VercelResponse } from "@vercel/node";
import MetaApi from "metaapi.cloud-sdk";

const TOKEN = process.env.METAAPI_TOKEN || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { accountId, symbol, volume, type, price, sl, tp } = req.body;

  if (!accountId || !symbol || !volume || !type) {
    return res.status(400).json({ error: "Missing required fields: accountId, symbol, volume, type" });
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
    }).getAccount(accountId);

    // Get RPC connection
    const connection = await account.getRPCConnection() as {
      waitSynchronized(timeout?: number): Promise<void>;
      executeTrade(trade: Record<string, unknown>): Promise<{
        orderId?: string;
        resultCode?: string;
        comment?: string;
      }>;
    };
    
    await connection.waitSynchronized(30000);

    // Prepare trade request
    const tradeRequest: Record<string, unknown> = {
      actionType: type.toUpperCase(),
      symbol: symbol,
      volume: parseFloat(volume),
    };

    // Add price if specified (for pending orders)
    if (price) {
      tradeRequest.price = parseFloat(price);
    }

    // Add SL/TP if specified
    if (sl) {
      tradeRequest.stopLoss = parseFloat(sl);
    }
    if (tp) {
      tradeRequest.takeProfit = parseFloat(tp);
    }

    const result = await connection.executeTrade(tradeRequest);

    if (result.resultCode === "ACCEPTED" || result.resultCode === "FILLED") {
      return res.status(200).json({
        success: true,
        orderId: result.orderId,
        message: "Order executed successfully",
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.comment || "Order failed",
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("MetaApi order error:", errorMessage);
    return res.status(500).json({ success: false, error: errorMessage });
  }
}
