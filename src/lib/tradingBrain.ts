/**
 * TRADING BRAIN - Intelligent Self-Learning System
 * ================================================
 * A sophisticated trading intelligence that:
 * - Learns from every trade (win or loss)
 * - Develops its own strategies through deep analysis
 * - Stores rules and patterns to avoid mistakes
 * - Adapts and evolves based on market conditions
 * - Never repeats the same mistake twice
 */

import { CandleData } from './tradingData';

// ============================================
// CORE TYPES AND INTERFACES
// ============================================

// Trade record for learning
export interface TradeRecord {
  id: string;
  timestamp: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  lotSize: number;
  stopLoss: number;
  takeProfit: number;
  outcome: 'win' | 'loss' | 'pending';
  profit: number;
  confidence: number;
  strategy: string;
  reason: string;
  marketConditions: MarketConditions;
  indicators: Record<string, number>;
  holdingTime: number; // minutes
}

// Market conditions snapshot
export interface MarketConditions {
  trend: 'bullish' | 'bearish' | 'sideways';
  volatility: 'low' | 'medium' | 'high';
  session: 'asian' | 'london' | 'newyork' | 'overlap';
  rsi: number;
  macdSignal: 'buy' | 'sell' | 'neutral';
  atrPercent: number;
}

// Strategy definition
export interface Strategy {
  name: string;
  rules: StrategyRule[];
  performance: StrategyPerformance;
  isActive: boolean;
  createdAt: number;
  lastUsed: number;
}

// Single rule within a strategy
export interface StrategyRule {
  id: string;
  type: 'indicator' | 'pattern' | 'time' | 'condition';
  condition: string;
  operator: '>' | '<' | '=' | '>=' | '<=' | 'between';
  value: number | number[];
  description: string;
  enabled: boolean;
}

// Strategy performance tracking
export interface StrategyPerformance {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  last10Trades: ('win' | 'loss')[];
  recentProfit: number;
  overallScore: number;
}

// Learned rule from mistakes or wins
export interface LearnedRule {
  id: string;
  type: 'avoid' | 'prefer' | 'condition';
  description: string;
  pattern: string;
  successRate: number;
  sampleSize: number;
  createdAt: number;
  lastValidated: number;
  isValid: boolean;
  tags: string[];
}

// Trading decision output
export interface TradingDecision {
  action: 'buy' | 'sell' | 'wait';
  symbol: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  lotSize: number;
  confidence: number;
  strategy: string;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high';
  learnedRules: string[];
  marketAnalysis: string;
}

// ============================================
// TRADING BRAIN CLASS
// ============================================

class TradingBrain {
  // Storage
  private trades: TradeRecord[] = [];
  private strategies: Strategy[] = [];
  private learnedRules: LearnedRule[] = [];
  
  // Current state
  private currentStrategy: Strategy | null = null;
  private consecutiveLosses: number = 0;
  private consecutiveWins: number = 0;
  private lastTradeTime: number = 0;
  
  // Configuration
  private minSamplesForRule: number = 5;
  private minWinRateForStrategy: number = 40;
  private maxConsecutiveLosses: number = 3;
  
  constructor() {
    this.loadFromStorage();
    this.initializeDefaultStrategies();
  }

  // ==========================================
  // STORAGE MANAGEMENT
  // ==========================================

  private loadFromStorage(): void {
    try {
      const savedTrades = localStorage.getItem('trading_brain_trades');
      const savedRules = localStorage.getItem('trading_brain_rules');
      const savedStrategies = localStorage.getItem('trading_brain_strategies');
      
      if (savedTrades) this.trades = JSON.parse(savedTrades);
      if (savedRules) this.learnedRules = JSON.parse(savedRules);
      if (savedStrategies) this.strategies = JSON.parse(savedStrategies);
      
      // Keep only last 500 trades
      if (this.trades.length > 500) {
        this.trades = this.trades.slice(-500);
      }
    } catch (e) {
      console.error('Failed to load trading brain:', e);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('trading_brain_trades', JSON.stringify(this.trades));
      localStorage.setItem('trading_brain_rules', JSON.stringify(this.learnedRules));
      localStorage.setItem('trading_brain_strategies', JSON.stringify(this.strategies));
    } catch (e) {
      console.error('Failed to save trading brain:', e);
    }
  }

