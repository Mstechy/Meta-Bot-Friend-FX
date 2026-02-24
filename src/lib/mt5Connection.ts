import { AccountInfo, ForexPair, Position } from "./tradingData";

// Common MT5 Demo Servers
export const MT5_DEMO_SERVERS = [
  "MetaQuotes-Demo",
  "MetaTrader-Demo",
  "ICMarkets-Demo",
  "Exness-Demo",
  "XM-Demo",
  "FXTM-Demo",
  "HotForex-Demo",
];

// Common MT5 Live Servers
export const MT5_LIVE_SERVERS = [
  "ICMarkets-Demo",
  "ICMarkets-Live",
  "Exness-Live",
  "XM-Live",
  "FXTM-Live",
  "HotForex-Live",
  "Pepperstone-Live",
];

// MetaTrader 5 connection types
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

// API Server URL - connects to Python backend
const API_BASE = "http://localhost:5000";

class MT5Connection {
  private config: MT5Config | null = null;
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

  // Subscribe to state changes
  subscribe(callback: (state: MT5ConnectionState) => void): () => void {
    this.listeners.add(callback);
    callback(this.state);
    return () => this.listeners.delete(callback);
  }

  private updateState(updates: Partial<MT5ConnectionState>) {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(cb => cb(this.state));
  }

