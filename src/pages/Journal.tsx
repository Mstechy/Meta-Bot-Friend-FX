import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft, Activity, TrendingUp, TrendingDown, BarChart3, Target, Shield, Trash2 } from "lucide-react";
import { TradeHistory } from "@/lib/tradingData";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const Journal = () => {
  const navigate = useNavigate();
  const [trades, setTrades] = useState<TradeHistory[]>(() => {
    const saved = localStorage.getItem("mt5_trade_journal");
    return saved ? JSON.parse(saved) : [];
  });

  const stats = useMemo(() => {
    if (trades.length === 0) return null;
    const wins = trades.filter((t) => t.profit > 0);
    const losses = trades.filter((t) => t.profit <= 0);
    const totalProfit = trades.reduce((s, t) => s + t.profit, 0);
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.profit, 0) / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.profit, 0) / losses.length) : 0;
    const rrRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
    const bestTrade = trades.reduce((best, t) => (t.profit > best.profit ? t : best), trades[0]);
    const worstTrade = trades.reduce((worst, t) => (t.profit < worst.profit ? t : worst), trades[0]);

    return {
      total: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: ((wins.length / trades.length) * 100).toFixed(1),
      totalProfit: totalProfit.toFixed(2),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      rrRatio: rrRatio.toFixed(2),
      bestTrade: bestTrade.profit.toFixed(2),
      worstTrade: worstTrade.profit.toFixed(2),
      profitFactor: avgLoss > 0 ? ((wins.reduce((s, t) => s + t.profit, 0)) / Math.abs(losses.reduce((s, t) => s + t.profit, 0))).toFixed(2) : "∞",
    };
  }, [trades]);

  // Equity curve data
  const equityCurve = useMemo(() => {
    if (trades.length === 0) return [];
    let cumulative = 10000; // starting balance
    return trades.map((t, i) => {
      cumulative += t.profit;
      return {
        trade: i + 1,
        equity: Math.round(cumulative * 100) / 100,
        profit: t.profit,
        date: new Date(t.closeTime).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        symbol: t.symbol,
      };
    });
  }, [trades]);

  const clearJournal = () => {
    localStorage.removeItem("mt5_trade_journal");
    setTrades([]);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 md:px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/trading")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base md:text-xl font-bold text-foreground">Trade Journal</h1>
          <p className="text-xs text-muted-foreground">Performance analytics & trade history</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate("/trading")}>
            <Activity className="w-3.5 h-3.5 mr-1" /> Trade
          </Button>
          {trades.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={clearJournal}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {trades.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No Trades Yet</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Close positions in the trading terminal to log them here.
            </p>
            <Button onClick={() => navigate("/trading")}>
              <Activity className="w-4 h-4 mr-2" /> Start Trading
            </Button>
          </motion.div>
        ) : (
          <>
            {/* Stats Grid */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Total Trades", value: stats.total, icon: BarChart3 },
                  { label: "Win Rate", value: `${stats.winRate}%`, icon: Target, color: parseFloat(stats.winRate) >= 50 ? "price-up" : "price-down" },
                  { label: "Total P/L", value: `$${stats.totalProfit}`, icon: TrendingUp, color: parseFloat(stats.totalProfit) >= 0 ? "price-up" : "price-down" },
                  { label: "R:R Ratio", value: stats.rrRatio, icon: Shield },
                  { label: "Best Trade", value: `$${stats.bestTrade}`, icon: TrendingUp, color: "price-up" },
                  { label: "Worst Trade", value: `$${stats.worstTrade}`, icon: TrendingDown, color: "price-down" },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="trading-panel p-3"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <stat.icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground uppercase">{stat.label}</span>
                    </div>
                    <span className={`text-lg font-bold font-mono ${stat.color || "text-foreground"}`}>{stat.value}</span>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Equity Curve */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="trading-panel p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Equity Curve
                </h3>
                <span className="text-xs font-mono text-foreground">
                  ${equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity.toFixed(2) : "10,000.00"}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={equityCurve} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
                  <XAxis
                    dataKey="trade"
                    tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }}
                    axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
                    tickLine={false}
                    label={{ value: "Trade #", position: "insideBottom", offset: -2, fontSize: 9, fill: "hsl(215, 15%, 55%)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }}
                    axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
                    tickLine={false}
                    domain={["dataMin - 50", "dataMax + 50"]}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(220, 18%, 10%)",
                      border: "1px solid hsl(220, 14%, 18%)",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    labelFormatter={(label) => `Trade #${label}`}
                    formatter={(value: number, name: string) => {
                      if (name === "equity") return [`$${value.toFixed(2)}`, "Equity"];
                      return [value, name];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="equity"
                    stroke="hsl(142, 71%, 45%)"
                    strokeWidth={2}
                    fill="url(#equityGradient)"
                    dot={{ r: 3, fill: "hsl(142, 71%, 45%)", stroke: "hsl(220, 18%, 10%)", strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: "hsl(142, 71%, 45%)", stroke: "hsl(220, 18%, 10%)", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Win/Loss Bar */}
            {stats && (
              <div className="trading-panel p-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="price-up font-semibold">{stats.wins} Wins</span>
                  <span className="text-muted-foreground">Profit Factor: {stats.profitFactor}</span>
                  <span className="price-down font-semibold">{stats.losses} Losses</span>
                </div>
                <div className="h-3 rounded-full bg-secondary overflow-hidden flex">
                  <div
                    className="h-full rounded-l-full transition-all"
                    style={{
                      width: `${stats.winRate}%`,
                      backgroundColor: "hsl(142, 71%, 45%)",
                    }}
                  />
                  <div
                    className="h-full rounded-r-full transition-all"
                    style={{
                      width: `${100 - parseFloat(stats.winRate)}%`,
                      backgroundColor: "hsl(0, 72%, 51%)",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Trade History Table */}
            <div className="trading-panel overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase">Trade History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="bg-secondary/50">
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-2 py-2">Symbol</th>
                      <th className="text-left px-2 py-2">Type</th>
                      <th className="text-right px-2 py-2">Vol</th>
                      <th className="text-right px-2 py-2">Open</th>
                      <th className="text-right px-2 py-2">Close</th>
                      <th className="text-right px-3 py-2">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.slice().reverse().map((trade) => (
                      <tr key={trade.id} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(trade.closeTime).toLocaleDateString()} {new Date(trade.closeTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-2 py-2 font-semibold text-foreground">{trade.symbol}</td>
                        <td className={`px-2 py-2 ${trade.type === "BUY" ? "price-up" : "price-down"}`}>{trade.type}</td>
                        <td className="text-right px-2 py-2">{trade.volume}</td>
                        <td className="text-right px-2 py-2">{trade.openPrice.toFixed(5)}</td>
                        <td className="text-right px-2 py-2">{trade.closePrice.toFixed(5)}</td>
                        <td className={`text-right px-3 py-2 font-semibold ${trade.profit >= 0 ? "price-up" : "price-down"}`}>
                          ${trade.profit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Journal;