  // ==========================================
  // STRATEGY MANAGEMENT
  // ==========================================

  private initializeDefaultStrategies(): void {
    if (this.strategies.length === 0) {
      this.strategies = [
        this.createStrategy('Trend Following', [
          { id: '1', type: 'indicator', condition: 'EMA_20', operator: '>', value: [0], description: 'Price above EMA20', enabled: true },
          { id: '2', type: 'indicator', condition: 'RSI', operator: 'between', value: [30, 70], description: 'RSI in normal range', enabled: true },
          { id: '3', type: 'pattern', condition: 'trend', operator: '=', value: 1, description: 'Uptrend detected', enabled: true }
        ]),
        this.createStrategy('RSI Reversal', [
          { id: '1', type: 'indicator', condition: 'RSI', operator: '<', value: 30, description: 'RSI oversold', enabled: true },
          { id: '2', type: 'indicator', condition: 'stoch_k', operator: '<', value: 20, description: 'Stochastic oversold', enabled: true },
          { id: '3', type: 'condition', condition: 'divergence', operator: '=', value: 1, description: 'Bullish divergence', enabled: true }
        ]),
        this.createStrategy('Breakout Trading', [
          { id: '1', type: 'indicator', condition: 'atr_percent', operator: '>', value: 0.5, description: 'High volatility', enabled: true },
          { id: '2', type: 'pattern', condition: 'breakout', operator: '=', value: 1, description: 'Breakout detected', enabled: true },
          { id: '3', type: 'time', condition: 'session', operator: '=', value: [1, 2], description: 'Active session', enabled: true }
        ]),
        this.createStrategy('Smart Recovery', [
          { id: '1', type: 'condition', condition: 'after_loss', operator: '=', value: 1, description: 'Post-loss analysis', enabled: true },
          { id: '2', type: 'indicator', condition: 'confidence', operator: '>=', value: 70, description: 'High confidence', enabled: true },
          { id: '3', type: 'pattern', condition: 'reversal', operator: '=', value: 1, description: 'Reversal pattern', enabled: true }
        ])
      ];
      this.currentStrategy = this.strategies[0];
      this.saveToStorage();
    }
  }

  private createStrategy(name: string, rules: StrategyRule[]): Strategy {
    return {
      name,
      rules,
      performance: {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
        last10Trades: [],
        recentProfit: 0,
        overallScore: 50
      },
      isActive: true,
      createdAt: Date.now(),
      lastUsed: Date.now()
    };
  }

  // ==========================================
  // DEEP MARKET ANALYSIS
  // ==========================================

  /**
   * Deep analysis of market conditions before making any decision
   */
  async analyzeMarket(candles: CandleData[], symbol: string): Promise<MarketConditions> {
    if (candles.length < 50) {
      return this.getDefaultMarketConditions();
    }

    const recent = candles.slice(-20);
    const ema20 = this.calculateEMA(recent, 20);
    const ema50 = this.calculateEMA(recent, 50);
    const rsi = this.calculateRSI(recent);
    const atr = this.calculateATR(candles);
    const macd = this.calculateMACD(recent);

    // Determine trend
    let trend: 'bullish' | 'bearish' | 'sideways' = 'sideways';
    if (ema20 > ema50 * 1.001) trend = 'bullish';
    else if (ema20 < ema50 * 0.999) trend = 'bearish';

    // Determine volatility
    const currentPrice = recent[recent.length - 1].close;
    const atrPercent = (atr / currentPrice) * 100;
    let volatility: 'low' | 'medium' | 'high' = 'medium';
    if (atrPercent < 0.3) volatility = 'low';
    else if (atrPercent > 0.8) volatility = 'high';

    // Determine session
    const hour = new Date().getHours();
    let session: 'asian' | 'london' | 'newyork' | 'overlap' = 'asian';
    if (hour >= 7 && hour < 12) session = 'london';
    else if (hour >= 12 && hour < 16) session = 'overlap';
    else if (hour >= 13 && hour < 21) session = 'newyork';

    // MACD signal
    let macdSignal: 'buy' | 'sell' | 'neutral' = 'neutral';
    if (macd.macd > macd.signal && macd.histogram > 0) macdSignal = 'buy';
    else if (macd.macd < macd.signal && macd.histogram < 0) macdSignal = 'sell';

    return {
      trend,
      volatility,
      session,
      rsi,
      macdSignal,
      atrPercent
    };
  }

