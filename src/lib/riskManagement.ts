/**
 * Advanced Risk Management Module
 * Provides intelligent, adaptive risk controls that learn from mistakes
 * Key features:
 * - No fixed loss limits - uses adaptive sizing based on performance
 * - Learns from recent mistakes and adjusts strategy
 * - Finds best setups before entering after losses
 * - Smart cooldown to avoid revenge trading
 */

import { CandleData } from './tradingData';

// Risk configuration interface
export interface RiskConfig {
  // Basic risk controls
  riskPercent: number;
  maxOpenTrades: number;
  stopLossPips: number;
  takeProfitPips: number;
  
  // Smart Adaptive Risk Controls
  adaptiveRisk: boolean;           // Enable adaptive risk based on performance
  consecutiveLossLimit: number;     // Max consecutive losses before aggressive cooldown
  minConfidenceForTrade: number;   // Minimum signal confidence to trade
  cooldownAfterLoss: number;        // Extra cooldown ms after a loss
  increaseCooldownAfterConsecutiveLosses: boolean;
  maxCooldownAfterLoss: number;    // Maximum cooldown after losses (ms)
  useTrailingStop: boolean;        // Use trailing stop to protect profits
  trailingStopPips: number;         // Trailing stop distance in pips
  useBreakevenAfterWin: boolean;   // Move SL to breakeven after first profit
  breakevenPipsLock: number;       // Pips to lock in after reaching this profit
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  riskPercent: 1,
  maxOpenTrades: 3,
  stopLossPips: 20,
  takeProfitPips: 30,
  
  // Smart Adaptive Risk
  adaptiveRisk: true,
  consecutiveLossLimit: 3,
  minConfidenceForTrade: 65,
  cooldownAfterLoss: 5000,
  increaseCooldownAfterConsecutiveLosses: true,
  maxCooldownAfterLoss: 60000,
  useTrailingStop: true,
  trailingStopPips: 15,
  useBreakevenAfterWin: true,
  breakevenPipsLock: 10,
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
  consecutiveWins: number;
  consecutiveLosses: number;
  lastTradeOutcome: 'win' | 'loss' | null;
}

class RiskManager {
  private config: RiskConfig = DEFAULT_RISK_CONFIG;
  private dailyStats: DailyStats = this.initDailyStats();
  
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
      consecutiveWins: 0,
      consecutiveLosses: 0,
      lastTradeOutcome: null,
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
   * Get the adaptive cooldown based on recent performance
   * More losses = longer cooldown to find better setups
   */
  getAdaptiveCooldown(baseCooldown: number): number {
    if (!this.config.adaptiveRisk) return baseCooldown;
    
    const consecutiveLosses = this.dailyStats.consecutiveLosses;
    
    if (consecutiveLosses === 0) {
      return baseCooldown;
    }
    
    // Increase cooldown based on consecutive losses
    let extraCooldown = 0;
    if (this.config.increaseCooldownAfterConsecutiveLosses) {
      extraCooldown = Math.min(
        this.config.cooldownAfterLoss * consecutiveLosses,
        this.config.maxCooldownAfterLoss
      );
    }
    
    return baseCooldown + extraCooldown;
  }

