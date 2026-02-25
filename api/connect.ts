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

    // Get all accounts using the accounts() method
    const accounts = await (api.metatraderAccountApi as unknown as { 
      getAccounts(): Promise<unknown[]> 
    }).getAccounts();
    
    let account = accounts.find(
      (a: unknown) => (a as { login: unknown; server: unknown }).login === String(login) && 
                       (a as { server: unknown }).server === server
    );

    // Create account if it doesn't exist
    if (!account) {
      account = await (api.metatraderAccountApi as unknown as { 
        createAccount(config: unknown): Promise<unknown> 
      }).createAccount({
        name: `MT5-${login}`,
        type: "cloud",
        login: String(login),
        password: password,
        server: server,
        platform: "mt5",
        magic: 123456,
      });
    }

    const accountObj = account as { 
      id: string; 
      deploy(): Promise<void>; 
      waitConnected(): Promise<void>; 
      getRPCConnection(): unknown 
    };

    // Deploy and connect
    await accountObj.deploy();
    await accountObj.waitConnected();

    const connection = accountObj.getRPCConnection() as {
      connect(): Promise<void>;
      waitSynchronized(): Promise<void>;
      getAccountInformation(): Promise<Record<string, unknown>>;
    };
    
    await connection.connect();
    await connection.waitSynchronized();

    const info = await connection.getAccountInformation();

    return res.status(200).json({
      success: true,
      accountId: accountObj.id,
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("MetaApi connect error:", errorMessage);
    return res.status(500).json({ success: false, error: errorMessage });
  }
}
