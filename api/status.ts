// Get MT5 Status via Python API
const API_BASE = "http://localhost:5000";

export interface AccountInfo {
  balance: number;
  equity: number;
  profit: number;
  login: number;
  margin?: number;
  free_margin?: number;
  margin_level?: number;
}

export interface StatusResponse {
  connected: boolean;
  account_type: string;
  running: boolean;
  account: AccountInfo | null;
  positions: number;
  server?: string;
}

export async function getMT5Status(): Promise<StatusResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/status`);
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      connected: false,
      account_type: 'demo',
      running: false,
      account: null,
      positions: 0,
    };
  }
}

export async function checkAPIConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/status`);
    const data = await response.json();
    return data.connected === true;
  } catch {
    return false;
  }
}
