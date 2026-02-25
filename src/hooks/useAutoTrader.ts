import { useEffect, useRef, useCallback, useState } from "react";
import { CandleData, ForexPair, Position } from "@/lib/tradingData";
import { toast } from "sonner";
import {
  playTradeOpenSound,
  playTPHitSound,
  playSLHitSound,
  playSignalSound,
} from "@/lib/tradeSounds";
import riskManager, { RiskConfig } from "@/lib/riskManagement";
import { 
  detectMultiStrategySignal, 
  type StrategyConfig as IndicatorStrategyConfig,
  calculateRSI,
  calculateMACD,
  calculateStochastic,
  calculateEMA,
  calculateBollingerBands
} from "@/lib/indicators";

export interface AutoTradeLog {
  id: string;
  time: string;
  action: "OPEN" | "CLOSE" | "SL_HIT" | "TP_HIT" | "TRAILING" | "SIGNAL" | "RISK_BLOCK" | "MANUAL_CLOSE" | "QUICK_REENTRY";
  symbol: string;
  type: "BUY" | "SELL";
  price: number;
  profit?: number;
  reason: string;
}

interface AutoTraderConfig {
  enabled: boolean;
  riskPercent: number;
  maxOpenTrades: number;
  takeProfitPips: number;
  stopLossPips: number;
  trailingStop: boolean;
  trailingStopPips: number;
  cooldownMs: number;
  soundEnabled: boolean;
  // Quick re-entry after profit
  quickReentry: boolean;
  reentryCooldownMs: number;
  // Advanced risk management
  maxDailyLoss: number;
  maxDrawdownPercent: number;
  volatilityAdjustment: boolean;
  atrMultiplier: number;
  useMartingale: boolean;
  martingaleMultiplier: number;
  maxMartingaleSteps: number;
  sessionLimit: boolean;
  sessionStartHour: number;
  sessionEndHour: number;
  maxTradesPerSession: number;
  newsFilter: boolean;
  // Strategy settings
  useMultiStrategy: boolean;
  strategyTrend: boolean;
  strategyMeanReversion: boolean;
  strategyBreakout: boolean;
  strategyMomentum: boolean;
  minStrategyConfidence: number;
  // Smart Cash Out - Close when price retraces from peak and won't reach again
  smartCashOut: boolean;
  smartCashOutMinProfit: number;    // Minimum profit $ to consider for smart cashout
  smartCashOutRetracePercent: number; // % of peak profit retrace to trigger analysis
  smartCashOutConfidence: number;   // Confidence threshold to close
  // Smart Loss Recovery - Analyze losing trades before closing
  smartLossRecovery: boolean;        // Enable/disable smart loss recovery
  smartLossRecoveryConfidence: number; // Confidence threshold to keep trade open
  smartLossMaxLossPercent: number;   // Max loss % from entry to attempt recovery
  // Manual Confirmation - Ask before closing losing trades
  manualConfirmLoss: boolean;        // Ask before closing trades in loss
  manualConfirmLossThreshold: number; // $ threshold for manual confirmation
}

const DEFAULT_CONFIG: AutoTraderConfig = {
  enabled: false,
  riskPercent: 1,
  maxOpenTrades: 3,
  takeProfitPips: 30,
  stopLossPips: 20,
  trailingStop: true,
  trailingStopPips: 15,
  cooldownMs: 30000,
  soundEnabled: true,
  // Quick re-entry after profit
  quickReentry: true,
  reentryCooldownMs: 2000, // Only 2 seconds after a win!
  // Advanced risk management
  maxDailyLoss: 500,
  maxDrawdownPercent: 10,
  volatilityAdjustment: false,
  atrMultiplier: 2,
  useMartingale: false,
  martingaleMultiplier: 2,
  maxMartingaleSteps: 3,
  sessionLimit: false,
  sessionStartHour: 8,
  sessionEndHour: 20,
  maxTradesPerSession: 10,
  newsFilter: false,
  // Strategy settings
  useMultiStrategy: true,
  strategyTrend: true,
  strategyMeanReversion: true,
  strategyBreakout: true,
  strategyMomentum: true,
  minStrategyConfidence: 60,
  // Smart Cash Out - Close when price retraces from peak and won't reach again
  smartCashOut: true,
  smartCashOutMinProfit: 5,       // Minimum $5 profit to consider
  smartCashOutRetracePercent: 50, // When profit drops 50% from peak, analyze
  smartCashOutConfidence: 70,     // Need 70% confidence to close early
  // Smart Loss Recovery - Analyze losing trades before closing
  smartLossRecovery: true,        // Enable smart loss recovery
  smartLossRecoveryConfidence: 70, // Need 70% confidence to keep trade open
  smartLossMaxLossPercent: 50,   // Max 50% of SL loss to attempt recovery
  // Manual Confirmation - Ask before closing losing trades
  manualConfirmLoss: false,       // Disabled by default
  manualConfirmLossThreshold: 10,  // $10 threshold for manual confirmation
};

