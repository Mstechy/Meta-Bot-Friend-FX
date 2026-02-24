/**
 * Advanced Risk Management Module
 * Provides sophisticated risk controls for the trading bot
 */

import { CandleData, ForexPair } from './tradingData';

// Risk configuration interface
export interface RiskConfig {
  // Basic risk controls
  riskPercent: number;
  maxOpenTrades: number;
  stopLossPips: number;
  takeProfitPips: number;
  
  // Advanced risk controls
  maxDailyLoss: number;        // Maximum daily loss in dollars
  maxDrawdownPercent: number;    // Maximum drawdown from peak equity
  maxCorrelationLoss: number;    // Maximum loss from correlated positions
  volatilityAdjustment: boolean;  // Use ATR for position sizing
  atrMultiplier: number;         // ATR multiplier for stop loss
  useMartingale: boolean;        // Martingale mode (increase lot after loss)
  martingaleMultiplier: number;   // Multiplier for martingale
  maxMartingaleSteps: number;    // Maximum martingale steps
  sessionLimit: boolean;         // Enable session-based limits
  sessionStartHour: number;      // Trading session start hour (0-23)
  sessionEndHour: number;        // Trading session end hour (0-23)
  maxTradesPerSession: number;   // Max trades per session
  newsFilter: boolean;           // Enable news filter
  minNewsDistance: number;       // Minimum minutes before/after news
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  riskPercent: 1,
  maxOpenTrades: 3,
  stopLossPips: 20,
  takeProfitPips: 30,
  maxDailyLoss: 500,
  maxDrawdownPercent: 10,
  maxCorrelationLoss: 200,
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
  minNewsDistance: 30,
};

// Daily statistics tracking
export interface DailyStats {
  date: string;
  trades: number;
  wins: number;
  losses: number;
  profit: number;
  peakEquity: number;
  currentEquity: number;
  sessionTrades: number;
}

class RiskManager {
  private config: RiskConfig = DEFAULT_RISK_CONFIG;
  private dailyStats: DailyStats = this.initDailyStats();
  private martingaleStep: number = 0;
  private lastTradeResult: 'win' | 'loss' | null = null;
  
  // ATR cache for volatility-adjusted sizing
  private atrCache: Map<string, number> = new Map();

  constructor() {
    this.loadDailyStats();
  }

  private initDailyStats(): DailyStats {
    const today = new Date().toISOString().split('T')[0];
    return {
      date: today,
      trades: 0,
      wins: 0,
      losses: 0,
      profit: 0,
      peakEquity: 10000,
      currentEquity: 10000,
      sessionTrades: 0,
    };
  }

  private loadDailyStats(): void {
    try {
      const saved = localStorage.getItem('mt5_daily_stats');
      if (saved) {
        const parsed = JSON.parse(saved);
        const today = new Date().toISOString().split('T')[0];
        if (parsed.date === today) {
          this.dailyStats = parsed;
        }
      }
    } catch {
      // Use default
    }
  }

  private saveDailyStats(): void {
    try {
      localStorage.setItem('mt5_daily_stats', JSON.stringify(this.dailyStats));
    } catch {
      // Ignore
    }
  }

  updateConfig(updates: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): RiskConfig {
    return { ...this.config };
  }

  /**
   * Check if trading is allowed based on risk rules
   */
  canTrade(currentEquity: number): { allowed: boolean; reason?: string } {
    // Check daily loss limit
    if (this.dailyStats.profit <= -this.config.maxDailyLoss) {
      return { allowed: false, reason: `Daily loss limit reached ($${this.config.maxDailyLoss})` };
    }

    // Check drawdown
    const drawdown = ((this.dailyStats.peakEquity - currentEquity) / this.dailyStats.peakEquity) * 100;
    if (drawdown >= this.config.maxDrawdownPercent) {
      return { allowed: false, reason: `Max drawdown reached (${drawdown.toFixed(1)}%)` };
    }

    // Check session limits
    if (this.config.sessionLimit) {
      const hour = new Date().getHours();
      if (hour < this.config.sessionStartHour || hour >= this.config.sessionEndHour) {
        return { allowed: false, reason: 'Outside trading session hours' };
      }
      if (this.dailyStats.sessionTrades >= this.config.maxTradesPerSession) {
        return { allowed: false, reason: 'Maximum trades per session reached' };
      }
    }

    // Check news filter
    if (this.config.newsFilter && this.isNewsTime()) {
      return { allowed: false, reason: 'High-impact news nearby' };
    }

    return { allowed: true };
  }