  /**
   * Think deeply about the trade - analyze all factors
   */
  async think(
    symbol: string,
    type: 'BUY' | 'SELL',
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
    confidence: number,
    reason: string,
    candles: CandleData[],
    indicators: Record<string, number>
  ): Promise<TradingDecision> {
    
    // 1. Analyze current market conditions
    const marketConditions = await this.analyzeMarket(candles, symbol);
    
    // 2. Check learned rules - what should we avoid?
    const avoidReasons = this.checkAvoidanceRules(symbol, type, marketConditions, indicators);
    if (avoidReasons.length > 0) {
      return {
        action: 'wait',
        symbol,
        entryPrice,
        stopLoss,
        takeProfit,
        lotSize: 0,
        confidence: 0,
        strategy: 'Safety Check',
        reason: `Avoiding: ${avoidReasons.join(', ')}`,
        riskLevel: 'high',
        learnedRules: avoidReasons,
        marketAnalysis: this.generateMarketAnalysis(marketConditions)
      };
    }

    // 3. Check preferences - what should we prefer?
    const preferences = this.checkPreferenceRules(symbol, type, marketConditions, indicators);
    
    // 4. Select best strategy based on current conditions
    const bestStrategy = this.selectBestStrategy(marketConditions, indicators);
    
    // 5. Adjust confidence based on learned factors
    const adjustedConfidence = this.adjustConfidence(
      confidence, 
      marketConditions, 
      preferences,
      bestStrategy
    );

    // 6. Calculate risk level
    const riskLevel = this.calculateRiskLevel(
      adjustedConfidence,
      marketConditions,
      bestStrategy
    );

    // 7. Make final decision
    const action = adjustedConfidence >= 60 ? (type === 'BUY' ? 'buy' : 'sell') : 'wait';
    
    return {
      action,
      symbol,
      entryPrice,
      stopLoss,
      takeProfit,
      lotSize: this.calculateAdaptiveLotSize(riskLevel),
      confidence: adjustedConfidence,
      strategy: bestStrategy.name,
      reason: `${reason}. Strategy: ${bestStrategy.name}. ${preferences.join('. ')}`,
      riskLevel,
      learnedRules: preferences,
      marketAnalysis: this.generateMarketAnalysis(marketConditions)
    };
  }

  // ==========================================
  // LEARNING FROM TRADES
  // ==========================================

  /**
   * Learn from a completed trade - this is the core learning mechanism
   */
  learnFromTrade(trade: TradeRecord): void {
    // Add to trades history
    this.trades.push(trade);
    
    // Update consecutive counters
    if (trade.outcome === 'win') {
      this.consecutiveWins++;
      this.consecutiveLosses = 0;
    } else {
      this.consecutiveLosses++;
      this.consecutiveWins = 0;
    }

    // 1. Extract patterns from the trade
    this.extractPatterns(trade);
    
    // 2. Update strategy performance
    this.updateStrategyPerformance(trade);
    
    // 3. Learn rules from the outcome
    this.learnRules(trade);
    
    // 4. Evolve strategies if needed
    this.evolveStrategies();
    
    // 5. Save to storage
    this.saveToStorage();
    
    console.log(`🧠 Trading Brain learned from ${trade.outcome} trade on ${trade.symbol}`);
    console.log(`   Total trades learned: ${this.trades.length}`);
    console.log(`   Active learned rules: ${this.learnedRules.length}`);
  }

