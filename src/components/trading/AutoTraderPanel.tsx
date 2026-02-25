import { AutoTradeLog } from "@/hooks/useAutoTrader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Power, Trash2, Zap, Shield, Target, Clock, TrendingUp, Volume2, VolumeX, BarChart3, AlertTriangle, Calendar, Newspaper, Rocket, Brain, HelpCircle } from "lucide-react";

interface AutoTraderPanelProps {
  config: {
    enabled: boolean;
    riskPercent: number;
    maxOpenTrades: number;
    takeProfitPips: number;
    stopLossPips: number;
    trailingStop: boolean;
    trailingStopPips: number;
    cooldownMs: number;
    soundEnabled: boolean;
    // Quick re-entry
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
    // Smart Loss Recovery
    smartLossRecovery: boolean;
    smartLossRecoveryConfidence: number;
    smartLossMaxLossPercent: number;
    smartCashOut: boolean;
    smartCashOutMinProfit: number;
    smartCashOutRetracePercent: number;
    smartCashOutConfidence: number;
    // Manual Confirmation
    manualConfirmLoss: boolean;
    manualConfirmLossThreshold: number;
  };
  logs: AutoTradeLog[];
  isActive: boolean;
  onToggle: () => void;
  onUpdateConfig: (updates: Record<string, unknown>) => void;
  onClearLogs: () => void;
}

