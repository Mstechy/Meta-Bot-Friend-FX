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
import { detectMultiStrategySignal, type StrategyConfig as IndicatorStrategyConfig } from "@/lib/indicators";

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
};

const STORAGE_KEY = "mt5_autotrader_config";
const LOG_KEY = "mt5_autotrader_log";

// Store position SL/TP tracking
interface PositionTracker {
  stopLoss: number;
  takeProfit: number;
  initialStopLoss: number;
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
