// Continuous price engine with smooth walks and session tracking

export interface ForexPair {
  symbol: string;
  name: string;
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  spread: number;
  tickTime: string;
  tickVolume: number;
}

export interface Position {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  openTime: string;
  stopLoss?: number;
  takeProfit?: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeHistory {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  openTime: string;
  closeTime: string;
  stopLoss?: number;
  takeProfit?: number;
}

export interface AccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  profit: number;
  isDemo: boolean;
  leverage: number;
  currency: string;
  server: string;
  accountId: string;
  name: string;
}

const BASE_PAIRS: Omit<ForexPair, "bid" | "ask" | "change" | "changePercent" | "high" | "low" | "spread" | "tickTime" | "tickVolume">[] = [
  { symbol: "EURUSD", name: "Euro / US Dollar" },
  { symbol: "GBPUSD", name: "British Pound / US Dollar" },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen" },
  { symbol: "AUDUSD", name: "Australian Dollar / US Dollar" },
  { symbol: "USDCAD", name: "US Dollar / Canadian Dollar" },
  { symbol: "USDCHF", name: "US Dollar / Swiss Franc" },
  { symbol: "NZDUSD", name: "New Zealand Dollar / US Dollar" },
  { symbol: "EURJPY", name: "Euro / Japanese Yen" },
  { symbol: "GBPJPY", name: "British Pound / Japanese Yen" },
  { symbol: "XAUUSD", name: "Gold / US Dollar" },
];

const BASE_PRICES: Record<string, number> = {
  EURUSD: 1.0856,
  GBPUSD: 1.2654,
  USDJPY: 149.82,
  AUDUSD: 0.6532,
  USDCAD: 1.3612,
  USDCHF: 0.8845,
  NZDUSD: 0.6098,
  EURJPY: 162.65,
  GBPJPY: 189.54,
  XAUUSD: 2342.50,
};

// Continuous price state - survives between calls
const priceState: Record<string, number> = {};
const sessionHigh: Record<string, number> = {};
const sessionLow: Record<string, number> = {};
const tickVolumes: Record<string, number> = {};
let pricesInitialized = false;

function initPriceState() {
  for (const [symbol, price] of Object.entries(BASE_PRICES)) {
    priceState[symbol] = price;
    sessionHigh[symbol] = price;
    sessionLow[symbol] = price;
    tickVolumes[symbol] = Math.floor(Math.random() * 200) + 10;
  }
  pricesInitialized = true;
}

export function generateForexPairs(): ForexPair[] {
  if (!pricesInitialized) initPriceState();

  return BASE_PAIRS.map((pair) => {
    const prev = priceState[pair.symbol];
    
    // Smooth random walk with slight mean-reversion
    const isJPY = pair.symbol.includes("JPY");
    const isGold = pair.symbol === "XAUUSD";
    const volatility = isGold ? 0.6 : isJPY ? 0.025 : 0.00020;
    
    // Mean-reversion pull toward base price (prevents drift too far)
    const base = BASE_PRICES[pair.symbol];
    const drift = (base - prev) * 0.002;
    const noise = (Math.random() - 0.5) * volatility;
    const newPrice = prev + drift + noise;
    
    priceState[pair.symbol] = newPrice;
    
    // Track session high/low
    sessionHigh[pair.symbol] = Math.max(sessionHigh[pair.symbol], newPrice);
    sessionLow[pair.symbol] = Math.min(sessionLow[pair.symbol], newPrice);
    
    // Tick volume simulation
    tickVolumes[pair.symbol] += Math.floor(Math.random() * 20) + 1;

    const decimals = isGold ? 2 : isJPY ? 3 : 5;
    const factor = Math.pow(10, decimals);
    const bid = Math.round(newPrice * factor) / factor;
    const spreadPips = isGold ? 0.30 : isJPY ? 0.03 : 0.00015;
    const ask = Math.round((bid + spreadPips) * factor) / factor;
    const change = newPrice - base;
    const changePercent = (change / base) * 100;

    return {
      ...pair,
      bid,
      ask,
      change: Math.round(change * factor) / factor,
      changePercent: Math.round(changePercent * 100) / 100,
      high: Math.round(sessionHigh[pair.symbol] * factor) / factor,
      low: Math.round(sessionLow[pair.symbol] * factor) / factor,
      spread: Math.round(spreadPips * factor) / factor,
      tickTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      tickVolume: tickVolumes[pair.symbol],
    };
  });
}