  /**
   * Extract patterns from trade for learning
   */
  private extractPatterns(trade: TradeRecord): void {
    const { symbol, type, outcome, marketConditions, indicators, holdingTime } = trade;
    
    // Pattern 1: Symbol + Type + Outcome
    const pattern1 = `${symbol}_${type}_${outcome}`;
    this.updateLearnedRule(
      pattern1,
      'Avoid trading ' + symbol + ' ' + type + ' - losing pattern',
      outcome === 'loss' ? 'avoid' : 'prefer',
      [symbol, type, outcome]
    );

    // Pattern 2: RSI zone + Outcome
    const rsiZone = marketConditions.rsi < 30 ? 'oversold' : marketConditions.rsi > 70 ? 'overbought' : 'neutral';
    const pattern2 = `RSI_${rsiZone}_${outcome}`;
    this.updateLearnedRule(
      pattern2,
      `RSI ${rsiZone} leads to ${outcome}`,
      outcome === 'loss' ? 'avoid' : 'prefer',
      ['rsi', rsiZone, outcome]
    );

    // Pattern 3: Session + Outcome
    const pattern3 = `Session_${marketConditions.session}_${outcome}`;
    this.updateLearnedRule(
      pattern3,
      `${marketConditions.session} session ${outcome}`,
      outcome === 'loss' ? 'avoid' : 'prefer',
      ['session', marketConditions.session, outcome]
    );

    // Pattern 4: Volatility + Outcome
    const pattern4 = `Volatility_${marketConditions.volatility}_${outcome}`;
    this.updateLearnedRule(
      pattern4,
      `${marketConditions.volatility} volatility ${outcome}`,
      outcome === 'loss' ? 'avoid' : 'prefer',
      ['volatility', marketConditions.volatility, outcome]
    );

    // Pattern 5: Holding time + Outcome
    const holdingCategory = holdingTime < 15 ? 'scalp' : holdingTime < 60 ? 'short' : 'long';
    const pattern5 = `Holding_${holdingCategory}_${outcome}`;
    this.updateLearnedRule(
      pattern5,
      `${holdingCategory} trades lead to ${outcome}`,
      outcome === 'loss' ? 'avoid' : 'prefer',
      ['holding', holdingCategory, outcome]
    );
  }

  /**
   * Update or create a learned rule
   */
  private updateLearnedRule(
    pattern: string,
    description: string,
    type: 'avoid' | 'prefer' | 'condition',
    tags: string[]
  ): void {
    const existing = this.learnedRules.find(r => r.pattern === pattern);
    
    if (existing) {
      existing.sampleSize++;
      existing.lastValidated = Date.now();
      
      // Adjust success rate (simple moving average)
      const newSuccess = tags.includes('win') ? 100 : 0;
      existing.successRate = (existing.successRate * (existing.sampleSize - 1) + newSuccess) / existing.sampleSize;
      
      // Invalidate if sample size too small
      if (existing.sampleSize < this.minSamplesForRule) {
        existing.isValid = false;
      }
    } else {
      this.learnedRules.push({
        id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        description,
        pattern,
        successRate: tags.includes('win') ? 100 : 0,
        sampleSize: 1,
        createdAt: Date.now(),
        lastValidated: Date.now(),
        isValid: false,
        tags
      });
    }
  }

  /**
   * Learn more complex rules from trade analysis
   */
  private learnRules(trade: TradeRecord): void {
    if (trade.outcome === 'loss') {
      // Learn what NOT to do
      
      // Rule: Don't trade against trend
      if (trade.marketConditions.trend === 'bullish' && trade.type === 'SELL') {
        this.addLearnedRule(
          'avoid',
          'Never sell in bullish trend - fighting the trend leads to losses',
          'SELL_BULLISH_TREND',
          ['trend', 'direction', 'loss']
        );
      }
      
      if (trade.marketConditions.trend === 'bearish' && trade.type === 'BUY') {
        this.addLearnedRule(
          'avoid',
          'Never buy in bearish trend - fighting the trend leads to losses',
          'BUY_BEARISH_TREND',
          ['trend', 'direction', 'loss']
        );
      }

      // Rule: Don't trade during low volatility
      if (trade.marketConditions.volatility === 'low' && trade.outcome === 'loss') {
        this.addLearnedRule(
          'avoid',
          'Avoid trading during low volatility - price stalls',
          'LOW_VOLATILITY_LOSS',
          ['volatility', 'range', 'loss']
        );
      }

      // Rule: Don't hold too long after winning
      if (trade.profit > 0 && trade.holdingTime > 240) {
        this.addLearnedRule(
          'condition',
          'Take profit earlier - don\'t give back profits',
          'LONG_HOLD_GIVE_BACK',
          ['holding', 'greedy', 'profit']
        );
      }
    } else {
      // Learn what TO DO
      
      // Rule: Trade with trend
      if (trade.marketConditions.trend === 'bullish' && trade.type === 'BUY') {
        this.addLearnedRule(
          'prefer',
          'Buy in bullish trend - with the trend',
          'BUY_BULLISH_WIN',
          ['trend', 'direction', 'win']
        );
      }

      // Rule: Trade breakout
      if (trade.marketConditions.volatility === 'high' && trade.outcome === 'win') {
        this.addLearnedRule(
          'prefer',
          'Trade during high volatility - bigger moves',
          'HIGH_VOLATILITY_WIN',
          ['volatility', 'breakout', 'win']
        );
      }
    }
  }

