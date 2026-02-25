import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Shield,
  BookOpen,
  ChevronRight,
  Activity,
  Zap,
  Globe,
  Cpu,
  Bot,
  Users,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { generateForexPairs, ForexPair } from "@/lib/tradingData";

const Index = () => {
  const navigate = useNavigate();
  const [pairs, setPairs] = useState<ForexPair[]>([]);

  // Live ticker update
  useEffect(() => {
    const interval = setInterval(() => {
      setPairs(generateForexPairs());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Stats (simulated)
  const stats = {
    users: 12847,
    trades: 384729,
    profit: 2847293,
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Live Ticker Tape */}
      <div className="bg-black/50 border-b border-primary/20 overflow-hidden">
        <div className="flex animate-ticker whitespace-nowrap py-2">
          {[...pairs, ...pairs].map((pair, i) => (
            <div key={`${pair.symbol}-${i}`} className="flex items-center gap-2 mx-6">
              <span className="font-bold text-sm text-foreground">{pair.symbol}</span>
              <span className="font-mono text-sm text-foreground">{pair.bid.toFixed(pair.symbol === "XAUUSD" ? 2 : pair.symbol.includes("JPY") ? 3 : 5)}</span>
              <span className={`font-mono text-xs ${pair.changePercent >= 0 ? "profit-color" : "loss-color"}`}>
                {pair.changePercent >= 0 ? "+" : ""}{pair.changePercent.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-primary/10 px-6 py-4 flex items-center justify-between bg-black/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <div>
            <span className="font-bold text-lg text-foreground">MT5 Trading Hub</span>
            <div className="flex items-center gap-1 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
              <span className="text-muted-foreground">Live</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => navigate("/education")}>
            <BookOpen className="w-4 h-4 mr-2" /> Academy
          </Button>
          <Button size="sm" onClick={() => navigate("/trading")} className="bg-primary text-black hover:bg-primary/90 font-semibold">
            <Zap className="w-4 h-4 mr-2" /> Start Trading
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px]" />
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6 }}
          className="relative z-10"
        >
          {/* Live Stats Counter */}
          <div className="flex justify-center gap-8 mb-8">
            {[
              { icon: Users, value: stats.users, label: "Total Users", color: "text-primary" },
              { icon: Activity, value: stats.trades, label: "Trades Executed", color: "text-buy" },
              { icon: DollarSign, value: stats.profit, label: "Total Profit", color: "text-profit" },
            ].map((stat, i) => (
              <motion.div 
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="glass-card px-6 py-4 rounded-xl text-center"
              >
                <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
                <div className="font-mono text-2xl font-bold text-foreground">{stat.value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-mono mb-6">
            <span className="w-2 h-2 rounded-full bg-profit animate-pulse" />
            AI-POWERED AUTO TRADING
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4 leading-tight">
            Let AI Trade Forex<br />
            <span className="text-primary text-glow-blue">For You — Connect MT5 & Go</span>
          </h1>
          
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Professional-grade auto-trading bot with real-time market analysis, 
            smart risk management, and AI-powered trade signals. Connect your MT5 account and let the bot trade for you.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate("/trading")}
              className="w-full sm:w-auto bg-primary text-black hover:bg-primary/90 gap-3 font-bold text-lg px-8 py-6 glow-blue"
            >
              <Cpu className="w-5 h-5" />
              Connect MT5 & Start
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/education")}
              className="w-full sm:w-auto gap-3 border-primary/30 text-primary hover:bg-primary/10"
            >
              <BookOpen className="w-5 h-5" />
              Learn Trading
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 border-t border-primary/10 bg-black/20">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-foreground mb-4">Platform Features</h2>
            <p className="text-muted-foreground">Everything you need for professional forex trading</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart3,
                title: "Real-Time TradingView Charts",
                desc: "Professional candlestick charts with 10+ timeframes, 50+ indicators, and real-time price updates.",
                color: "text-primary",
              },
              {
                icon: Bot,
                title: "AI Auto-Trading Bot",
                desc: "Let AI analyze markets and execute trades automatically. Multiple strategies with risk controls.",
                color: "text-buy",
              },
              {
                icon: TrendingUp,
                title: "Smart Risk Management",
                desc: "Max daily loss, drawdown protection, ATR-based position sizing, and session trading limits.",
                color: "text-profit",
              },
              {
                icon: Cpu,
                title: "AI Trade Analyzer",
                desc: "Real-time market sentiment analysis, Stochastic signals, trend detection, and trade recommendations.",
                color: "text-primary",
              },
              {
                icon: Globe,
                title: "10+ Trading Pairs",
                desc: "EURUSD, GBPUSD, USDJPY, XAUUSD, and more with live spreads and instant execution.",
                color: "text-buy",
              },
              {
                icon: Shield,
                title: "Demo & Live Accounts",
                desc: "Practice with $10,000 demo balance or connect your real MT5 account for live trading.",
                color: "text-profit",
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6 rounded-xl hover:border-primary/30 transition-all group cursor-pointer"
                onClick={() => navigate("/trading")}
              >
                <div className={`w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 border-t border-primary/10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-12 rounded-2xl border-primary/20"
          >
            <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Start?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Connect your MT5 account in seconds and let our AI bot trade forex for you. 
              Start with demo account to test the strategies.
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/trading")}
              className="bg-primary text-black hover:bg-primary/90 font-bold text-lg px-10 py-6 glow-blue"
            >
              <Zap className="w-5 h-5 mr-2" />
              Launch Trading Terminal
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/10 px-6 py-8 bg-black/30">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">MT5 Trading Hub</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            MT5 Trading Hub - Connect your MT5 account to trade forex with AI assistance.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
