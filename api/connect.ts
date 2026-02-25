// Connect to MT5 via Python API
const API_BASE = "http://localhost:5000";

export interface ConnectParams {
  account_type: 'demo' | 'real';
  login?: number;
  password?: string;
  server?: string;
}

export interface ConnectResponse {
  success: boolean;
  error?: string;
  message?: string;
}

export async function connectToMT5(params: ConnectParams): Promise<ConnectResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    };
  }
}

export async function disconnectFromMT5(): Promise<ConnectResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/disconnect`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Disconnect failed'
    };
  }
}