  // Check if Python API is running
  async checkAPIConnection(): Promise<{running: boolean, error?: string}> {
    try {
      const response = await fetch(`${API_BASE}/api/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        return { running: true };
      }
      return { running: false, error: 'API not responding' };
    } catch (error) {
      return { running: false, error: 'Cannot reach API - is Python server running?' };
    }
  }

  // Connect to Python API (which connects to real MT5)
  async connect(config: MT5Config): Promise<boolean> {
    this.config = config;
    this.updateState({ connecting: true, error: null });

    try {
      // FIRST: Check if Python API is running
      const apiCheck = await this.checkAPIConnection();
      if (!apiCheck.running) {
        this.updateState({ 
          connecting: false, 
          connected: false,
          error: "Python API not running. Please start: python python_trader/mt5_bot.py --api" 
        });
        return false;
      }

      // SECOND: Call /api/connect to establish MT5 connection
      const connectResponse = await fetch(`${API_BASE}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_type: config.isDemo ? 'demo' : 'real',
          login: config.login,
          password: config.password,
          server: config.server,
        }),
      });
      
      if (!connectResponse.ok) {
        throw new Error("Failed to connect to MT5");
      }
      
      const connectResult = await connectResponse.json();
      
      if (!connectResult.success) {
        const errorMsg = connectResult.error || "Connection failed";
        // Provide more helpful error messages
        if (errorMsg.includes("not logged in") || errorMsg.includes("initialize")) {
          throw new Error("MT5 Terminal not running. Please open MetaTrader 5 first!");
        }
        if (errorMsg.includes("invalid")) {
          throw new Error("Invalid login/password. Please check your credentials.");
        }
        throw new Error(errorMsg);
      }
      
      // Now get status
      const statusResponse = await fetch(`${API_BASE}/api/status`);
      const status = await statusResponse.json();
      
      if (status.connected) {
        // Connected to real MT5 via Python API
        this.updateState({
          connected: true,
          connecting: false,
          account: {
            balance: status.account?.balance || 0,
            equity: status.account?.equity || 0,
            margin: status.account?.margin || 0,
            freeMargin: status.account?.free_margin || 0,
            marginLevel: status.account?.margin_level || 0,
            profit: status.account?.profit || 0,
            isDemo: status.account_type === "demo",
            leverage: 100,
            currency: "USD",
            server: status.server || config.server,
            accountId: `${status.account?.login || 0}`,
            name: "MT5 Trader",
          },
          error: null,
        });
        
        // Start polling for updates
        this.startPolling();
        return true;
      } else {
        throw new Error("MT5 not connected. Make sure you're logged in to MT5 terminal.");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Connection failed";
      this.updateState({ 
        connecting: false, 
        connected: false,
        error: errorMessage 
      });
      return false;
    }
  }

  // Start polling for real-time updates
  private startPolling() {
    if (this.pollInterval) return;
    
    this.pollInterval = setInterval(async () => {
      try {
        // Get status
        const statusRes = await fetch(`${API_BASE}/api/status`);
        const status = await statusRes.json();
        
        if (status.connected) {
          // Update account
          if (status.account) {
            this.updateState({
              account: {
                ...this.state.account!,
                balance: status.account.balance,
                equity: status.account.equity,
                profit: status.account.profit,
              }
            });
          }
          
          // Get positions
          const posRes = await fetch(`${API_BASE}/api/positions`);
          const positions = await posRes.json();
          
          // Convert positions to our format
          interface MT5Position {
            ticket: number;
            symbol: string;
            type: string;
            volume: number;
            price: number;
            current_price?: number;
            profit: number;
            sl?: number;
            tp?: number;
          }
          const convertedPositions: Position[] = Array.isArray(positions) ? positions.map((p: MT5Position) => ({
            id: `${p.ticket}`,
            symbol: p.symbol,
            type: p.type as "BUY" | "SELL",
            volume: p.volume,
            openPrice: p.price,
            currentPrice: p.current_price || p.price,
            profit: p.profit,
            openTime: new Date().toISOString(),
            stopLoss: p.sl,
            takeProfit: p.tp,
          })) : [];
          
          this.updateState({ positions: convertedPositions });
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 2000);
  }

  // Disconnect
  disconnect() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.updateState({
      connected: false,
      connecting: false,
      account: null,
      positions: [],
    });
  }

  // Place order via API
  async placeOrder(order: {
    symbol: string;
    type: "BUY" | "SELL";
    volume: number;
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<Position | null> {
    if (!this.state.connected) {
      throw new Error("Not connected to MT5");
    }

    try {
      const response = await fetch(`${API_BASE}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: order.symbol,
          type: order.type,
          volume: order.volume,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Order rejected by MT5");
      }

      const trade = data.trade;
      const position: Position = {
        id: String(trade.ticket),
        symbol: trade.symbol,
        type: trade.type as "BUY" | "SELL",
        volume: trade.volume,
        openPrice: trade.price,
        currentPrice: trade.price,
        profit: 0,
        openTime: trade.open_time,
        stopLoss: trade.sl,
        takeProfit: trade.tp,
      };

      // Optimistically merge into local state; polling will refresh it.
      this.updateState({ positions: [...this.state.positions, position] });
      return position;
    } catch (e) {
      console.error("MT5 order error:", e);
      throw e;
    }
  }

  // Close position
  async closePosition(positionId: string): Promise<boolean> {
    if (!this.state.connected) {
      throw new Error("Not connected to MT5");
    }
    
    // Close via Python API
    try {
      const response = await fetch(`${API_BASE}/api/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: parseInt(positionId) })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Get current state
  getState(): MT5ConnectionState {
    return this.state;
  }

  // Check if connected
  isConnected(): boolean {
    return this.state.connected;
  }

  // Get account info
  getAccount(): AccountInfo | null {
    return this.state.account;
  }

  // Get open positions
  getPositions(): Position[] {
    return this.state.positions;
  }

  // Get price pairs (from Python)
  async getPrices(): Promise<ForexPair[]> {
    try {
      const response = await fetch(`${API_BASE}/api/prices`);
      return await response.json();
    } catch {
      return [];
    }
  }
}

// Export singleton instance
const mt5Connection = new MT5Connection();
export default mt5Connection;

// Helper: Auto-connect to Python API (which should be connected to MT5)
export async function connectToMT5API(): Promise<boolean> {
  return mt5Connection.connect({
    host: "localhost",
    port: 5000,
    login: 0,
    password: "",
    server: "MetaQuotes-Demo",
    isDemo: true,
  });
}

// Helper: Check if Python API is running
export async function checkAPIConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/status`);
    const data = await response.json();
    return data.connected === true;
  } catch {
    return false;
  }
}