const STORAGE_KEY = "mt5_autotrader_config";
const LOG_KEY = "mt5_autotrader_log";

// Analysis result for smart cashout
interface ContinuationAnalysis {
  willContinue: boolean | null;  // true = price will continue to peak, false = reversal likely
  confidence: number;             // 0-100 confidence level
  reason: string;                // Human-readable explanation
}

/**
 * Smart Market Analysis - Determines if price will continue to peak or reverse
 * Uses multiple indicators to make a professional trading decision
 */
function analyzeMarketForContinuation(
  candles: CandleData[],
  positionType: "BUY" | "SELL",
  peakPrice: number
): ContinuationAnalysis {
  const currentPrice = candles[candles.length - 1].close;
  const signals: { indicator: string; direction: "bullish" | "bearish" | "neutral"; weight: number }[] = [];

  // 1. RSI Analysis - Overbought = reversal likely, Oversold = continuation likely
  const rsi = calculateRSI(candles);
  if (positionType === "BUY") {
    if (rsi > 70) signals.push({ indicator: "RSI", direction: "bearish", weight: 25 }); // Overbought - reversal
    else if (rsi < 30) signals.push({ indicator: "RSI", direction: "bullish", weight: 20 }); // Oversold - continuation
    else if (rsi > 50) signals.push({ indicator: "RSI", direction: "bullish", weight: 15 });
  } else {
    if (rsi < 30) signals.push({ indicator: "RSI", direction: "bullish", weight: 25 }); // Oversold - reversal
    else if (rsi > 70) signals.push({ indicator: "RSI", direction: "bearish", weight: 20 }); // Overbought - continuation
    else if (rsi < 50) signals.push({ indicator: "RSI", direction: "bearish", weight: 15 });
  }

  // 2. MACD Analysis - Histogram direction
  const macd = calculateMACD(candles);
  if (positionType === "BUY") {
    if (macd.histogram > 0 && macd.macd > macd.signal) signals.push({ indicator: "MACD", direction: "bullish", weight: 25 });
    else if (macd.histogram < 0) signals.push({ indicator: "MACD", direction: "bearish", weight: 25 });
    else signals.push({ indicator: "MACD", direction: "neutral", weight: 10 });
  } else {
    if (macd.histogram < 0 && macd.macd < macd.signal) signals.push({ indicator: "MACD", direction: "bearish", weight: 25 });
    else if (macd.histogram > 0) signals.push({ indicator: "MACD", direction: "bullish", weight: 25 });
    else signals.push({ indicator: "MACD", direction: "neutral", weight: 10 });
  }

  // 3. Stochastic Analysis
  const stoch = calculateStochastic(candles);
  if (positionType === "BUY") {
    if (stoch.k > 80) signals.push({ indicator: "Stoch", direction: "bearish", weight: 20 });
    else if (stoch.k < 20) signals.push({ indicator: "Stoch", direction: "bullish", weight: 15 });
    else if (stoch.k > stoch.d && stoch.k < 80) signals.push({ indicator: "Stoch", direction: "bullish", weight: 15 });
  } else {
    if (stoch.k < 20) signals.push({ indicator: "Stoch", direction: "bullish", weight: 20 });
    else if (stoch.k > 80) signals.push({ indicator: "Stoch", direction: "bearish", weight: 15 });
    else if (stoch.k < stoch.d && stoch.k > 20) signals.push({ indicator: "Stoch", direction: "bearish", weight: 15 });
  }

  // 4. Trend Analysis - EMA alignment
  const ema20 = calculateEMA(candles, 20);
  const ema50 = calculateEMA(candles, 50);
  if (positionType === "BUY") {
    if (currentPrice > ema20 && ema20 > ema50) signals.push({ indicator: "Trend", direction: "bullish", weight: 25 });
    else if (currentPrice < ema20 && ema20 < ema50) signals.push({ indicator: "Trend", direction: "bearish", weight: 25 });
    else signals.push({ indicator: "Trend", direction: "neutral", weight: 10 });
  } else {
    if (currentPrice < ema20 && ema20 < ema50) signals.push({ indicator: "Trend", direction: "bearish", weight: 25 });
    else if (currentPrice > ema20 && ema20 > ema50) signals.push({ indicator: "Trend", direction: "bullish", weight: 25 });
    else signals.push({ indicator: "Trend", direction: "neutral", weight: 10 });
  }

  // 5. Bollinger Band Analysis - Price position
  const bollinger = calculateBollingerBands(candles);
  if (positionType === "BUY") {
    if (currentPrice >= bollinger.upper) signals.push({ indicator: "BB", direction: "bearish", weight: 20 }); // At resistance
    else if (currentPrice <= bollinger.lower) signals.push({ indicator: "BB", direction: "bullish", weight: 15 }); // At support
    else if (currentPrice > bollinger.middle) signals.push({ indicator: "BB", direction: "bullish", weight: 10 });
  } else {
    if (currentPrice <= bollinger.lower) signals.push({ indicator: "BB", direction: "bullish", weight: 20 }); // At support
    else if (currentPrice >= bollinger.upper) signals.push({ indicator: "BB", direction: "bearish", weight: 15 }); // At resistance
    else if (currentPrice < bollinger.middle) signals.push({ indicator: "BB", direction: "bearish", weight: 10 });
  }

  // Calculate weighted score
  let bullishScore = 0;
  let bearishScore = 0;
  let totalWeight = 0;

  for (const sig of signals) {
    const weight = sig.weight;
    totalWeight += weight;
    if (sig.direction === "bullish") bullishScore += weight;
    else if (sig.direction === "bearish") bearishScore += weight;
  }

  const bullishPercent = totalWeight > 0 ? (bullishScore / totalWeight) * 100 : 50;
  const bearishPercent = totalWeight > 0 ? (bearishScore / totalWeight) * 100 : 50;

  // Determine direction based on position type
  let willContinue: boolean | null = null;
  let confidence = 0;
  let reason = "";

  if (positionType === "BUY") {
    if (bullishPercent > bearishPercent + 20) {
      willContinue = true;
      confidence = Math.round(bullishPercent);
      reason = `Bullish continuation: ${bullishPercent.toFixed(0)}% bullish signals`;
    } else if (bearishPercent > bullishPercent + 20) {
      willContinue = false;
      confidence = Math.round(bearishPercent);
      reason = `Bearish reversal: ${bearishPercent.toFixed(0)}% bearish signals - won't reach ${peakPrice}`;
    }
  } else {
    if (bearishPercent > bullishPercent + 20) {
      willContinue = true;
      confidence = Math.round(bearishPercent);
      reason = `Bearish continuation: ${bearishPercent.toFixed(0)}% bearish signals`;
    } else if (bullishPercent > bearishPercent + 20) {
      willContinue = false;
      confidence = Math.round(bullishPercent);
      reason = `Bullish reversal: ${bullishPercent.toFixed(0)}% bullish signals - won't reach ${peakPrice}`;
    }
  }

  if (willContinue === null) {
    willContinue = true;
    confidence = 50;
    reason = "Mixed signals - defaulting to continuation";
  }

  return { willContinue, confidence, reason };
}

