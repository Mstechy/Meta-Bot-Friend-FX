import type { VercelRequest, VercelResponse } from "@vercel/node";
import MetaApi from "metaapi.cloud-sdk";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { login, password, server, account_type } = req.body;
  const TOKEN = process.env.METAAPI_TOKEN || "";

  try {
    const api = new MetaApi(TOKEN);

    // Check if account already exists
    const accounts = await api.metatraderAccountApi.getAccounts();
    let account = accounts.find(
      (a: any) => a.login === String(login) && a.server === server
    );

    // Create account if it doesn't exist
    if (!account) {
      account = await api.metatraderAccountApi.createAccount({
        name: `MT5-${login}`,
        type: "cloud",
        login: String(login),
        password: password,
        server: server,
        platform: "mt5",
        magic: 123456,
      });
    }

    // Deploy and connect
    await account.deploy();
    await account.waitConnected();

    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();

    const info = await connection.getAccountInformation();

    return res.status(200).json({
      success: true,
      accountId: account.id,
      account: {
        balance: info.balance,
        equity: info.equity,
        margin: info.margin,
        free_margin: info.freeMargin,
        margin_level: info.marginLevel,
        profit: info.profit,
        login: login,
      },
      account_type,
      server,
    });
  } catch (error: any) {
    console.error("MetaApi connect error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