  /**
   * Add a new learned rule
   */
  private addLearnedRule(
    type: 'avoid' | 'prefer' | 'condition',
    description: string,
    pattern: string,
    tags: string[]
  ): void {
    // Check if rule already exists
    const exists = this.learnedRules.find(r => r.pattern === pattern);
    if (exists) return;

    this.learnedRules.push({
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      description,
      pattern,
      successRate: 100,
      sampleSize: 1,
      createdAt: Date.now(),
      lastValidated: Date.now(),
      isValid: false,
      tags
    });
  }

  // ==========================================
  // STRATEGY EVOLUTION
  // ==========================================

  /**
   * Update strategy performance based on trade
   */
  private updateStrategyPerformance(trade: TradeRecord): void {
    const strategy = this.strategies.find(s => s.name === trade.strategy);
    if (!strategy) return;

    const perf = strategy.performance;
    perf.totalTrades++;
    
    if (trade.outcome === 'win') {
      perf.wins++;
      perf.avgWin = ((perf.avgWin * (perf.wins - 1)) + trade.profit) / perf.wins;
    } else {
      perf.losses++;
      perf.avgLoss = ((perf.avgLoss * (perf.losses - 1)) + Math.abs(trade.profit)) / perf.losses;
    }

    // Win rate
    perf.winRate = (perf.wins / perf.totalTrades) * 100;
    
    // Profit factor
    if (perf.avgLoss > 0) {
      perf.profitFactor = perf.avgWin / perf.avgLoss;
    }

    // Last 10 trades
    perf.last10Trades.push(trade.outcome);
    if (perf.last10Trades.length > 10) {
      perf.last10Trades.shift();
    }

    // Recent profit (last 10 trades)
    perf.recentProfit = perf.last10Trades.reduce((sum, t) => {
      return sum + (t === 'win' ? 1 : -1);
    }, 0);

    // Consecutive wins/losses
    if (trade.outcome === 'win') {
      perf.maxConsecutiveWins = Math.max(perf.maxConsecutiveWins, this.consecutiveWins);
    } else {
      perf.maxConsecutiveLosses = Math.max(perf.maxConsecutiveLosses, this.consecutiveLosses);
    }

    // Overall score (weighted)
    perf.overallScore = (
      (perf.winRate * 0.4) +
      (Math.min(perf.profitFactor, 3) * 20) +
      (perf.recentProfit > 0 ? 20 : 0)
    );

    strategy.lastUsed = Date.now();
  }

  /**
   * Evolve strategies based on performance
   */
  private evolveStrategies(): void {
    this.strategies.forEach(strategy => {
      const perf = strategy.performance;
      
      // If strategy is losing consistently, deactivate it
      if (perf.totalTrades >= 10 && perf.winRate < this.minWinRateForStrategy) {
        // Try to improve by adjusting rules
        if (perf.maxConsecutiveLosses >= 3) {
          strategy.isActive = false;
          console.log(`⚠️ Deactivated strategy: ${strategy.name} due to poor performance`);
        }
      }
      
      // If strategy is winning, keep it active
      if (perf.totalTrades >= 5 && perf.winRate >= 55) {
        strategy.isActive = true;
      }
    });

    // If all strategies are inactive, reactivate the best one
    const activeStrategies = this.strategies.filter(s => s.isActive);
    if (activeStrategies.length === 0) {
      const best = this.getBestStrategy();
      if (best) best.isActive = true;
    }
  }

  // ==========================================
  // DECISION MAKING
  // ==========================================