// Store position SL/TP tracking
interface PositionTracker {
  stopLoss: number;
  takeProfit: number;
  initialStopLoss: number;
  peakProfit: number;        // Track highest profit reached
  peakPrice: number;         // Price at which peak profit was reached
}

const positionTrackers = new Map<string, PositionTracker>();
const trailingBest = new Map<string, number>();
const candleSeries = new Map<string, CandleData[]>();

function getDecimals(symbol: string) {
  if (symbol === "XAUUSD") return 2;
  if (symbol.includes("JPY")) return 3;
  return 5;
}

function roundToSymbol(symbol: string, price: number) {
  const d = getDecimals(symbol);
  const factor = Math.pow(10, d);
  return Math.round(price * factor) / factor;
}

function updateCandlesFromTick(pair: ForexPair): CandleData[] {
  const symbol = pair.symbol;
  const now = Math.floor(Date.now() / 1000);
  const price = pair.bid;

  const series = candleSeries.get(symbol) ?? [];
  const last = series[series.length - 1];
  const open = last ? last.close : price;
  const high = Math.max(open, price);
  const low = Math.min(open, price);

  const next: CandleData = {
    time: now,
    open: roundToSymbol(symbol, open),
    high: roundToSymbol(symbol, high),
    low: roundToSymbol(symbol, low),
    close: roundToSymbol(symbol, price),
    volume: pair.tickVolume,
  };

  const updated = [...series, next].slice(-200);
  candleSeries.set(symbol, updated);
  return updated;
}