  /**
   * Check if we should trade based on recent performance
   * Learn from mistakes - be more selective after losses
   */
  canTrade(currentEquity: number): { 
    allowed: boolean; 
    reason?: string; 
    suggestedConfidence?: number 
  } {
    // Always allow if we're winning
    if (this.dailyStats.lastTradeOutcome === 'win' || this.dailyStats.consecutiveWins > 0) {
      return { allowed: true };
    }

    // After losses, be more selective
    if (this.dailyStats.consecutiveLosses > 0) {
      // If we've had multiple losses, require higher confidence
      if (this.dailyStats.consecutiveLosses >= this.config.consecutiveLossLimit) {
        const suggestedConfidence = Math.min(
          this.config.minConfidenceForTrade + 15,
          95
        );
        
        return { 
          allowed: false, 
          reason: `After ${this.dailyStats.consecutiveLosses} losses - finding best setup. Need ${suggestedConfidence}% confidence`,
          suggestedConfidence 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Get minimum confidence required based on recent performance
   */
  getRequiredConfidence(): number {
    if (!this.config.adaptiveRisk) return this.config.minConfidenceForTrade;

    const consecutiveLosses = this.dailyStats.consecutiveLosses;
    
    // Increase confidence requirement after losses
    if (consecutiveLosses > 0) {
      const additionalConfidence = Math.min(consecutiveLosses * 5, 25);
      return Math.min(
        this.config.minConfidenceForTrade + additionalConfidence,
        95
      );
    }

    return this.config.minConfidenceForTrade;
  }

  /**
   * Calculate position size with smart risk management
   */
  calculateLotSize(
    accountBalance: number,
    symbol: string,
    stopLossPips: number,
    currentPrice?: number
  ): number {
    // Base risk amount
    let riskAmount = accountBalance * (this.config.riskPercent / 100);

    // After losses, reduce risk to recover smarter
    if (this.config.adaptiveRisk && this.dailyStats.consecutiveLosses > 0) {
      const lossFactor = Math.max(0.5, 1 - (this.dailyStats.consecutiveLosses * 0.15));
      riskAmount *= lossFactor;
    }

    // Get pip dollar value
    const pipDollarValue = this.getPipDollarValue(symbol, accountBalance);
    
    // Calculate lot size
    let lotSize = riskAmount / (stopLossPips * pipDollarValue);
    
    // Apply volatility adjustment if enabled
    if (this.config.useTrailingStop) {
      const atr = this.atrCache.get(symbol) || this.estimateATR(symbol, currentPrice);
      if (atr > 0) {
        const volatilityStopLoss = atr * 2;
        lotSize = riskAmount / (volatilityStopLoss * pipDollarValue);
      }
    }

    // Apply limits
    lotSize = Math.max(0.01, Math.min(lotSize, this.getMaxLotSize(symbol)));
    
    return Math.round(lotSize * 100) / 100;
  }

  /**
   * Calculate stop loss - use tighter stops after losses
   */
  calculateStopLoss(symbol: string, entryPrice: number, type: 'BUY' | 'SELL'): number {
    const pipValue = this.getPipValue(symbol);
    
    // After losses, use tighter stops to recover
    let stopLossPips = this.config.stopLossPips;
    if (this.config.adaptiveRisk && this.dailyStats.consecutiveLosses > 0) {
      stopLossPips = Math.max(10, stopLossPips - (this.dailyStats.consecutiveLosses * 2));
    }
    
    const slDistance = stopLossPips * pipValue;
    return type === 'BUY' ? entryPrice - slDistance : entryPrice + slDistance;
  }

  /**
   * Calculate take profit - use larger TP to recover after losses
   */
  calculateTakeProfit(entryPrice: number, stopLoss: number, type: 'BUY' | 'SELL'): number {
    const riskDistance = Math.abs(entryPrice - stopLoss);
    
    // After losses, aim for bigger rewards
    let riskRewardRatio = this.config.takeProfitPips / this.config.stopLossPips;
    if (this.config.adaptiveRisk && this.dailyStats.consecutiveLosses > 0) {
      riskRewardRatio = Math.min(riskRewardRatio * 1.5, 3);
    }
    
    const rewardDistance = riskDistance * riskRewardRatio;
    return type === 'BUY' ? entryPrice + rewardDistance : entryPrice - rewardDistance;
  }

  /**
   * Record trade result and learn from it
   */
  recordTradeResult(profit: number): void {
    // Update daily stats
    this.dailyStats.trades++;
    if (profit > 0) {
      this.dailyStats.wins++;
      this.dailyStats.consecutiveWins++;
      this.dailyStats.consecutiveLosses = 0;
      this.dailyStats.lastTradeOutcome = 'win';
    } else {
      this.dailyStats.losses++;
      this.dailyStats.consecutiveLosses++;
      this.dailyStats.consecutiveWins = 0;
      this.dailyStats.lastTradeOutcome = 'loss';
    }
    this.dailyStats.profit += profit;
    this.dailyStats.currentEquity += profit;
    this.dailyStats.peakEquity = Math.max(this.dailyStats.peakEquity, this.dailyStats.currentEquity);
    this.dailyStats.sessionTrades++;
    
    this.saveDailyStats();
  }

  /**
   * Check if we should move SL to breakeven
   */
  shouldMoveToBreakeven(currentProfit: number, symbol: string): boolean {
    if (!this.config.useBreakevenAfterWin) return false;
    
    const pipDollarValue = this.getPipDollarValue(symbol, 10000);
    const profitPips = currentProfit / pipDollarValue;
    
    return profitPips >= this.config.breakevenPipsLock;
  }

  /**
   * Update ATR for a symbol
   */
  updateATR(symbol: string, candles: CandleData[]): void {
    if (candles.length < 14) return;
    
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
    return symbol === 'XAUUSD' ? 10 : 100;
  }

  private estimateATR(symbol: string, price?: number): number {
    const basePrice = price || 1.0;
    const volatility = symbol.includes('JPY') ? 0.5 : symbol === 'XAUUSD' ? 10 : 0.005;
    return basePrice * volatility * 0.1;
  }
}

// Export singleton instance
export const riskManager = new RiskManager();
export default riskManager;
