import type { VercelRequest, VercelResponse } from "@vercel/node";
import MetaApi from "metaapi.cloud-sdk";

const TOKEN = process.env.METAAPI_TOKEN || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const api = new MetaApi(TOKEN);
    const accounts = await api.metatraderAccountApi.getAccounts();

    if (accounts.length === 0) {
      return res.status(200).json([]);
    }

    const account = accounts[0];
    await account.waitConnected();
    const connection = account.getRPCConnection();
    await connection.waitSynchronized();

    const positions = await connection.getPositions();

    const formattedPositions = positions.map((pos: any) => ({
      ticket: pos.id,
      symbol: pos.symbol,
      type: pos.type === 0 ? "BUY" : "SELL",
      volume: pos.volume,
      price: pos.openPrice,
      current_price: pos.currentPrice,
      profit: pos.profit,
      sl: pos.stopLoss,
      tp: pos.takeProfit,
      open_time: pos.openTime,
    }));

    return res.status(200).json(formattedPositions);
  } catch (error: any) {
    console.error("MetaApi positions error:", error);
    return res.status(500).json({ error: error.message });
  }
}
