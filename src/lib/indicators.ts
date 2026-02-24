/**
 * Technical Indicators Library
 * Provides various technical analysis indicators for trading strategies
 */

import { CandleData } from './tradingData';

export interface IndicatorValues {
  rsi?: number;
  macd?: MACDValues;
  bollinger?: BollingerValues;
  atr?: number;
  ema?: number;
  sma?: number;
  stochastic?: StochasticValues;
}

export interface MACDValues {
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerValues {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
}

export interface StochasticValues {
  k: number;
  d: number;
}

export type TradingStrategy = 'trend' | 'mean_reversion' | 'breakout' | 'momentum';

export interface StrategyConfig {
  name: TradingStrategy;
  enabled: boolean;
  weight: number;
  minConfidence: number;
}

// Calculate RSI (Relative Strength Index)
export function calculateRSI(candles: CandleData[], period: number = 14): number {
  if (candles.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = candles.length - period; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate EMA (Exponential Moving Average)
export function calculateEMA(candles: CandleData[], period: number): number {
  if (candles.length < period) return candles[candles.length - 1]?.close || 0;

  const multiplier = 2 / (period + 1);
  let ema = candles.slice(0, period).reduce((sum, c) => sum + c.close, 0) / period;

  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].close - ema) * multiplier + ema;
  }

  return ema;
}

// Calculate SMA (Simple Moving Average)
export function calculateSMA(candles: CandleData[], period: number): number {
  if (candles.length < period) return candles[candles.length - 1]?.close || 0;
  
  const slice = candles.slice(-period);
  return slice.reduce((sum, c) => sum + c.close, 0) / period;
}