  /**
   * Check avoidance rules before trading
   */
  private checkAvoidanceRules(
    symbol: string,
    type: 'BUY' | 'SELL',
    conditions: MarketConditions,
    indicators: Record<string, number>
  ): string[] {
    const reasons: string[] = [];
    
    // Check learned avoid rules
    this.learnedRules
      .filter(r => r.type === 'avoid' && r.sampleSize >= 3 && r.successRate > 60)
      .forEach(rule => {
        // Check various patterns
        if (rule.pattern.includes(symbol) && rule.pattern.includes(type)) {
          reasons.push(rule.description);
        }
        if (rule.pattern.includes('SELL_BULLISH') && type === 'SELL' && conditions.trend === 'bullish') {
          reasons.push(rule.description);
        }
        if (rule.pattern.includes('BUY_BEARISH') && type === 'BUY' && conditions.trend === 'bearish') {
          reasons.push(rule.description);
        }
        if (rule.pattern.includes('LOW_VOLATILITY') && conditions.volatility === 'low') {
          reasons.push(rule.description);
        }
      });

    // Check consecutive losses - be more careful
    if (this.consecutiveLosses >= this.maxConsecutiveLosses) {
      reasons.push(`After ${this.consecutiveLosses} losses - being extra cautious`);
    }

    // Check recent losses on this symbol
    const recentSymbolLosses = this.trades
      .filter(t => t.symbol === symbol && t.outcome === 'loss' && Date.now() - t.timestamp < 3600000)
      .length;
    
    if (recentSymbolLosses >= 2) {
      reasons.push(`${symbol} has lost ${recentSymbolLosses} times in last hour - avoiding`);
    }

    return reasons;
  }

  /**
   * Check preference rules
   */
  private checkPreferenceRules(
    symbol: string,
    type: 'BUY' | 'SELL',
    conditions: MarketConditions,
    indicators: Record<string, number>
  ): string[] {
    const preferences: string[] = [];
    
    // Check learned preference rules
    this.learnedRules
      .filter(r => r.type === 'prefer' && r.sampleSize >= 3 && r.successRate > 60)
      .forEach(rule => {
        if (rule.pattern.includes(symbol) && rule.pattern.includes(type)) {
          preferences.push(rule.description);
        }
        if (rule.pattern.includes('BUY_BULLISH') && type === 'BUY' && conditions.trend === 'bullish') {
          preferences.push('With the trend');
        }
        if (rule.pattern.includes('HIGH_VOLATILITY') && conditions.volatility === 'high') {
          preferences.push('High volatility breakout');
        }
      });

    return preferences;
  }

  /**
   * Select best strategy for current conditions
   */
  private selectBestStrategy(conditions: MarketConditions, indicators: Record<string, number>): Strategy {
    // Get active strategies
    const active = this.strategies.filter(s => s.isActive);
    
    if (active.length === 0) {
      return this.strategies[0];
    }

    // Score each strategy based on current conditions
    const scored = active.map(strategy => {
      let score = strategy.performance.overallScore;
      
      // Bonus for matching market conditions
      if (strategy.name === 'Trend Following' && conditions.trend !== 'sideways') {
        score += 10;
      }
      if (strategy.name === 'RSI Reversal' && (conditions.rsi < 30 || conditions.rsi > 70)) {
        score += 15;
      }
      if (strategy.name === 'Breakout Trading' && conditions.volatility === 'high') {
        score += 15;
      }
      if (strategy.name === 'Smart Recovery' && this.consecutiveLosses > 0) {
        score += 20;
      }
      
      return { strategy, score };
    });

    // Sort by score and return best
    scored.sort((a, b) => b.score - a.score);
    return scored[0].strategy;
  }