function loadConfig(): AutoTraderConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function loadLogs(): AutoTradeLog[] {
  try {
    const saved = localStorage.getItem(LOG_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function useAutoTrader(
  pairs: ForexPair[],
  positions: Position[],
  accountBalance: number,
  onPlaceOrder: (position: Position) => void,
  onClosePosition: (id: string) => void,
) {
  const [config, setConfig] = useState<AutoTraderConfig>(loadConfig);
  const [logs, setLogs] = useState<AutoTradeLog[]>(loadLogs);
  const lastTradeTime = useRef(0);
  const lastWinTime = useRef(0); // Track last winning trade time
  const tickRef = useRef(0);
  const consecutiveWins = useRef(0); // Track consecutive wins for momentum

  // Initialize risk manager with config
  useEffect(() => {
    const riskConfig: Partial<RiskConfig> = {
      riskPercent: config.riskPercent,
      maxOpenTrades: config.maxOpenTrades,
      stopLossPips: config.stopLossPips,
      takeProfitPips: config.takeProfitPips,
      maxDailyLoss: config.maxDailyLoss,
      maxDrawdownPercent: config.maxDrawdownPercent,
      volatilityAdjustment: config.volatilityAdjustment,
      atrMultiplier: config.atrMultiplier,
      useMartingale: config.useMartingale,
      martingaleMultiplier: config.martingaleMultiplier,
      maxMartingaleSteps: config.maxMartingaleSteps,
      sessionLimit: config.sessionLimit,
      sessionStartHour: config.sessionStartHour,
      sessionEndHour: config.sessionEndHour,
      maxTradesPerSession: config.maxTradesPerSession,
      newsFilter: config.newsFilter,
    };
    riskManager.updateConfig(riskConfig);
  }, [config]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(-100)));
  }, [logs]);

  const addLog = useCallback((log: Omit<AutoTradeLog, "id" | "time">) => {
    const entry: AutoTradeLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: new Date().toISOString(),
    };
    setLogs((prev) => [...prev.slice(-99), entry]);
    return entry;
  }, []);

  const updateConfig = useCallback((updates: Partial<AutoTraderConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const toggleEnabled = useCallback(() => {
    setConfig((prev) => {
      const next = { ...prev, enabled: !prev.enabled };
      if (next.enabled) {
        toast.success("🤖 Auto-Trader ACTIVATED", {
          description: `Risk: ${next.riskPercent}% | SL: ${next.stopLossPips}p | TP: ${next.takeProfitPips}p | Quick Re-entry: ${next.quickReentry ? 'ON' : 'OFF'}`,
        });
        if (next.soundEnabled) playSignalSound();
        // Reset consecutive wins on enable
        consecutiveWins.current = 0;
      } else {
        toast.info("🤖 Auto-Trader DEACTIVATED");
      }
      return next;
    });
  }, []);

  // Calculate profit for a position
  const calculateProfit = useCallback((position: Position, currentPrice: number): number => {
    const pipValue = position.symbol === "XAUUSD" ? 1 : position.symbol.includes("JPY") ? 0.01 : 0.0001;
    const pips = position.type === "BUY" 
      ? (currentPrice - position.openPrice) / pipValue
      : (position.openPrice - currentPrice) / pipValue;
    const pipDollarValue = position.symbol === "XAUUSD" ? 100 : position.symbol.includes("JPY") ? 1000 : 10;
    return pips * pipDollarValue * position.volume;
  }, []);

  const buildStrategies = useCallback((): IndicatorStrategyConfig[] => {
    const min = config.minStrategyConfidence;
    const base = (name: IndicatorStrategyConfig["name"], enabled: boolean, weight: number): IndicatorStrategyConfig => ({
      name,
      enabled,
      weight,
      minConfidence: min,
    });
    return [
      base("trend", config.strategyTrend, 25),
      base("mean_reversion", config.strategyMeanReversion, 25),
      base("breakout", config.strategyBreakout, 25),
      base("momentum", config.strategyMomentum, 25),
    ];
  }, [config.minStrategyConfidence, config.strategyTrend, config.strategyMeanReversion, config.strategyBreakout, config.strategyMomentum]);

  // Get signal from strategies using live tick-built candles (more consistent than random candles)
  const getSignal = useCallback((pair: ForexPair): { signal: "BUY" | "SELL" | null; confidence: number; reason: string } => {
    const candles = updateCandlesFromTick(pair);

    // Multi-strategy mode (recommended)
    if (config.useMultiStrategy) {
      const res = detectMultiStrategySignal(candles, buildStrategies());
      if (res.signal === "BUY" || res.signal === "SELL") {
        return { signal: res.signal, confidence: Math.round(res.confidence), reason: res.reason };
      }
      return { signal: null, confidence: 0, reason: res.reason };
    }

    // Fallback: simple momentum based on session position
    const range = pair.high - pair.low;
    if (range > 0) {
      const pos = (pair.bid - pair.low) / range;
      if (pos < 0.15) return { signal: "BUY", confidence: 60, reason: "Range low bounce" };
      if (pos > 0.85) return { signal: "SELL", confidence: 60, reason: "Range high fade" };
    }

    return { signal: null, confidence: 0, reason: "No clear signal" };
  }, [buildStrategies, config.useMultiStrategy]);

  // Try to open a new trade
  const tryOpenTrade = useCallback((isQuickReentry: boolean = false) => {
    const now = Date.now();
    const currentPositions = positions;
    
    if (currentPositions.length >= config.maxOpenTrades) return false;
    
    // Use shorter cooldown for quick re-entry after wins
    const cooldown = (isQuickReentry && config.quickReentry) 
      ? config.reentryCooldownMs 
      : config.cooldownMs;
    
    if (now - lastTradeTime.current < cooldown) return false;

    for (const pair of pairs) {
      if (currentPositions.length >= config.maxOpenTrades) break;
      if (currentPositions.some((p) => p.symbol === pair.symbol)) continue;

      const { signal, confidence, reason } = getSignal(pair);
      if (!signal) continue;

      const pipVal = pair.symbol === "XAUUSD" ? 1 : pair.symbol.includes("JPY") ? 0.01 : 0.0001;
      const slDistance = config.stopLossPips * pipVal;
      const tpDistance = config.takeProfitPips * pipVal;
      const price = signal === "BUY" ? pair.ask : pair.bid;
      
      const stopLoss = signal === "BUY" ? price - slDistance : price + slDistance;
      const takeProfit = signal === "BUY" ? price + tpDistance : price - tpDistance;

      // Calculate lot size
      const riskDollars = accountBalance * (config.riskPercent / 100);
      const pipDollarValue = pair.symbol === "XAUUSD" ? 100 : pair.symbol.includes("JPY") ? 1000 : 10;
      const lotSize = Math.max(0.01, Math.round((riskDollars / (config.stopLossPips * pipDollarValue)) * 100) / 100);

      const position: Position = {
        id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        symbol: pair.symbol,
        type: signal,
        volume: Math.min(lotSize, 1.0),
        openPrice: price,
        currentPrice: price,
        profit: 0,
        openTime: new Date().toISOString(),
        stopLoss: roundToSymbol(pair.symbol, stopLoss),
        takeProfit: roundToSymbol(pair.symbol, takeProfit),
      };

positionTrackers.set(position.id, {
        stopLoss: position.stopLoss || 0,
        takeProfit: position.takeProfit || 0,
        initialStopLoss: position.stopLoss || 0,
        peakProfit: 0,
        peakPrice: position.openPrice,
      });

      onPlaceOrder(position);
      lastTradeTime.current = now;

      const actionType = isQuickReentry ? "QUICK_REENTRY" : "OPEN";
      addLog({ 
        action: actionType, 
        symbol: pair.symbol, 
        type: signal, 
        price, 
        reason: isQuickReentry 
          ? `🚀 Quick Re-entry after win! ${signal} ${pair.symbol}`
          : `🤖 Opened ${signal} | SL: ${position.stopLoss?.toFixed(5)} | TP: ${position.takeProfit?.toFixed(5)}` 
      });

      if (config.soundEnabled) playTradeOpenSound();
      toast.info(isQuickReentry 
        ? `🚀 Quick ${signal} ${pair.symbol} @ ${price.toFixed(5)}` 
        : `🤖 ${signal} ${pair.symbol} Opened @ ${price.toFixed(5)}`, {
        description: `Lot: ${position.volume} | SL: ${position.stopLoss} | TP: ${position.takeProfit}`,
      });

      return true; // Successfully opened a trade
    }
    return false;
  }, [config, pairs, positions, accountBalance, getSignal, onPlaceOrder, addLog]);

  const tick = useCallback(() => {
    if (!config.enabled) return;

    tickRef.current++;
    const now = Date.now();

    // === 1. CHECK EXISTING POSITIONS FOR SL/TP ===
    if (tickRef.current % 2 === 0) {
      for (const pos of positions) {
        const currentPrice = pos.currentPrice;
        const profit = calculateProfit(pos, currentPrice);
        
        let tracker = positionTrackers.get(pos.id);
if (!tracker && pos.stopLoss !== undefined && pos.takeProfit !== undefined) {
          tracker = {
            stopLoss: pos.stopLoss,
            takeProfit: pos.takeProfit,
            initialStopLoss: pos.stopLoss || 0,
            peakProfit: 0,
            peakPrice: pos.openPrice,
          };
          positionTrackers.set(pos.id, tracker);
        }
        
        if (!tracker) continue;

        // === CHECK TAKE PROFIT (WIN TRADE) ===
        // For BUY: TP is hit when price goes UP above TP level
        // For SELL: TP is hit when price goes DOWN below TP level
        const isTPHit = pos.type === "BUY" 
          ? currentPrice >= tracker.takeProfit 
          : currentPrice <= tracker.takeProfit;
        
        // Close if TP is hit - don't check profit (spread can cause issues)
        if (isTPHit) {
          // WIN! Close and try to re-enter immediately
          consecutiveWins.current++;
          lastWinTime.current = now;
          
          addLog({ 
            action: "TP_HIT", 
            symbol: pos.symbol, 
            type: pos.type, 
            price: currentPrice, 
            profit: profit, 
            reason: `🎯 WIN! Take Profit hit! Profit: $${profit.toFixed(2)} | Consecutive wins: ${consecutiveWins.current}` 
          });
          toast.success(`🎯 WIN! ${pos.type} ${pos.symbol} | +$${profit.toFixed(2)}`, {
            description: `Closed at ${currentPrice.toFixed(5)} | Quick re-entry ${config.quickReentry ? 'ENABLED' : 'disabled'}`,
          });
          if (config.soundEnabled) playTPHitSound();
          riskManager.recordTradeResult(profit);
          positionTrackers.delete(pos.id);
          trailingBest.delete(pos.id);
          onClosePosition(pos.id);
          
          // Try to immediately open a new trade after winning
          if (config.quickReentry) {
            // Don't wait - try immediately!
            tryOpenTrade(true);
          }
          continue;
        }

        // === CHECK STOP LOSS (LOSE TRADE) ===
        // For BUY: SL is hit when price goes DOWN below SL level
        // For SELL: SL is hit when price goes UP above SL level
        const isSLHit = pos.type === "BUY" 
          ? currentPrice <= tracker.stopLoss 
          : currentPrice >= tracker.stopLoss;
        
        // Close if SL is hit - don't check profit (spread can cause issues)
        if (isSLHit) {
          // === SMART LOSS RECOVERY: Analyze before closing ===
          // Only analyze if feature is enabled and loss is within recoverable range
          const pipDollarValue = pos.symbol === "XAUUSD" ? 100 : pos.symbol.includes("JPY") ? 1000 : 10;
          const slDistancePips = config.stopLossPips;
          const potentialLoss = Math.abs(profit);
          const maxLoss = slDistancePips * pipDollarValue * pos.volume;
          const lossPercent = maxLoss > 0 ? (potentialLoss / maxLoss) * 100 : 100;
          
          let shouldClose = true;
          
          if (config.smartLossRecovery && lossPercent <= config.smartLossMaxLossPercent) {
            // Analyze if trade can recover
            const pair = pairs.find(p => p.symbol === pos.symbol);
            if (pair) {
              const candles = candleSeries.get(pos.symbol);
              if (candles && candles.length > 30) {
                // Analyze if market will turn in our favor
                const analysis = analyzeMarketForContinuation(candles, pos.type, tracker.stopLoss);
                
                // If analysis shows continuation in our direction with high confidence, KEEP the trade open
                if (analysis.willContinue === true && analysis.confidence >= config.smartLossRecoveryConfidence) {
                  // Move SL to breakeven and let it ride - don't close!
                  tracker.stopLoss = pos.openPrice;
                  shouldClose = false;
                  
                  addLog({
                    action: "SIGNAL",
                    symbol: pos.symbol,
                    type: pos.type,
                    price: currentPrice,
                    profit: profit,
                    reason: `🔄 LOSS RECOVERY: Analysis shows ${analysis.confidence}% confidence for recovery. Moving SL to breakeven!`,
                  });
                  toast.info(`🔄 Loss Recovery: ${pos.symbol} | Keeping trade open - ${analysis.confidence}% confidence recovery`, {
                    description: analysis.reason,
                  });
                }
              }
            }
          }
          
          if (shouldClose) {
            // LOSS - reset consecutive wins
            consecutiveWins.current = 0;
            
            addLog({ 
              action: "SL_HIT", 
              symbol: pos.symbol, 
              type: pos.type, 
              price: currentPrice, 
              profit: profit, 
              reason: `🛑 Stop Loss hit! Loss: $${profit.toFixed(2)}` 
            });
            toast.error(`🛑 SL HIT: ${pos.type} ${pos.symbol} | $${profit.toFixed(2)}`, {
              description: `Closed at ${currentPrice.toFixed(5)}`,
            });
            if (config.soundEnabled) playSLHitSound();
            riskManager.recordTradeResult(profit);
            positionTrackers.delete(pos.id);
            trailingBest.delete(pos.id);
            onClosePosition(pos.id);
            continue;
          }
        }

        // === SMART EXIT: close winners when signal flips strongly ===
        // If we're in profit and the strategy now strongly suggests the opposite direction,
        // exit early to protect gains and allow consistent re-entry.
        if (profit > 0) {
          const pair = pairs.find((p) => p.symbol === pos.symbol);
          if (pair) {
            const sig = getSignal(pair);
            const strongFlip =
              sig.signal != null &&
              sig.confidence >= config.minStrategyConfidence &&
              ((pos.type === "BUY" && sig.signal === "SELL") || (pos.type === "SELL" && sig.signal === "BUY"));
            if (strongFlip) {
              addLog({
                action: "CLOSE",
                symbol: pos.symbol,
                type: pos.type,
                price: currentPrice,
                profit,
                reason: `🔁 Exit on signal flip (${sig.confidence}%): ${sig.reason}`,
              });
              toast.success(`✅ Closed early to lock profit: ${pos.symbol} +$${profit.toFixed(2)}`);
              if (config.soundEnabled) playTPHitSound();
              riskManager.recordTradeResult(profit);
              positionTrackers.delete(pos.id);
              trailingBest.delete(pos.id);
              onClosePosition(pos.id);
              if (config.quickReentry) {
                tryOpenTrade(true);
              }
              continue;
            }
          }
        }

        // === TRAILING STOP ===
        if (config.trailingStop && profit > 0) {
          const pipValue = pos.symbol === "XAUUSD" ? 1 : pos.symbol.includes("JPY") ? 0.01 : 0.0001;
          const trailDist = config.trailingStopPips * pipValue;
          
          const bestKey = pos.id;
          const currentBest = trailingBest.get(bestKey);
          const isBuy = pos.type === "BUY";

          if (currentBest == null) {
            trailingBest.set(bestKey, currentPrice);
          } else {
            const improved = isBuy
              ? currentPrice > currentBest
              : currentPrice < currentBest;
            
            if (improved) {
              trailingBest.set(bestKey, currentPrice);
              const newSL = isBuy
                ? currentPrice - trailDist
                : currentPrice + trailDist;
              
              const shouldUpdate = isBuy 
                ? newSL > tracker.stopLoss 
                : newSL < tracker.stopLoss;
              
              if (shouldUpdate) {
                tracker.stopLoss = Math.round(newSL * 100000) / 100000;
                addLog({
                  action: "TRAILING",
                  symbol: pos.symbol,
                  type: pos.type,
                  price: currentPrice,
                  profit: profit,
                  reason: `📈 Trailing SL → ${tracker.stopLoss.toFixed(5)}`,
                });
              }
            }
          }
        }

        // === SMART CASH OUT: Close when price retraces from peak and won't reach again ===
        if (config.smartCashOut && profit > config.smartCashOutMinProfit) {
          // Update peak profit tracking
          if (profit > tracker.peakProfit) {
            tracker.peakProfit = profit;
            tracker.peakPrice = currentPrice;
          }
          
          // Check if price has retraced from peak by the configured percentage
          const retracePercent = ((tracker.peakProfit - profit) / tracker.peakProfit) * 100;
          
          if (retracePercent >= config.smartCashOutRetracePercent) {
            // Price has retraced - analyze if it can reach peak again
            const pair = pairs.find(p => p.symbol === pos.symbol);
            if (pair) {
              const candles = candleSeries.get(pos.symbol);
              if (candles && candles.length > 30) {
                // Use multiple indicators to predict continuation vs reversal
                const analysis = analyzeMarketForContinuation(candles, pos.type, tracker.peakPrice);
                
                // If analysis shows reversal is likely and confidence is high enough
                if (analysis.willContinue === false && analysis.confidence >= config.smartCashOutConfidence) {
                  // Close the trade - we won't reach the peak again
                  const lostProfit = tracker.peakProfit - profit;
                  addLog({
                    action: "CLOSE",
                    symbol: pos.symbol,
                    type: pos.type,
                    price: currentPrice,
                    profit: profit,
                    reason: `💰 SMART CASHOUT! Peak was $${tracker.peakProfit.toFixed(2)}, analysis shows reversal. Closed at $${profit.toFixed(2)} (saved $${lostProfit.toFixed(2)} from peak)`,
                  });
                  toast.success(`💰 Smart Cashout: ${pos.symbol} | Secured $${profit.toFixed(2)}`, {
                    description: analysis.reason,
                  });
                  if (config.soundEnabled) playTPHitSound();
                  riskManager.recordTradeResult(profit);
                  positionTrackers.delete(pos.id);
                  trailingBest.delete(pos.id);
                  onClosePosition(pos.id);
                  if (config.quickReentry) {
                    tryOpenTrade(true);
                  }
                  continue;
                }
              }
            }
          }
        }
      }
    }

    // === 2. CHECK RISK LIMITS ===
    const riskCheck = riskManager.canTrade(accountBalance);
    if (!riskCheck.allowed) {
      if (tickRef.current % 30 === 0) {
        addLog({ action: "RISK_BLOCK", symbol: "", type: "BUY", price: 0, reason: riskCheck.reason || 'Risk limit reached' });
        toast.warning(`⚠️ ${riskCheck.reason}`);
      }
      return;
    }

    // === 3. OPEN NEW TRADES ===
    // Check more frequently after a win
    const isRecentWin = (now - lastWinTime.current) < config.reentryCooldownMs;
    
    // After a win, check every tick for re-entry (much more aggressive)
    if (isRecentWin && config.quickReentry && positions.length < config.maxOpenTrades) {
      if (tryOpenTrade(true)) {
        return; // Found and opened a trade
      }
    }
    
    // Normal scanning - every 3rd tick
    if (tickRef.current % 3 !== 0) return;
    if (positions.length >= config.maxOpenTrades) return;
    
    tryOpenTrade(false);
  }, [config, positions, accountBalance, onClosePosition, addLog, calculateProfit, tryOpenTrade]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    localStorage.removeItem(LOG_KEY);
  }, []);

  const closePosition = useCallback((positionId: string, positions: Position[]) => {
    const position = positions.find(p => p.id === positionId);
    if (position) {
      const profit = calculateProfit(position, position.currentPrice);
      addLog({
        action: "MANUAL_CLOSE",
        symbol: position.symbol,
        type: position.type,
        price: position.currentPrice,
        profit: profit,
        reason: `Manual close | P/L: $${profit.toFixed(2)}`,
      });
      riskManager.recordTradeResult(profit);
    }
    positionTrackers.delete(positionId);
    trailingBest.delete(positionId);
    onClosePosition(positionId);
  }, [calculateProfit, addLog, onClosePosition]);

  return {
    config,
    updateConfig,
    toggleEnabled,
    tick,
    logs,
    clearLogs,
    isActive: config.enabled,
    closePosition,
  };
}
