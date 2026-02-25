// Close MT5 Position via Python API
const API_BASE = "http://localhost:5000";

export interface CloseResponse {
  success: boolean;
  profit?: number;
  error?: string;
}

export async function closePosition(ticket: number): Promise<CloseResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Close failed'
    };
  }
}
