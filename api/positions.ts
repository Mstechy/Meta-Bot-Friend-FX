// Get MT5 Positions via Python API
const API_BASE = "http://localhost:5000";

export interface Position {
  ticket: number;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  price: number;
  current_price: number;
  profit: number;
  sl?: number;
  tp?: number;
  open_time?: string;
}

export async function getPositions(): Promise<Position[]> {
  try {
    const response = await fetch(`${API_BASE}/api/positions`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to get positions:", error);
    return [];
  }
}
