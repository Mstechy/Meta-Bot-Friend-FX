// Open MT5 Order via Python API
const API_BASE = "http://localhost:5000";

export interface OrderParams {
  symbol: string;
  type: "BUY" | "SELL";
  volume?: number;
  sl_pips?: number;
  tp_pips?: number;
}

export interface OrderResponse {
  success: boolean;
  trade?: {
    ticket: number;
    symbol: string;
    type: string;
    volume: number;
    price: number;
    sl?: number;
    tp?: number;
    open_time: string;
  };
  error?: string;
}

export async function openOrder(params: OrderParams): Promise<OrderResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Order failed'
    };
  }
}
