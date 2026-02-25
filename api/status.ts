import type { VercelRequest, VercelResponse } from "@vercel/node";
import MetaApi from "metaapi.cloud-sdk";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { accountId } = req.query;

  if (!accountId) {
    return res.status(400).json({ error: "Missing accountId parameter" });
  }

  const TOKEN = process.env.METAAPI_TOKEN || "";

  if (!TOKEN) {
    return res.status(500).json({ error: "METAAPI_TOKEN not configured" });
  }

  try {
    const api = new MetaApi(TOKEN);
    
    // Get account
    const account = await (api.metatraderAccountApi as unknown as {
      getAccount(id: string): Promise<{
        id: string;
        state: string;
        getRPCConnection(): Promise<unknown>;
      }>;
    }).getAccount(accountId as string);
    
    // Get RPC connection
    const connection = await account.getRPCConnection() as {
      connect(): Promise<void>;
      getAccountInformation(): Promise<{
        balance?: number;
        equity?: number;
        profit?: number;
        margin?: number;
        freeMargin?: number;
        marginLevel?: number;
      }>;
    };
    
    await connection.connect();

    const info = await connection.getAccountInformation();

    return res.status(200).json({
      connected: true,
      account: {
        balance: Number(info.balance) || 0,
        equity: Number(info.equity) || 0,
        profit: Number(info.profit) || 0,
        margin: Number(info.margin) || 0,
        free_margin: Number(info.freeMargin) || 0,
        margin_level: Number(info.marginLevel) || 0,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("MetaApi status error:", errorMessage);
    return res.status(200).json({ connected: false, error: errorMessage });
  }
}
