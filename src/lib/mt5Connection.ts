import { AccountInfo, ForexPair, Position } from “./tradingData”;

export const MT5_DEMO_SERVERS = [
“MetaQuotes-Demo”,
“MetaTrader-Demo”,
“ICMarkets-Demo”,
“Exness-Demo”,
“XM-Demo”,
“FXTM-Demo”,
“HotForex-Demo”,
];

export const MT5_LIVE_SERVERS = [
“ICMarkets-Live”,
“Exness-Live”,
“XM-Live”,
“FXTM-Live”,
“HotForex-Live”,
“Pepperstone-Live”,
];

export interface MT5Config {
host: string;
port: number;
login: number;
password: string;
server: string;
isDemo: boolean;
}

export interface MT5ConnectionState {
connected: boolean;
connecting: boolean;
error: string | null;
account: AccountInfo | null;
positions: Position[];
pairs: ForexPair[];
}

// Now points to our Next.js API routes instead of Python
const API_BASE = “/api/mt5”;

class MT5Connection {
private config: MT5Config | null = null;
private accountId: string | null = null;
private state: MT5ConnectionState = {
connected: false,
connecting: false,
error: null,
account: null,
positions: [],
pairs: [],
};
private listeners: Set<(state: MT5ConnectionState) => void> = new Set();
private pollInterval: ReturnType<typeof setInterval> | null = null;

subscribe(callback: (state: MT5ConnectionState) => void): () => void {
this.listeners.add(callback);
callback(this.state);
return () => this.listeners.delete(callback);
}

private updateState(updates: Partial<MT5ConnectionState>) {
this.state = { …this.state, …updates };
this.listeners.forEach(cb => cb(this.state));
}

// No longer need to check Python — MetaApi runs in the cloud!
async checkAPIConnection(): Promise<{ running: boolean; error?: string }> {
return { running: true };
}

async connect(config: MT5Config): Promise<boolean> {
this.config = config;
this.updateState({ connecting: true, error: null });

```
try {
  const res = await fetch(`${API_BASE}/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      login: config.login,
      password: config.password,
      server: config.server,
      account_type: config.isDemo ? "demo" : "real",
    }),
  });

  const result = await res.json();

  if (!result.success) {
    throw new Error(result.error || "Connection failed");
  }

  // Save accountId for future requests
  this.accountId = result.accountId;

  this.updateState({
    connected: true,
    connecting: false,
    account: {
      balance: result.account.balance,
      equity: result.account.equity,
      margin: result.account.margin,
      freeMargin: result.account.free_margin,
      marginLevel: result.account.margin_level,
      profit: result.account.profit,
      isDemo: config.isDemo,
      leverage: 100,
      currency: "USD",
      server: config.server,
      accountId: `${result.account.login}`,
      name: "MT5 Trader",
    },
    error: null,
  });

  this.startPolling();
  return true;
} catch (error) {
  const msg = error instanceof Error ? error.message : "Connection failed";
  this.updateState({ connecting: false, connected: false, error: msg });
  return false;
}
```

}

private startPolling() {
if (this.pollInterval) return;

```
this.pollInterval = setInterval(async () => {
  try {
    if (!this.accountId) return;

    const [statusRes, posRes] = await Promise.all([
      fetch(`${API_BASE}/status?accountId=${this.accountId}`),
      fetch(`${API_BASE}/positions?accountId=${this.accountId}`),
    ]);

    const status = await statusRes.json();
    const positions = await posRes.json();

    if (status.account) {
      this.updateState({
        account: {
          ...this.state.account!,
          balance: status.account.balance,
          equity: status.account.equity,
          profit: status.account.profit,
        },
      });
    }

    interface MT5Position {
      id: string;
      symbol: string;
      type: string;
      volume: number;
      openPrice: number;
      currentPrice: number;
      profit: number;
      openTime: string;
      stopLoss?: number;
      takeProfit?: number;
    }

    const converted: Position[] = Array.isArray(positions)
      ? positions.map((p: MT5Position) => ({
          id: p.id,
          symbol: p.symbol,
          type: p.type as "BUY" | "SELL",
          volume: p.volume,
          openPrice: p.openPrice,
          currentPrice: p.currentPrice,
          profit: p.profit,
          openTime: p.openTime,
          stopLoss: p.stopLoss,
          takeProfit: p.takeProfit,
        }))
      : [];

    this.updateState({ positions: converted });
  } catch (e) {
    console.error("Polling error:", e);
  }
}, 3000);
```

}

disconnect() {
if (this.pollInterval) {
clearInterval(this.pollInterval);
this.pollInterval = null;
}
this.accountId = null;
this.updateState({
connected: false,
connecting: false,
account: null,
positions: [],
});
}

async placeOrder(order: {
symbol: string;
type: “BUY” | “SELL”;
volume: number;
stopLoss?: number;
takeProfit?: number;
}): Promise<Position | null> {
if (!this.state.connected || !this.accountId) {
throw new Error(“Not connected to MT5”);
}

```
const res = await fetch(`${API_BASE}/order`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...order, accountId: this.accountId }),
});

const data = await res.json();
if (!data.success) throw new Error(data.error || "Order failed");

const position: Position = {
  id: data.trade.id,
  symbol: data.trade.symbol,
  type: data.trade.type as "BUY" | "SELL",
  volume: data.trade.volume,
  openPrice: data.trade.openPrice,
  currentPrice: data.trade.openPrice,
  profit: 0,
  openTime: data.trade.openTime,
  stopLoss: data.trade.stopLoss,
  takeProfit: data.trade.takeProfit,
};

this.updateState({ positions: [...this.state.positions, position] });
return position;
```

}

async closePosition(positionId: string): Promise<boolean> {
if (!this.state.connected || !this.accountId) return false;

```
const res = await fetch(`${API_BASE}/close`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ positionId, accountId: this.accountId }),
});
return res.ok;
```

}

getState(): MT5ConnectionState { return this.state; }
isConnected(): boolean { return this.state.connected; }
getAccount(): AccountInfo | null { return this.state.account; }
getPositions(): Position[] { return this.state.positions; }

async getPrices(): Promise<ForexPair[]> {
try {
const res = await fetch(`${API_BASE}/prices?accountId=${this.accountId}`);
return await res.json();
} catch { return []; }
}
}

const mt5Connection = new MT5Connection();
export default mt5Connection;

export async function connectToMT5API(): Promise<boolean> {
return mt5Connection.connect({
host: “localhost”,
port: 5000,
login: 0,
password: “”,
server: “MetaQuotes-Demo”,
isDemo: true,
});
}

export async function checkAPIConnection(): Promise<boolean> {
return true; // Always true with MetaApi cloud
}