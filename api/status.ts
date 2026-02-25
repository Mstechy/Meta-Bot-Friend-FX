import type { VercelRequest, VercelResponse } from "@vercel/node";
import MetaApi from "metaapi.cloud-sdk";

const TOKEN = process.env.METAAPI_TOKEN || "";
let cachedAccount: any = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const api = new MetaApi(TOKEN);
    const accounts = await api.metatraderAccountApi.getAccounts();

    if (accounts.length === 0) {
      return res.status(200).json({
        connected: false,
        account_type: "demo",
        running: false,
        account: null,
        positions: 0,
      });
    }

    // Get the first account
    const account = accounts[0];
    cachedAccount = account;

    await account.waitConnected();
    const connection = account.getRPCConnection();
    await connection.waitSynchronized();

    const info = await connection.getAccountInformation();
    const positions = await connection.getPositions();

    return res.status(200).json({
      connected: true,
      account_type: account.server?.includes("demo") ? "demo" : "real",
      running: true,
      account: {
        balance: info.balance,
        equity: info.equity,
        margin: info.margin,
        free_margin: info.freeMargin,
        margin_level: info.marginLevel,
        profit: info.profit,
        login: account.login,
      },
      positions: positions.length,
      server: account.server,
    });
  } catch (error: any) {
    console.error("MetaApi status error:", error);
    return res.status(200).json({
      connected: false,
      account_type: "demo",
      running: false,
      account: cachedAccount ? {
        balance: 0,
        equity: 0,
        margin: 0,
        free_margin: 0,
        margin_level: 0,
        profit: 0,
        login: cachedAccount.login,
      } : null,
      positions: 0,
      error: error.message,
    });
  }
}