const AutoTraderPanel = ({ config, logs, isActive, onToggle, onUpdateConfig, onClearLogs }: AutoTraderPanelProps) => {
  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Auto-Trader</span>
          {isActive && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdateConfig({ soundEnabled: !config.soundEnabled })}
            className="text-muted-foreground hover:text-foreground"
          >
            {config.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <span className="text-[10px] font-mono text-muted-foreground">{isActive ? "LIVE" : "OFF"}</span>
          <Switch checked={isActive} onCheckedChange={onToggle} className="scale-75" />
        </div>
      </div>

      {/* Big toggle */}
      <div className="px-3 py-3">
        <Button
          onClick={onToggle}
          className={`w-full h-12 font-mono font-bold text-sm gap-2 transition-all ${
            isActive
              ? "bg-loss hover:bg-loss/90 text-white shadow-lg shadow-loss/20"
              : "bg-profit hover:bg-profit/90 text-black shadow-lg shadow-profit/20"
          }`}
        >
          <Power className="w-4 h-4" />
          {isActive ? "STOP Auto-Trading" : "START Auto-Trading"}
        </Button>
      </div>

      {/* Tabs for different settings */}
      <Tabs defaultValue="basic" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-5 mx-3">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="smart">Smart</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="log">Log</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="flex-1 overflow-y-auto m-0 p-3 space-y-2 border-t">
          {/* Quick Re-entry - Most Important! */}
          <div className="p-3 rounded-lg bg-gradient-to-r from-profit/10 to-primary/10 border border-profit/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-profit" />
                <Label className="text-xs font-semibold text-profit">Quick Re-entry</Label>
              </div>
              <Switch
                checked={config.quickReentry}
                onCheckedChange={(v) => onUpdateConfig({ quickReentry: v })}
                className="scale-75"
                disabled={isActive}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Immediately open new trade after winning! Keep the momentum going.
            </p>
            {config.quickReentry && (
              <div className="mt-2">
                <Label className="text-[9px] text-muted-foreground">Re-entry delay (sec)</Label>
                <Input 
                  type="number" 
                  value={Math.round(config.reentryCooldownMs / 1000)} 
                  onChange={(e) => onUpdateConfig({ reentryCooldownMs: (parseInt(e.target.value) || 2) * 1000 })} 
                  className="h-6 text-xs font-mono bg-background border-border" 
                  min="0" 
                  max="30" 
                  disabled={isActive} 
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Shield className="w-3 h-3" /> Risk %
              </Label>
              <Input type="number" value={config.riskPercent} onChange={(e) => onUpdateConfig({ riskPercent: parseFloat(e.target.value) || 1 })} className="h-7 text-xs font-mono bg-secondary border-border" step="0.5" min="0.5" max="5" disabled={isActive} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" /> Max Trades
              </Label>
              <Input type="number" value={config.maxOpenTrades} onChange={(e) => onUpdateConfig({ maxOpenTrades: parseInt(e.target.value) || 3 })} className="h-7 text-xs font-mono bg-secondary border-border" min="1" max="10" disabled={isActive} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Target className="w-3 h-3" /> TP (pips)
              </Label>
              <Input type="number" value={config.takeProfitPips} onChange={(e) => onUpdateConfig({ takeProfitPips: parseInt(e.target.value) || 30 })} className="h-7 text-xs font-mono bg-secondary border-border" min="5" max="200" disabled={isActive} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Shield className="w-3 h-3" /> SL (pips)
              </Label>
              <Input type="number" value={config.stopLossPips} onChange={(e) => onUpdateConfig({ stopLossPips: parseInt(e.target.value) || 20 })} className="h-7 text-xs font-mono bg-secondary border-border" min="5" max="100" disabled={isActive} />
            </div>
          </div>

          {/* Trailing Stop */}
          <div className="p-2 rounded-md bg-secondary/50 border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Trailing Stop
              </Label>
              <Switch
                checked={config.trailingStop}
                onCheckedChange={(v) => onUpdateConfig({ trailingStop: v })}
                className="scale-[0.65]"
                disabled={isActive}
              />
            </div>
            {config.trailingStop && (
              <div>
                <Label className="text-[9px] text-muted-foreground">Trail Distance (pips)</Label>
                <Input type="number" value={config.trailingStopPips} onChange={(e) => onUpdateConfig({ trailingStopPips: parseInt(e.target.value) || 15 })} className="h-6 text-[10px] font-mono bg-background border-border" min="5" max="50" disabled={isActive} />
              </div>
            )}
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Normal Cooldown (sec)
            </Label>
            <Input type="number" value={Math.round(config.cooldownMs / 1000)} onChange={(e) => onUpdateConfig({ cooldownMs: (parseInt(e.target.value) || 30) * 1000 })} className="h-7 text-xs font-mono bg-secondary border-border" min="10" max="300" disabled={isActive} />
          </div>
        </TabsContent>

        <TabsContent value="risk" className="flex-1 overflow-y-auto m-0 p-3 space-y-3 border-t">
          {/* Daily Loss Limit */}
          <div className="p-2 rounded-md bg-secondary/50 border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Max Daily Loss ($)
              </Label>
              <Switch
                checked={config.maxDailyLoss > 0}
                onCheckedChange={(v) => onUpdateConfig({ maxDailyLoss: v ? 500 : 0 })}
                className="scale-[0.65]"
                disabled={isActive}
              />
            </div>
            {config.maxDailyLoss > 0 && (
              <Input type="number" value={config.maxDailyLoss} onChange={(e) => onUpdateConfig({ maxDailyLoss: parseInt(e.target.value) || 500 })} className="h-6 text-[10px] font-mono bg-background border-border" min="100" max="5000" disabled={isActive} />
            )}
          </div>

          {/* Max Drawdown */}
          <div className="p-2 rounded-md bg-secondary/50 border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> Max Drawdown (%)
              </Label>
              <Switch
                checked={config.maxDrawdownPercent > 0}
                onCheckedChange={(v) => onUpdateConfig({ maxDrawdownPercent: v ? 10 : 0 })}
                className="scale-[0.65]"
                disabled={isActive}
              />
            </div>
            {config.maxDrawdownPercent > 0 && (
              <Input type="number" value={config.maxDrawdownPercent} onChange={(e) => onUpdateConfig({ maxDrawdownPercent: parseFloat(e.target.value) || 10 })} className="h-6 text-[10px] font-mono bg-background border-border" step="0.5" min="1" max="50" disabled={isActive} />
            )}
          </div>

          {/* Volatility Adjustment */}
          <div className="p-2 rounded-md bg-secondary/50 border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> ATR Volatility Adjustment
              </Label>
              <Switch
                checked={config.volatilityAdjustment}
                onCheckedChange={(v) => onUpdateConfig({ volatilityAdjustment: v })}
                className="scale-[0.65]"
                disabled={isActive}
              />
            </div>
            {config.volatilityAdjustment && (
              <div>
                <Label className="text-[9px] text-muted-foreground">ATR Multiplier</Label>
                <Input type="number" value={config.atrMultiplier} onChange={(e) => onUpdateConfig({ atrMultiplier: parseFloat(e.target.value) || 2 })} className="h-6 text-[10px] font-mono bg-background border-border" step="0.1" min="1" max="5" disabled={isActive} />
              </div>
            )}
          </div>

          {/* Martingale */}
          <div className="p-2 rounded-md bg-secondary/50 border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Martingale Mode
              </Label>
              <Switch
                checked={config.useMartingale}
                onCheckedChange={(v) => onUpdateConfig({ useMartingale: v })}
                className="scale-[0.65]"
                disabled={isActive}
              />
            </div>
            {config.useMartingale && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[9px] text-muted-foreground">Multiplier</Label>
                  <Input type="number" value={config.martingaleMultiplier} onChange={(e) => onUpdateConfig({ martingaleMultiplier: parseFloat(e.target.value) || 2 })} className="h-6 text-[10px] font-mono bg-background border-border" step="0.1" min="1.1" max="3" disabled={isActive} />
                </div>
                <div>
                  <Label className="text-[9px] text-muted-foreground">Max Steps</Label>
                  <Input type="number" value={config.maxMartingaleSteps} onChange={(e) => onUpdateConfig({ maxMartingaleSteps: parseInt(e.target.value) || 3 })} className="h-6 text-[10px] font-mono bg-background border-border" min="1" max="5" disabled={isActive} />
                </div>
              </div>
            )}
          </div>

          {/* Session Limits */}
          <div className="p-2 rounded-md bg-secondary/50 border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Trading Session
              </Label>
              <Switch
                checked={config.sessionLimit}
                onCheckedChange={(v) => onUpdateConfig({ sessionLimit: v })}
                className="scale-[0.65]"
                disabled={isActive}
              />
            </div>
            {config.sessionLimit && (
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[9px] text-muted-foreground">Start Hour</Label>
                    <Input type="number" value={config.sessionStartHour} onChange={(e) => onUpdateConfig({ sessionStartHour: parseInt(e.target.value) || 8 })} className="h-6 text-[10px] font-mono bg-background border-border" min="0" max="23" disabled={isActive} />
                  </div>
                  <div>
                    <Label className="text-[9px] text-muted-foreground">End Hour</Label>
                    <Input type="number" value={config.sessionEndHour} onChange={(e) => onUpdateConfig({ sessionEndHour: parseInt(e.target.value) || 20 })} className="h-6 text-[10px] font-mono bg-background border-border" min="0" max="23" disabled={isActive} />
                  </div>
                </div>
                <div>
                  <Label className="text-[9px] text-muted-foreground">Max Trades/Session</Label>
                  <Input type="number" value={config.maxTradesPerSession} onChange={(e) => onUpdateConfig({ maxTradesPerSession: parseInt(e.target.value) || 10 })} className="h-6 text-[10px] font-mono bg-background border-border" min="1" max="50" disabled={isActive} />
                </div>
              </div>
            )}
          </div>

          {/* News Filter */}
          <div className="p-2 rounded-md bg-secondary/50 border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Newspaper className="w-3 h-3" /> News Filter
              </Label>
              <Switch
                checked={config.newsFilter}
                onCheckedChange={(v) => onUpdateConfig({ newsFilter: v })}
                className="scale-[0.65]"
                disabled={isActive}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="smart" className="flex-1 overflow-y-auto m-0 p-3 space-y-3 border-t">
          {/* Smart Loss Recovery Section */}
          <div className="p-3 rounded-lg bg-gradient-to-r from-loss/10 to-primary/10 border border-loss/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-loss" />
                <Label className="text-xs font-semibold text-loss">Smart Loss Recovery</Label>
              </div>
              <Switch
                checked={config.smartLossRecovery}
                onCheckedChange={(v) => onUpdateConfig({ smartLossRecovery: v })}
                className="scale-75"
                disabled={isActive}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Analyze market before closing losing trades. Keep trades open if recovery is likely.
            </p>
            
            {config.smartLossRecovery && (
              <div className="mt-3 space-y-2">
                <div>
                  <Label className="text-[9px] text-muted-foreground">Recovery Confidence %</Label>
                  <Input 
                    type="number" 
                    value={config.smartLossRecoveryConfidence} 
                    onChange={(e) => onUpdateConfig({ smartLossRecoveryConfidence: parseInt(e.target.value) || 70 })} 
                    className="h-6 text-xs font-mono bg-background border-border" 
                    min="50" 
                    max="95" 
                    disabled={isActive} 
                  />
                </div>
                <div>
                  <Label className="text-[9px] text-muted-foreground">Max Loss % to Attempt Recovery</Label>
                  <Input 
                    type="number" 
                    value={config.smartLossMaxLossPercent} 
                    onChange={(e) => onUpdateConfig({ smartLossMaxLossPercent: parseInt(e.target.value) || 50 })} 
                    className="h-6 text-xs font-mono bg-background border-border" 
                    min="10" 
                    max="100" 
                    disabled={isActive} 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Smart Cash Out Section */}
          <div className="p-3 rounded-lg bg-gradient-to-r from-profit/10 to-primary/10 border border-profit/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-profit" />
                <Label className="text-xs font-semibold text-profit">Smart Cash Out</Label>
              </div>
              <Switch
                checked={config.smartCashOut}
                onCheckedChange={(v) => onUpdateConfig({ smartCashOut: v })}
                className="scale-75"
                disabled={isActive}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Close winning trades early if analysis shows reversal is likely.
            </p>
            
            {config.smartCashOut && (
              <div className="mt-3 space-y-2">
                <div>
                  <Label className="text-[9px] text-muted-foreground">Min Profit ($)</Label>
                  <Input 
                    type="number" 
                    value={config.smartCashOutMinProfit} 
                    onChange={(e) => onUpdateConfig({ smartCashOutMinProfit: parseInt(e.target.value) || 5 })} 
                    className="h-6 text-xs font-mono bg-background border-border" 
                    min="1" 
                    max="100" 
                    disabled={isActive} 
                  />
                </div>
                <div>
                  <Label className="text-[9px] text-muted-foreground">Retrace % from Peak</Label>
                  <Input 
                    type="number" 
                    value={config.smartCashOutRetracePercent} 
                    onChange={(e) => onUpdateConfig({ smartCashOutRetracePercent: parseInt(e.target.value) || 50 })} 
                    className="h-6 text-xs font-mono bg-background border-border" 
                    min="10" 
                    max="90" 
                    disabled={isActive} 
                  />
                </div>
                <div>
                  <Label className="text-[9px] text-muted-foreground">Confidence % to Close</Label>
                  <Input 
                    type="number" 
                    value={config.smartCashOutConfidence} 
                    onChange={(e) => onUpdateConfig({ smartCashOutConfidence: parseInt(e.target.value) || 70 })} 
                    className="h-6 text-xs font-mono bg-background border-border" 
                    min="50" 
                    max="95" 
                    disabled={isActive} 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Manual Confirmation Section */}
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-yellow-500" />
                <Label className="text-xs font-semibold text-yellow-500">Manual Confirm on Loss</Label>
              </div>
              <Switch
                checked={config.manualConfirmLoss}
                onCheckedChange={(v) => onUpdateConfig({ manualConfirmLoss: v })}
                className="scale-75"
                disabled={isActive}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Ask before closing trades in loss. Shows market analysis to help you decide.
            </p>
            
            {config.manualConfirmLoss && (
              <div className="mt-3">
                <Label className="text-[9px] text-muted-foreground">Loss Threshold ($)</Label>
                <Input 
                  type="number" 
                  value={config.manualConfirmLossThreshold} 
                  onChange={(e) => onUpdateConfig({ manualConfirmLossThreshold: parseInt(e.target.value) || 10 })} 
                  className="h-6 text-xs font-mono bg-background border-border" 
                  min="1" 
                  max="100" 
                  disabled={isActive} 
                />
                <span className="text-[9px] text-muted-foreground">Only ask for losses above this amount</span>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="strategy" className="flex-1 overflow-y-auto m-0 p-3 space-y-3 border-t">
          {/* Multi-Strategy Toggle */}
          <div className="p-2 rounded-md bg-secondary/50 border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Bot className="w-3 h-3" /> Multi-Strategy Mode
              </Label>
              <Switch
                checked={config.useMultiStrategy}
                onCheckedChange={(v) => onUpdateConfig({ useMultiStrategy: v })}
                className="scale-[0.65]"
                disabled={isActive}
              />
            </div>
            <div>
              <Label className="text-[9px] text-muted-foreground">Min Confidence (%)</Label>
              <Input type="number" value={config.minStrategyConfidence} onChange={(e) => onUpdateConfig({ minStrategyConfidence: parseInt(e.target.value) || 60 })} className="h-6 text-[10px] font-mono bg-background border-border" min="30" max="90" disabled={isActive} />
            </div>
          </div>

          {/* Strategy Options */}
          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground">Active Strategies</Label>
            
            <div className="p-2 rounded-md bg-secondary/30 border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-[10px]">Trend Following</Label>
                <Switch
                  checked={config.strategyTrend}
                  onCheckedChange={(v) => onUpdateConfig({ strategyTrend: v })}
                  className="scale-[0.65]"
                  disabled={isActive}
                />
              </div>
              <span className="text-[9px] text-muted-foreground">EMA crossover, RSI confirmation</span>
            </div>

            <div className="p-2 rounded-md bg-secondary/30 border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-[10px]">Mean Reversion</Label>
                <Switch
                  checked={config.strategyMeanReversion}
                  onCheckedChange={(v) => onUpdateConfig({ strategyMeanReversion: v })}
                  className="scale-[0.65]"
                  disabled={isActive}
                />
              </div>
              <span className="text-[9px] text-muted-foreground">Bollinger Bands, RSI oversold/overbought</span>
            </div>

            <div className="p-2 rounded-md bg-secondary/30 border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-[10px]">Breakout</Label>
                <Switch
                  checked={config.strategyBreakout}
                  onCheckedChange={(v) => onUpdateConfig({ strategyBreakout: v })}
                  className="scale-[0.65]"
                  disabled={isActive}
                />
              </div>
              <span className="text-[9px] text-muted-foreground">Price breaks recent highs/lows</span>
            </div>

            <div className="p-2 rounded-md bg-secondary/30 border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-[10px]">Momentum</Label>
                <Switch
                  checked={config.strategyMomentum}
                  onCheckedChange={(v) => onUpdateConfig({ strategyMomentum: v })}
                  className="scale-[0.65]"
                  disabled={isActive}
                />
              </div>
              <span className="text-[9px] text-muted-foreground">MACD, Stochastic, RSI alignment</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="log" className="flex-1 flex flex-col m-0 p-0 border-t min-h-0">
          {/* Activity Log */}
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Activity Log ({logs.length})</span>
            {logs.length > 0 && (
              <button onClick={onClearLogs} className="text-muted-foreground hover:text-foreground">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground p-4 text-center">
                {isActive ? (
                  <div className="space-y-2">
                    <div className="relative flex h-3 w-3 mx-auto">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                    </div>
                    <span>Scanning market for signals...</span>
                  </div>
                ) : "Enable auto-trading to start"}
              </div>
            ) : (
              <div className="space-y-0.5 p-2">
                {logs.slice().reverse().map((log) => (
                  <div
                    key={log.id}
                    className={`px-2 py-1.5 rounded text-[10px] font-mono border-l-2 ${
                      log.action === "OPEN" ? "border-l-primary bg-primary/10" :
                      log.action === "QUICK_REENTRY" ? "border-l-profit bg-profit/10" :
                      log.action === "TP_HIT" ? "border-l-profit bg-profit/10" :
                      log.action === "SL_HIT" ? "border-l-loss bg-loss/10" :
                      log.action === "TRAILING" ? "border-l-accent bg-accent/5" :
                      log.action === "RISK_BLOCK" ? "border-l-yellow-500 bg-yellow-500/5" :
                      log.action === "CLOSE" ? "border-l-muted-foreground bg-secondary/20" :
                      "border-l-accent bg-accent/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${log.type === "BUY" ? "price-up" : "price-down"}`}>
                        {log.action === "QUICK_REENTRY" ? "🚀" : log.action === "TP_HIT" ? "🎯" : log.action === "SL_HIT" ? "🛑" : ""} {log.action} {log.type} {log.symbol}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(log.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-0.5 truncate">{log.reason}</div>
                    {log.profit != null && (
                      <span className={`font-semibold ${log.profit >= 0 ? "price-up" : "price-down"}`}>
                        P/L: ${log.profit.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AutoTraderPanel;