  /**
   * Calculate position size with risk management
   */
  calculateLotSize(
    accountBalance: number,
    symbol: string,
    stopLossPips: number,
    currentPrice?: number
  ): number {
    let riskAmount = accountBalance * (this.config.riskPercent / 100);

    // Apply martingale if enabled and last trade was a loss
    if (this.config.useMartingale && this.lastTradeResult === 'loss' && this.martingaleStep < this.config.maxMartingaleSteps) {
      riskAmount *= Math.pow(this.config.martingaleMultiplier, this.martingaleStep);
    }

    // Get pip dollar value
    const pipDollarValue = this.getPipDollarValue(symbol, accountBalance);
    
    // Calculate lot size
    let lotSize = riskAmount / (stopLossPips * pipDollarValue);
    
    // Apply volatility adjustment if enabled
    if (this.config.volatilityAdjustment) {
      const atr = this.atrCache.get(symbol) || this.estimateATR(symbol, currentPrice);
      if (atr > 0) {
        const volatilityStopLoss = atr * this.config.atrMultiplier;
        lotSize = riskAmount / (volatilityStopLoss * pipDollarValue);
      }
    }

    // Apply limits
    lotSize = Math.max(0.01, Math.min(lotSize, this.getMaxLotSize(symbol)));
    
    return Math.round(lotSize * 100) / 100;
  }

  /**
   * Calculate stop loss distance with ATR
   */
  calculateStopLoss(symbol: string, entryPrice: number, type: 'BUY' | 'SELL', useATR: boolean = false): number {
    const pipValue = this.getPipValue(symbol);
    let slDistance = this.config.stopLossPips * pipValue;

    if (useATR && this.config.volatilityAdjustment) {
      const atr = this.atrCache.get(symbol) || this.estimateATR(symbol, entryPrice);
      if (atr > 0) {
        slDistance = atr * this.config.atrMultiplier;
      }
    }

    return type === 'BUY' ? entryPrice - slDistance : entryPrice + slDistance;
  }

  /**
   * Calculate take profit based on risk:reward ratio
   */
  calculateTakeProfit(entryPrice: number, stopLoss: number, type: 'BUY' | 'SELL'): number {
    const riskDistance = Math.abs(entryPrice - stopLoss);
    const rewardDistance = riskDistance * (this.config.takeProfitPips / this.config.stopLossPips);
    
    return type === 'BUY' ? entryPrice + rewardDistance : entryPrice - rewardDistance;
  }

  /**
   * Record trade result for martingale tracking
   */
  recordTradeResult(profit: number): void {
    this.lastTradeResult = profit > 0 ? 'win' : 'loss';
    
    if (profit > 0) {
      this.martingaleStep = 0;
    } else if (this.config.useMartingale) {
      this.martingaleStep = Math.min(this.martingaleStep + 1, this.config.maxMartingaleSteps);
    }

    // Update daily stats
    this.dailyStats.trades++;
    if (profit > 0) {
      this.dailyStats.wins++;
    } else {
      this.dailyStats.losses++;
    }
    this.dailyStats.profit += profit;
    this.dailyStats.currentEquity += profit;
    this.dailyStats.peakEquity = Math.max(this.dailyStats.peakEquity, this.dailyStats.currentEquity);
    this.dailyStats.sessionTrades++;
    
    this.saveDailyStats();
  }

  /**
   * Update ATR for a symbol
   */
  updateATR(symbol: string, candles: CandleData[]): void {
    if (candles.length < 14) return;
    
    // Calculate True Range
    let atr = 0;
    for (let i = 1; i < candles.length; i++) {
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      );
      atr += tr;
    }
    atr /= (candles.length - 1);
    
    this.atrCache.set(symbol, atr);
  }

  /**
   * Get win rate
   */
  getWinRate(): number {
    if (this.dailyStats.trades === 0) return 0;
    return (this.dailyStats.wins / this.dailyStats.trades) * 100;
  }

  /**
   * Get profit factor
   */
  getProfitFactor(): number {
    const wins = this.dailyStats.wins;
    const losses = this.dailyStats.losses;
    if (losses === 0) return wins > 0 ? Infinity : 0;
    return wins / losses;
  }

  /**
   * Reset daily stats (call at start of new day)
   */
  resetDailyStats(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.dailyStats.date !== today) {
      this.dailyStats = this.initDailyStats();
      this.saveDailyStats();
    }
  }

  /**
   * Get current daily stats
   */
  getDailyStats(): DailyStats {
    return { ...this.dailyStats };
  }

  private getPipValue(symbol: string): number {
    if (symbol === 'XAUUSD') return 1;
    if (symbol.includes('JPY')) return 0.01;
    return 0.0001;
  }

  private getPipDollarValue(symbol: string, accountBalance: number): number {
    if (symbol === 'XAUUSD') return 100;
    if (symbol.includes('JPY')) return 1000;
    return 10 * (accountBalance / 10000);
  }

  private getMaxLotSize(symbol: string): number {
    // Default max lot size
    return symbol === 'XAUUSD' ? 10 : 100;
  }

  private estimateATR(symbol: string, price?: number): number {
    // Simple ATR estimation based on price
    const basePrice = price || 1.0;
    const volatility = symbol.includes('JPY') ? 0.5 : symbol === 'XAUUSD' ? 10 : 0.005;
    return basePrice * volatility * 0.1;
  }

  private isNewsTime(): boolean {
    // Simplified news check - in production, use actual news API
    // For now, return false (no news)
    return false;
  }
}

// Export singleton instance
export const riskManager = new RiskManager();
export default riskManager;
