import type { VercelRequest, VercelResponse } from "@vercel/node";
import MetaApi from "metaapi.cloud-sdk";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { accountId } = req.query;
  const TOKEN = process.env.METAAPI_TOKEN || "";

  try {
    const api = new MetaApi(TOKEN);
    
    const account = await (api.metatraderAccountApi as unknown as {
      getAccount(id: string): Promise<unknown>;
    }).getAccount(accountId as string);
    
    const accountObj = account as {
      getRPCConnection(): unknown;
    };
    
    const connection = accountObj.getRPCConnection() as {
      connect(): Promise<void>;
      getAccountInformation(): Promise<Record<string, unknown>>;
    };
    
    await connection.connect();

    const info = await connection.getAccountInformation();

    return res.status(200).json({
      connected: true,
      account: {
        balance: info.balance,
        equity: info.equity,
        profit: info.profit,
        margin: info.margin,
        free_margin: info.freeMargin,
        margin_level: info.marginLevel,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return res.status(200).json({ connected: false, error: errorMessage });
  }
}