// Calculate MACD
export function calculateMACD(
  candles: CandleData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDValues {
  if (candles.length < slowPeriod + signalPeriod) {
    return { macd: 0, signal: 0, histogram: 0 };
  }

  const fastEMA = calculateEMA(candles, fastPeriod);
  const slowEMA = calculateEMA(candles, slowPeriod);
  const macdLine = fastEMA - slowEMA;

  // Calculate signal line (simplified)
  const signalLine = macdLine * 0.9; // Simplified signal calculation

  return {
    macd: macdLine,
    signal: signalLine,
    histogram: macdLine - signalLine,
  };
}

// Calculate Bollinger Bands
export function calculateBollingerBands(
  candles: CandleData[],
  period: number = 20,
  stdDev: number = 2
): BollingerValues {
  if (candles.length < period) {
    const price = candles[candles.length - 1]?.close || 0;
    return { upper: price, middle: price, lower: price, bandwidth: 0 };
  }

  const sma = calculateSMA(candles, period);
  const slice = candles.slice(-period);
  
  // Calculate standard deviation
  const variance = slice.reduce((sum, c) => sum + Math.pow(c.close - sma, 2), 0) / period;
  const std = Math.sqrt(variance);

  const upper = sma + stdDev * std;
  const lower = sma - stdDev * std;
  const bandwidth = ((upper - lower) / sma) * 100;

  return { upper, middle: sma, lower, bandwidth };
}

// Calculate ATR (Average True Range)
export function calculateATR(candles: CandleData[], period: number = 14): number {
  if (candles.length < period + 1) return 0;

  let atr = 0;
  for (let i = 1; i <= period; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    atr += tr;
  }

  return atr / period;
}

// Calculate Stochastic Oscillator
export function calculateStochastic(
  candles: CandleData[],
  kPeriod: number = 14,
  dPeriod: number = 3
): StochasticValues {
  if (candles.length < kPeriod) {
    return { k: 50, d: 50 };
  }

  const slice = candles.slice(-kPeriod);
  const lowestLow = Math.min(...slice.map(c => c.low));
  const highestHigh = Math.max(...slice.map(c => c.high));
  const currentClose = candles[candles.length - 1].close;

  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  const d = k; // Simplified - would normally calculate SMA of K

  return { k, d };
}

// Calculate all indicators for a symbol
export function calculateAllIndicators(candles: CandleData[]): IndicatorValues {
  return {
    rsi: calculateRSI(candles),
    macd: calculateMACD(candles),
    bollinger: calculateBollingerBands(candles),
    atr: calculateATR(candles),
    ema: calculateEMA(candles, 20),
    sma: calculateSMA(candles, 20),
    stochastic: calculateStochastic(candles),
  };
}

// Strategy signal detection
export interface SignalResult {
  signal: 'BUY' | 'SELL' | 'NONE';
  confidence: number;
  strategy: TradingStrategy;
  reason: string;
}

// Trend Following Strategy
export function detectTrendSignal(candles: CandleData[]): SignalResult {
  if (candles.length < 50) {
    return { signal: 'NONE', confidence: 0, strategy: 'trend', reason: 'Insufficient data' };
  }

  const ema20 = calculateEMA(candles, 20);
  const ema50 = calculateEMA(candles, 50);
  const currentPrice = candles[candles.length - 1].close;
  const rsi = calculateRSI(candles);

  // Strong uptrend: price above both EMAs, EMA20 > EMA50, RSI between 40-70
  if (currentPrice > ema20 && ema20 > ema50 && rsi > 40 && rsi < 70) {
    return { 
      signal: 'BUY', 
      confidence: 75, 
      strategy: 'trend', 
      reason: `Uptrend: Price ${currentPrice.toFixed(5)} > EMA20 ${ema20.toFixed(5)} > EMA50 ${ema50.toFixed(5)}` 
    };
  }

  // Strong downtrend: price below both EMAs, EMA20 < EMA50, RSI between 30-60
  if (currentPrice < ema20 && ema20 < ema50 && rsi > 30 && rsi < 60) {
    return { 
      signal: 'SELL', 
      confidence: 75, 
      strategy: 'trend', 
      reason: `Downtrend: Price ${currentPrice.toFixed(5)} < EMA20 ${ema20.toFixed(5)} < EMA50 ${ema50.toFixed(5)}` 
    };
  }

  return { signal: 'NONE', confidence: 0, strategy: 'trend', reason: 'No clear trend' };
}

// Mean Reversion Strategy
export function detectMeanReversionSignal(candles: CandleData[]): SignalResult {
  if (candles.length < 20) {
    return { signal: 'NONE', confidence: 0, strategy: 'mean_reversion', reason: 'Insufficient data' };
  }

  const bollinger = calculateBollingerBands(candles);
  const currentPrice = candles[candles.length - 1].close;
  const rsi = calculateRSI(candles);

  // Buy when price touches lower band and RSI is oversold
  if (currentPrice <= bollinger.lower && rsi < 35) {
    return { 
      signal: 'BUY', 
      confidence: 70, 
      strategy: 'mean_reversion', 
      reason: `Oversold: Price at lower Bollinger band, RSI ${rsi.toFixed(1)}` 
    };
  }

  // Sell when price touches upper band and RSI is overbought
  if (currentPrice >= bollinger.upper && rsi > 65) {
    return { 
      signal: 'SELL', 
      confidence: 70, 
      strategy: 'mean_reversion', 
      reason: `Overbought: Price at upper Bollinger band, RSI ${rsi.toFixed(1)}` 
    };
  }

  return { signal: 'NONE', confidence: 0, strategy: 'mean_reversion', reason: 'No mean reversion signal' };
}

// Breakout Strategy
export function detectBreakoutSignal(candles: CandleData[]): SignalResult {
  if (candles.length < 20) {
    return { signal: 'NONE', confidence: 0, strategy: 'breakout', reason: 'Insufficient data' };
  }

  const currentCandle = candles[candles.length - 1];
  const previousCandle = candles[candles.length - 2];
  
  // Look for recent highs/lows
  // Exclude the current candle to avoid "self-referencing" breakouts.
  const lookback = candles.slice(-11, -1);
  const recentHighs = Math.max(...lookback.map(c => c.high));
  const recentLows = Math.min(...lookback.map(c => c.low));
  
  const atr = calculateATR(candles, 14);
  const breakoutThreshold = atr * 0.5;

  // Bullish breakout: price breaks above recent high with momentum
  if (currentCandle.close > recentHighs && 
      currentCandle.close - previousCandle.close > breakoutThreshold) {
    return { 
      signal: 'BUY', 
      confidence: 65, 
      strategy: 'breakout', 
      reason: `Bullish breakout above ${recentHighs.toFixed(5)}` 
    };
  }

  // Bearish breakout: price breaks below recent low with momentum
  if (currentCandle.close < recentLows && 
      previousCandle.close - currentCandle.close > breakoutThreshold) {
    return { 
      signal: 'SELL', 
      confidence: 65, 
      strategy: 'breakout', 
      reason: `Bearish breakout below ${recentLows.toFixed(5)}` 
    };
  }

  return { signal: 'NONE', confidence: 0, strategy: 'breakout', reason: 'No breakout detected' };
}

// Momentum Strategy
export function detectMomentumSignal(candles: CandleData[]): SignalResult {
  if (candles.length < 30) {
    return { signal: 'NONE', confidence: 0, strategy: 'momentum', reason: 'Insufficient data' };
  }

  const macd = calculateMACD(candles);
  const stochastic = calculateStochastic(candles);
  const rsi = calculateRSI(candles);

  // Strong bullish momentum: MACD crossing up, Stochastic not overbought, RSI trending up
  if (macd.histogram > 0 && macd.macd > macd.signal &&
      stochastic.k < 80 && rsi > 50 && rsi < 75) {
    return { 
      signal: 'BUY', 
      confidence: 70, 
      strategy: 'momentum', 
      reason: `Bullish momentum: MACD ${macd.macd.toFixed(5)}, RSI ${rsi.toFixed(1)}, Stoch ${stochastic.k.toFixed(1)}` 
    };
  }

  // Strong bearish momentum: MACD crossing down, Stochastic not oversold, RSI trending down
  if (macd.histogram < 0 && macd.macd < macd.signal &&
      stochastic.k > 20 && rsi < 50 && rsi > 25) {
    return { 
      signal: 'SELL', 
      confidence: 70, 
      strategy: 'momentum', 
      reason: `Bearish momentum: MACD ${macd.macd.toFixed(5)}, RSI ${rsi.toFixed(1)}, Stoch ${stochastic.k.toFixed(1)}` 
    };
  }

  return { signal: 'NONE', confidence: 0, strategy: 'momentum', reason: 'No momentum signal' };
}

// Combined strategy signal with multiple strategy support
export function detectMultiStrategySignal(
  candles: CandleData[],
  strategies: StrategyConfig[]
): SignalResult {
  const signals: SignalResult[] = [];

  for (const strategy of strategies) {
    if (!strategy.enabled) continue;

    let signal: SignalResult;
    switch (strategy.name) {
      case 'trend':
        signal = detectTrendSignal(candles);
        break;
      case 'mean_reversion':
        signal = detectMeanReversionSignal(candles);
        break;
      case 'breakout':
        signal = detectBreakoutSignal(candles);
        break;
      case 'momentum':
        signal = detectMomentumSignal(candles);
        break;
      default:
        continue;
    }

    if (signal.signal !== 'NONE' && signal.confidence >= strategy.minConfidence) {
      signals.push(signal);
    }
  }

  if (signals.length === 0) {
    return { signal: 'NONE', confidence: 0, strategy: 'trend', reason: 'No strategy generated signal' };
  }

  // Weight signals by confidence
  const buySignals = signals.filter(s => s.signal === 'BUY');
  const sellSignals = signals.filter(s => s.signal === 'SELL');

  if (buySignals.length > sellSignals.length) {
    const avgConfidence = buySignals.reduce((sum, s) => sum + s.confidence, 0) / buySignals.length;
    return {
      signal: 'BUY',
      confidence: avgConfidence,
      strategy: buySignals[0].strategy,
      reason: buySignals.map(s => s.reason).join(' | '),
    };
  }

  if (sellSignals.length > buySignals.length) {
    const avgConfidence = sellSignals.reduce((sum, s) => sum + s.confidence, 0) / sellSignals.length;
    return {
      signal: 'SELL',
      confidence: avgConfidence,
      strategy: sellSignals[0].strategy,
      reason: sellSignals.map(s => s.reason).join(' | '),
    };
  }

  return { signal: 'NONE', confidence: 0, strategy: 'trend', reason: 'Conflicting signals' };
}
