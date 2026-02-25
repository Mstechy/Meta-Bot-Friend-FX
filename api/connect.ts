import type { VercelRequest, VercelResponse } from "@vercel/node";
import MetaApi from "metaapi.cloud-sdk";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { login, password, server, account_type } = req.body;
  
  if (!login || !password || !server) {
    return res.status(400).json({ success: false, error: "Missing required fields: login, password, server" });
  }

  const TOKEN = process.env.METAAPI_TOKEN || "";

  if (!TOKEN) {
    return res.status(500).json({ success: false, error: "METAAPI_TOKEN not configured" });
  }

  try {
    const api = new MetaApi(TOKEN);

    // Get all accounts - using proper typing
    const accounts = await (api.metatraderAccountApi as unknown as {
      getAccounts(): Promise<Array<{id: string; login: number | string; server: string; state: string; getRPCConnection(): Promise<unknown>}>>
    }).getAccounts();
    
    // Find existing account by login and server
    const existingAccount = accounts.find(
      (a) => String(a.login) === String(login) && a.server === server
    );

    let accountId: string;

    if (!existingAccount) {
      // Create new cloud account
      console.log(`Creating new MetaApi account for ${login}@${server}`);
      const newAccount = await (api.metatraderAccountApi as unknown as {
        createAccount(config: Record<string, unknown>): Promise<{id: string; deploy(): Promise<void>; waitConnected(timeout?: number): Promise<void>; getRPCConnection(): Promise<unknown>}>
      }).createAccount({
        name: `MT5-${login}-${server}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: "cloud" as any,
        login: String(login),
        password: password,
        server: server,
        platform: "mt5",
        magic: 123456,
      });
      
      accountId = newAccount.id;
      console.log(`Created new account: ${accountId}`);
    } else {
      accountId = existingAccount.id;
      console.log(`Found existing account: ${accountId}`);
    }

    // Get the account and deploy if needed
    const account = await (api.metatraderAccountApi as unknown as {
      getAccount(id: string): Promise<{id: string; state: string; deploy(): Promise<void>; waitConnected(timeout?: number): Promise<void>; getRPCConnection(): Promise<unknown>}>
    }).getAccount(accountId);

    // Deploy if not deployed
    if (account.state !== "DEPLOYED") {
      await account.deploy();
    }

    // Wait for connection
    await account.waitConnected(30000);

    // Get RPC connection - it's a Promise
    const connectionPromise = await account.getRPCConnection();
    const connection = connectionPromise as {
      connect(): Promise<void>;
      waitSynchronized(timeout?: number): Promise<void>;
      getAccountInformation(): Promise<{
        balance?: number;
        equity?: number;
        margin?: number;
        freeMargin?: number;
        marginLevel?: number;
        profit?: number;
      }>;
    };
    
    await connection.connect();
    await connection.waitSynchronized(30000);

    // Get account information
    const info = await connection.getAccountInformation();

    return res.status(200).json({
      success: true,
      accountId: accountId,
      account: {
        balance: Number(info.balance) || 0,
        equity: Number(info.equity) || 0,
        margin: Number(info.margin) || 0,
        free_margin: Number(info.freeMargin) || 0,
        margin_level: Number(info.marginLevel) || 0,
        profit: Number(info.profit) || 0,
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