export function generateCandleData(symbol: string, count: number = 100): CandleData[] {
  const basePrice = BASE_PRICES[symbol] || 1.0;
  const candles: CandleData[] = [];
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);
  const isGold = symbol === "XAUUSD";
  const isJPY = symbol.includes("JPY");

  for (let i = count; i >= 0; i--) {
    const open = price;
    const volatility = isGold ? 5 : isJPY ? 0.15 : 0.003;
    const change = (Math.random() - 0.48) * volatility;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;

    const decimals = isGold ? 2 : isJPY ? 3 : 5;
    const factor = Math.pow(10, decimals);

    candles.push({
      time: now - i * 3600,
      open: Math.round(open * factor) / factor,
      high: Math.round(high * factor) / factor,
      low: Math.round(low * factor) / factor,
      close: Math.round(close * factor) / factor,
      volume: Math.floor(Math.random() * 10000) + 1000,
    });

    price = close;
  }

  return candles;
}

export function createDemoAccount(): AccountInfo {
  return {
    balance: 10000,
    equity: 10000,
    margin: 0,
    freeMargin: 10000,
    marginLevel: 0,
    profit: 0,
    isDemo: true,
    leverage: 100,
    currency: "USD",
    server: "MetaQuotes-Demo",
    accountId: `${10000000000 + Math.floor(Math.random() * 900000000)}`,
    name: "Demo Trader",
  };
}

export const TRADING_VIDEOS = [
  { id: "1", title: "Forex Trading for Beginners - Full Course", url: "https://www.youtube.com/embed/Fv_VQSsFo3o", thumbnail: "https://img.youtube.com/vi/Fv_VQSsFo3o/maxresdefault.jpg", duration: "2:14:32", category: "Beginner" },
  { id: "2", title: "How to Use MetaTrader 5 - Complete Tutorial", url: "https://www.youtube.com/embed/CgVQqllmZfM", thumbnail: "https://img.youtube.com/vi/CgVQqllmZfM/maxresdefault.jpg", duration: "45:21", category: "Platform" },
  { id: "3", title: "Price Action Trading Strategy", url: "https://www.youtube.com/embed/eynxyoKgpME", thumbnail: "https://img.youtube.com/vi/eynxyoKgpME/maxresdefault.jpg", duration: "1:02:15", category: "Strategy" },
  { id: "4", title: "Risk Management in Forex Trading", url: "https://www.youtube.com/embed/pf5VrrkJEng", thumbnail: "https://img.youtube.com/vi/pf5VrrkJEng/maxresdefault.jpg", duration: "38:45", category: "Risk" },
  { id: "5", title: "Technical Analysis Masterclass", url: "https://www.youtube.com/embed/eynxyoKgpME", thumbnail: "https://img.youtube.com/vi/eynxyoKgpME/maxresdefault.jpg", duration: "1:28:10", category: "Analysis" },
  { id: "6", title: "Understanding Candlestick Patterns", url: "https://www.youtube.com/embed/C3KRwfj9F8Q", thumbnail: "https://img.youtube.com/vi/C3KRwfj9F8Q/maxresdefault.jpg", duration: "52:33", category: "Beginner" },
];

export const TRADING_TIPS = [
  { title: "Always Use Stop Loss", description: "Never enter a trade without a stop loss. It protects your capital from unexpected market moves." },
  { title: "Risk Only 1-2% Per Trade", description: "Never risk more than 1-2% of your account balance on a single trade." },
  { title: "Follow the Trend", description: "The trend is your friend. Trade in the direction of the dominant trend for higher probability setups." },
  { title: "Keep a Trading Journal", description: "Record every trade, including your reasoning, entry/exit points, and emotions." },
  { title: "Don't Overtrade", description: "Quality over quantity. Wait for high-probability setups instead of forcing trades." },
  { title: "Master One Strategy First", description: "Don't jump between strategies. Master one approach before exploring others." },
];
