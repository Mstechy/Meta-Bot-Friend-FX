import type { VercelRequest, VercelResponse } from "@vercel/node";
import MetaApi from "metaapi.cloud-sdk";

const TOKEN = process.env.METAAPI_TOKEN || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { accountId, positionId } = req.body;

  if (!accountId || !positionId) {
    return res.status(400).json({ error: "Missing required fields: accountId, positionId" });
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

    // Close position
    const result = await connection.executeTrade({
      actionType: "POSITION_CLOSE",
      positionId: positionId,
    });

    if (result.resultCode === "ACCEPTED" || result.resultCode === "FILLED") {
      return res.status(200).json({
        success: true,
        message: "Position closed successfully",
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.comment || "Close failed",
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("MetaApi close error:", errorMessage);
    return res.status(500).json({ success: false, error: errorMessage });
  }
}
