import type { VercelRequest, VercelResponse } from "@vercel/node";
import MetaApi from "metaapi.cloud-sdk";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { accountId } = req.query;
  const TOKEN = process.env.METAAPI_TOKEN || "";

  try {
    const api = new MetaApi(TOKEN);
    const account = await api.metatraderAccountApi.getAccount(accountId as string);
    const connection = account.getRPCConnection();
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
  } catch (error: any) {
    return res.status(200).json({ connected: false, error: error.message });
  }
}