  /**
   * Adjust confidence based on learned factors
   */
  private adjustConfidence(
    baseConfidence: number,
    conditions: MarketConditions,
    preferences: string[],
    strategy: Strategy
  ): number {
    let adjusted = baseConfidence;

    // Boost for preferences
    adjusted += preferences.length * 3;

    // Boost for good strategy performance
    if (strategy.performance.winRate > 60) {
      adjusted += 5;
    }

    // Reduce for bad conditions
    if (conditions.volatility === 'low') adjusted -= 10;
    if (conditions.trend === 'sideways') adjusted -= 5;

    // Reduce after consecutive losses
    if (this.consecutiveLosses >= 2) {
      adjusted -= this.consecutiveLosses * 5;
    }

    // Cap confidence
    return Math.max(0, Math.min(100, adjusted));
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(
    confidence: number,
    conditions: MarketConditions,
    strategy: Strategy
  ): 'low' | 'medium' | 'high' {
    if (confidence >= 70 && conditions.volatility !== 'high') {
      return 'low';
    } else if (confidence >= 50) {
      return 'medium';
    }
    return 'high';
  }

  /**
   * Calculate adaptive lot size based on risk
   */
  private calculateAdaptiveLotSize(riskLevel: 'low' | 'medium' | 'high'): number {
    const base = 0.1;
    switch (riskLevel) {
      case 'low': return base * 1.2;
      case 'medium': return base;
      case 'high': return base * 0.5;
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private getDefaultMarketConditions(): MarketConditions {
    return {
      trend: 'sideways',
      volatility: 'medium',
      session: 'asian',
      rsi: 50,
      macdSignal: 'neutral',
      atrPercent: 0.5
    };
  }

  private generateMarketAnalysis(conditions: MarketConditions): string {
    return `Trend: ${conditions.trend.toUpperCase()} | Volatility: ${conditions.volatility.toUpperCase()} | Session: ${conditions.session.toUpperCase()} | RSI: ${conditions.rsi.toFixed(1)}`;
  }

  getBestStrategy(): Strategy | null {
    if (this.strategies.length === 0) return null;
    return this.strategies.reduce((best, s) => 
      s.performance.overallScore > best.performance.overallScore ? s : best
    );
  }

  getActiveStrategies(): Strategy[] {
    return this.strategies.filter(s => s.isActive);
  }

  getLearnedRules(): LearnedRule[] {
    return this.learnedRules.filter(r => r.sampleSize >= 3);
  }

  getPerformanceStats(): {
    totalTrades: number;
    winRate: number;
    activeRules: number;
    strategies: { name: string; winRate: number; isActive: boolean }[];
  } {
    const completedTrades = this.trades.filter(t => t.outcome !== 'pending');
    const wins = completedTrades.filter(t => t.outcome === 'win').length;
    return {
      totalTrades: this.trades.length,
      winRate: completedTrades.length > 0 ? (wins / completedTrades.length) * 100 : 0,
      activeRules: this.learnedRules.filter(r => r.sampleSize >= 3).length,
      strategies: this.strategies.map(s => ({
        name: s.name,
        winRate: s.performance.winRate,
        isActive: s.isActive
      }))
    };
  }

  // Technical indicators calculation
  private calculateEMA(candles: CandleData[], period: number): number {
    if (candles.length < period) return candles[candles.length - 1]?.close || 0;
    
    const multiplier = 2 / (period + 1);
    let ema = candles[0].close;
    
    for (let i = 1; i < candles.length; i++) {
      ema = (candles[i].close - ema) * multiplier + ema;
    }
    
    return ema;
  }

  private calculateRSI(candles: CandleData[], period: number = 14): number {
    if (candles.length < period + 1) return 50;
    
    let gains = 0, losses = 0;
    
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

  private calculateATR(candles: CandleData[], period: number = 14): number {
    if (candles.length < period + 1) return 0;
    
    let atr = 0;
    for (let i = 1; i < candles.length; i++) {
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      );
      atr += tr;
    }
    
    return atr / period;
  }

  private calculateMACD(candles: CandleData[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(candles, 12);
    const ema26 = this.calculateEMA(candles, 26);
    const macd = ema12 - ema26;
    const signal = macd * 0.9; // Simplified
    
    return {
      macd,
      signal,
      histogram: macd - signal
    };
  }

  /**
   * Get cooldown time based on recent performance
   */
  getCooldownTime(): number {
    const baseCooldown = 5000; // 5 seconds
    
    // Increase cooldown after losses
    if (this.consecutiveLosses > 0) {
      return baseCooldown + (this.consecutiveLosses * 15000); // +15s per loss
    }
    
    return baseCooldown;
  }

  /**
   * Check if we should take a break
   */
  shouldTakeBreak(): boolean {
    // If we've had too many consecutive losses, suggest a break
    if (this.consecutiveLosses >= 5) {
      return true;
    }
    
    // Check recent performance
    const recent = this.trades.slice(-10);
    if (recent.length >= 10) {
      const recentLosses = recent.filter(t => t.outcome === 'loss').length;
      if (recentLosses >= 8) {
        return true;
      }
    }
    
    return false;
  }
}

// Export singleton
export const tradingBrain = new TradingBrain();
export default tradingBrain;
