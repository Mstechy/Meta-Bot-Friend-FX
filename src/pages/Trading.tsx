import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import TradingChart from "@/components/trading/TradingChart";
import MarketWatch from "@/components/trading/MarketWatch";
import OrderPanel from "@/components/trading/OrderPanel";
import PositionsPanel from "@/components/trading/PositionsPanel";
import AccountBar from "@/components/trading/AccountBar";
import AIAssistant from "@/components/trading/AIAssistant";
import AutoTraderPanel from "@/components/trading/AutoTraderPanel";
import MT5ConnectionPanel from "@/components/trading/MT5ConnectionPanel";
import { generateForexPairs, Position, AccountInfo, TradeHistory, createDemoAccount } from "@/lib/tradingData";
import mt5Connection, { MT5ConnectionState } from "@/lib/mt5Connection";
import { useAutoTrader } from "@/hooks/useAutoTrader";
import { playTradeCloseSound, playTradeOpenSound } from "@/lib/tradeSounds";
import { Button } from "@/components/ui/button";
import { Activity, BookOpen, BarChart3, List, ShoppingCart, Home, Bot, ClipboardList, Cpu, Settings, Wifi, WifiOff } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type MobileTab = "chart" | "market" | "order" | "positions" | "ai" | "auto" | "history" | "settings";

const STORAGE_KEYS = {
  positions: "mt5_positions",
  account: "mt5_account",
  journal: "mt5_trade_journal",
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

const Trading = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [selectedSymbol, setSelectedSymbol] = useState("EURUSD");
  const [positions, setPositions] = useState<Position[]>(() => loadFromStorage(STORAGE_KEYS.positions, []));
  const [account, setAccount] = useState<AccountInfo>(() => loadFromStorage(STORAGE_KEYS.account, createDemoAccount()));
  const [pairs, setPairs] = useState(generateForexPairs());
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");
  const [showAI, setShowAI] = useState(false);
  const [showAutoTrader, setShowAutoTrader] = useState(false);
  const [aiSignal, setAiSignal] = useState<{ type: "BUY" | "SELL"; symbol: string; entry: number; sl: number; tp: number } | null>(null);
  const [mt5State, setMt5State] = useState<MT5ConnectionState>(mt5Connection.getState());
  const [showMT5Dialog, setShowMT5Dialog] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");

  // Subscribe to MT5 connection state
  useEffect(() => {
    const unsubscribe = mt5Connection.subscribe((state) => {
      setMt5State(state);
      if (state.connected) {
        setConnectionStatus("connected");
        // Update account with MT5 data
        if (state.account) {
          setAccount(state.account);
        }
        if (state.pairs.length > 0) {
          setPairs(state.pairs);
        }
      } else if (state.connecting) {
        setConnectionStatus("connecting");
      } else {
        setConnectionStatus("disconnected");
      }
    });
    return () => unsubscribe();
  }, []);

  // Persist positions & account
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.positions, JSON.stringify(positions));
  }, [positions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.account, JSON.stringify(account));
  }, [account]);

  const handlePlaceOrder = useCallback((position: Position) => {
    // If MT5 API is connected, send real order as well
    if (mt5State.connected) {
      mt5Connection
        .placeOrder({
          symbol: position.symbol,
          type: position.type,
          volume: position.volume,
        })
        .then(() => {
          toast.success(`Live MT5 ${position.type} ${position.symbol} sent`);
        })
        .catch((err) => {
          console.error(err);
          toast.error("Failed to send MT5 order, using demo only");
        });
    }

    // Always keep local simulated position for UI/demo
    setPositions((prev) => [...prev, position]);
    playTradeOpenSound();
  }, [mt5State.connected]);

  const handleClosePosition = useCallback((id: string) => {
    setPositions((prev) => {
      const pos = prev.find((p) => p.id === id);
      if (pos) {
        // If this looks like a real MT5 ticket and MT5 is connected, try to close it server-side
        if (mt5State.connected && /^\d+$/.test(id)) {
          mt5Connection.closePosition(id).catch((err) => {
            console.error(err);
          });
        }

        setAccount((prevAcc) => {
          const newBal = prevAcc.balance + pos.profit;
          return { ...prevAcc, balance: newBal };
        });

        const trade: TradeHistory = {
          id: `trade-${Date.now()}`,
          symbol: pos.symbol,
          type: pos.type,
          volume: pos.volume,
          openPrice: pos.openPrice,
          closePrice: pos.currentPrice,
          profit: pos.profit,
          openTime: pos.openTime,
          closeTime: new Date().toISOString(),
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
        };
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.journal) || "[]");
        saved.push(trade);
        localStorage.setItem(STORAGE_KEYS.journal, JSON.stringify(saved));

        playTradeCloseSound();
        toast.info(`Closed ${pos.type} ${pos.symbol} | P/L: $${pos.profit.toFixed(2)}`);
      }
      return prev.filter((p) => p.id !== id);
    });
  }, [mt5State.connected]);

  const autoTrader = useAutoTrader(pairs, positions, account.balance, handlePlaceOrder, handleClosePosition);

  // Price update loop
  useEffect(() => {
    const interval = setInterval(() => {
      const newPairs = generateForexPairs();
      setPairs(newPairs);

      setPositions((prev) =>
        prev.map((pos) => {
          const pair = newPairs.find((p) => p.symbol === pos.symbol);
          if (!pair) return pos;
          const currentPrice = pos.type === "BUY" ? pair.bid : pair.ask;
          const isJPY = pos.symbol.includes("JPY");
          const isGold = pos.symbol === "XAUUSD";
          const pipValue = isGold ? 1 : isJPY ? 0.01 : 0.0001;
          const pips = pos.type === "BUY" ? (currentPrice - pos.openPrice) / pipValue : (pos.openPrice - currentPrice) / pipValue;
          const pipDollar = isGold ? 100 : isJPY ? 1000 : 10;
          const profit = pips * pos.volume * pipDollar;
          return { ...pos, currentPrice, profit: Math.round(profit * 100) / 100 };
        })
      );

      autoTrader.tick();
    }, 1500);
    return () => clearInterval(interval);
  }, [autoTrader.tick]);

  // Update account equity
  useEffect(() => {
    const totalProfit = positions.reduce((sum, p) => sum + p.profit, 0);
    const margin = positions.reduce((sum, p) => {
      const price = p.currentPrice;
      const contractSize = p.symbol === "XAUUSD" ? 100 : 100000;
      return sum + (price * p.volume * contractSize) / (account.leverage || 100);
    }, 0);
    setAccount((prev) => ({
      ...prev,
      equity: prev.balance + totalProfit,
      profit: totalProfit,
      margin: Math.round(margin * 100) / 100,
      freeMargin: Math.round((prev.balance + totalProfit - margin) * 100) / 100,
      marginLevel: margin > 0 ? Math.round(((prev.balance + totalProfit) / margin) * 10000) / 100 : 0,
    }));
  }, [positions, account.balance, account.leverage]);

  // AI signal handler
  const handleAiSignal = (signal: { type: "BUY" | "SELL"; symbol: string; entry: number; sl: number; tp: number }) => {
    setAiSignal(signal);
    setSelectedSymbol(signal.symbol);
    if (isMobile) setMobileTab("chart");
  };

  const executeAiSignal = () => {
    if (!aiSignal) return;
    const pair = pairs.find((p) => p.symbol === aiSignal.symbol);
    if (!pair) return;
    const price = aiSignal.type === "BUY" ? pair.ask : pair.bid;
    const position: Position = {
      id: `pos-${Date.now()}`,
      symbol: aiSignal.symbol,
      type: aiSignal.type,
      volume: 0.01,
      openPrice: price,
      currentPrice: price,
      profit: 0,
      openTime: new Date().toISOString(),
      stopLoss: aiSignal.sl,
      takeProfit: aiSignal.tp,
    };
    handlePlaceOrder(position);
    toast.success(`AI Signal Executed: ${aiSignal.type} ${aiSignal.symbol} @ ${price.toFixed(5)}`, {
      description: `SL: ${aiSignal.sl} | TP: ${aiSignal.tp}`,
    });
    setAiSignal(null);
  };

  const dismissAiSignal = () => setAiSignal(null);

  const selectedPair = pairs.find((p) => p.symbol === selectedSymbol);

  // Chart with position lines + AI signal overlay
  const chartWithSignal = (
    <div className="relative h-full">
      <TradingChart symbol={selectedSymbol} positions={positions} />
      {autoTrader.isActive && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/20 border border-primary/30">
          <Cpu className="w-3 h-3 text-primary animate-pulse-green" />
          <span className="text-[10px] font-mono font-semibold text-primary">AUTO-TRADING</span>
        </div>
      )}
      {aiSignal && aiSignal.symbol === selectedSymbol && (
        <div className="absolute top-14 right-3 z-20 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="trading-panel border-2 border-primary/50 p-3 shadow-lg shadow-primary/20 space-y-2 min-w-[180px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">AI Signal</span>
              </div>
              <button onClick={dismissAiSignal} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
            </div>
            <div className="text-center font-mono">
              <span className={`text-lg font-bold ${aiSignal.type === "BUY" ? "price-up" : "price-down"}`}>
                {aiSignal.type} {aiSignal.symbol}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[9px] font-mono text-center">
              <div className="bg-secondary rounded px-1 py-0.5">
                <div className="text-muted-foreground">Entry</div>
                <div className="text-foreground font-semibold">{aiSignal.entry}</div>
              </div>
              <div className="bg-secondary rounded px-1 py-0.5">
                <div className="text-muted-foreground">SL</div>
                <div className="price-down font-semibold">{aiSignal.sl}</div>
              </div>
              <div className="bg-secondary rounded px-1 py-0.5">
                <div className="text-muted-foreground">TP</div>
                <div className="price-up font-semibold">{aiSignal.tp}</div>
              </div>
            </div>
            <button
              onClick={executeAiSignal}
              className={`w-full py-2.5 rounded-md text-xs font-mono font-bold text-white transition-all active:scale-95 ${
                aiSignal.type === "BUY"
                  ? "bg-trading-green hover:bg-trading-green/90"
                  : "bg-trading-red hover:bg-trading-red/90"
              }`}
            >
              ⚡ Execute {aiSignal.type} Now
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // MT5-style Trade tab (mobile) - shows account + positions like real MT5
  const tradeView = (
    <div className="h-full flex flex-col">
      {/* Account summary like MT5 Trade tab */}
      <div className="px-4 py-3 border-b border-border">
        <div className={`text-center text-2xl font-bold font-mono mb-3 ${account.profit >= 0 ? "price-up" : "price-down"}`}>
          {account.profit >= 0 ? "+" : ""}{account.profit.toFixed(2)} {account.currency}
        </div>
        <div className="space-y-1.5 text-sm font-mono">
          {[
            { label: "Balance:", value: account.balance.toFixed(2) },
            { label: "Equity:", value: account.equity.toFixed(2) },
            { label: "Margin:", value: account.margin.toFixed(2) },
            { label: "Free Margin:", value: account.freeMargin.toFixed(2) },
            { label: "Margin Level (%):", value: account.marginLevel > 0 ? account.marginLevel.toFixed(2) : "—" },
          ].map((row) => (
            <div key={row.label} className="flex justify-between">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="text-foreground font-semibold">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Positions header */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">Positions</span>
        <span className="text-xs text-muted-foreground">•••</span>
      </div>
      {/* Position list */}
      <div className="flex-1 overflow-y-auto">
        {positions.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No open positions
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {positions.map((pos) => {
              const isGold = pos.symbol === "XAUUSD";
              const isJPY = pos.symbol.includes("JPY");
              const decimals = isGold ? 2 : isJPY ? 3 : 5;
              return (
                <button
                  key={pos.id}
                  className="w-full text-left px-4 py-3 hover:bg-secondary/30 transition-colors"
                  onClick={() => {
                    setSelectedSymbol(pos.symbol);
                    setMobileTab("chart");
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-foreground">{pos.symbol}</span>
                      <span className={`ml-2 text-xs font-semibold ${pos.type === "BUY" ? "price-up" : "price-down"}`}>
                        {pos.type.toLowerCase()} {pos.volume}
                      </span>
                    </div>
                    <span className={`text-base font-bold font-mono ${pos.profit >= 0 ? "price-up" : "price-down"}`}>
                      {pos.profit >= 0 ? "" : ""}{pos.profit.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    {pos.openPrice.toFixed(decimals)} → {pos.currentPrice.toFixed(decimals)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {/* New order button */}
      <div className="px-4 py-3 border-t border-border">
        <button
          onClick={() => setMobileTab("order")}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm"
        >
          + New Order
        </button>
      </div>
    </div>
  );

  // Mobile layout with MT5-style bottom nav
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Top bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm text-foreground">MT5 Terminal</span>
            {autoTrader.isActive && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/20 text-primary animate-pulse-green">AUTO</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {account.isDemo && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-accent/20 text-accent">DEMO</span>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMobileTab(mobileTab === "auto" ? "chart" : "auto")}>
              <Cpu className={`w-3.5 h-3.5 ${autoTrader.isActive ? "text-primary" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMobileTab(mobileTab === "ai" ? "chart" : "ai")}>
              <Bot className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {mobileTab === "chart" && (
            <div className="h-full flex flex-col">
              {/* Chart header with SELL/BUY like MT5 */}
              {selectedPair && (
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-card">
                  <button
                    className="flex-1 text-center py-1"
                    onClick={() => {
                      const price = selectedPair.bid;
                      const pos: Position = {
                        id: `pos-${Date.now()}`, symbol: selectedPair.symbol, type: "SELL", volume: 0.01,
                        openPrice: price, currentPrice: price, profit: 0, openTime: new Date().toISOString(),
                      };
                      handlePlaceOrder(pos);
                      toast.success(`SELL ${selectedPair.symbol} @ ${price}`);
                    }}
                  >
                    <div className="text-[10px] text-muted-foreground">SELL</div>
                    <div className="text-lg font-bold font-mono price-down">
                      {selectedPair.bid.toFixed(selectedPair.symbol === "XAUUSD" ? 2 : selectedPair.symbol.includes("JPY") ? 3 : 5)}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                    <span>0.01</span>
                  </div>
                  <button
                    className="flex-1 text-center py-1"
                    onClick={() => {
                      const price = selectedPair.ask;
                      const pos: Position = {
                        id: `pos-${Date.now()}`, symbol: selectedPair.symbol, type: "BUY", volume: 0.01,
                        openPrice: price, currentPrice: price, profit: 0, openTime: new Date().toISOString(),
                      };
                      handlePlaceOrder(pos);
                      toast.success(`BUY ${selectedPair.symbol} @ ${price}`);
                    }}
                  >
                    <div className="text-[10px] text-muted-foreground">BUY</div>
                    <div className="text-lg font-bold font-mono price-up">
                      {selectedPair.ask.toFixed(selectedPair.symbol === "XAUUSD" ? 2 : selectedPair.symbol.includes("JPY") ? 3 : 5)}
                    </div>
                  </button>
                </div>
              )}
              <div className="flex-1 min-h-0">
                {chartWithSignal}
              </div>
            </div>
          )}
          {mobileTab === "market" && (
            <MarketWatch onSelectSymbol={(s) => { setSelectedSymbol(s); setMobileTab("chart"); }} selectedSymbol={selectedSymbol} pairs={pairs} />
          )}
          {mobileTab === "order" && (
            <div className="overflow-y-auto h-full">
              <OrderPanel selectedPair={selectedPair} onPlaceOrder={handlePlaceOrder} isDemo={account.isDemo} />
            </div>
          )}
          {mobileTab === "positions" && tradeView}
          {mobileTab === "history" && (
            <div className="h-full">
              <Journal embedded />
            </div>
          )}
          {mobileTab === "ai" && (
            <AIAssistant pairs={pairs} account={account} positions={positions} selectedSymbol={selectedSymbol} onPlaceOrder={handlePlaceOrder} onSelectSymbol={setSelectedSymbol} onSignalToChart={handleAiSignal} />
          )}
          {mobileTab === "auto" && (
            <AutoTraderPanel config={autoTrader.config} logs={autoTrader.logs} isActive={autoTrader.isActive} onToggle={autoTrader.toggleEnabled} onUpdateConfig={autoTrader.updateConfig} onClearLogs={autoTrader.clearLogs} />
          )}
          {mobileTab === "settings" && (
            <div className="h-full overflow-y-auto">
              <SettingsEmbed account={account} />
            </div>
          )}
        </div>

        {/* MT5-style bottom nav: Quotes, Chart, Trade, History, Settings */}
        <div className="flex items-center border-t border-border bg-card">
          {([
            { id: "market" as MobileTab, icon: List, label: "Quotes" },
            { id: "chart" as MobileTab, icon: BarChart3, label: "Chart" },
            { id: "positions" as MobileTab, icon: Activity, label: "Trade" },
            { id: "history" as MobileTab, icon: ClipboardList, label: "History" },
            { id: "settings" as MobileTab, icon: Settings, label: "Settings" },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors ${
                mobileTab === tab.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

// Desktop layout
  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Activity className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">MT5 Trading Hub</span>
          </div>
          <span className="text-border">|</span>
          <span className="font-mono text-sm font-semibold text-foreground">{selectedSymbol}</span>
          {selectedPair && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="price-up">{selectedPair.bid.toFixed(selectedPair.symbol === "XAUUSD" ? 2 : selectedPair.symbol.includes("JPY") ? 3 : 5)}</span>
              <span className="text-muted-foreground">/</span>
              <span className="price-down">{selectedPair.ask.toFixed(selectedPair.symbol === "XAUUSD" ? 2 : selectedPair.symbol.includes("JPY") ? 3 : 5)}</span>
            </div>
          )}
          {autoTrader.isActive && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/20 text-primary animate-pulse-green flex items-center gap-1">
              <Cpu className="w-3 h-3" /> AUTO-TRADING
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* MT5 Connection Status Button */}
          <Dialog open={showMT5Dialog} onOpenChange={setShowMT5Dialog}>
            <DialogTrigger asChild>
              <Button
                variant={connectionStatus === "connected" ? "default" : "outline"}
                size="sm"
                className={`text-xs h-7 gap-1.5 ${
                  connectionStatus === "connected" 
                    ? "bg-profit text-black hover:bg-profit/90" 
                    : connectionStatus === "connecting"
                    ? "border-primary text-primary"
                    : "border-loss/50 text-loss hover:bg-loss/10"
                }`}
              >
                {connectionStatus === "connected" ? (
                  <><Wifi className="w-3.5 h-3.5" /> MT5 Live</>
                ) : connectionStatus === "connecting" ? (
                  <><Activity className="w-3.5 h-3.5 animate-spin" /> Connecting...</>
                ) : (
                  <><WifiOff className="w-3.5 h-3.5" /> Connect MT5</>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  MetaTrader 5 Connection
                </DialogTitle>
              </DialogHeader>
              <MT5ConnectionPanel 
                currentState={mt5State} 
                onStateChange={setMt5State} 
              />
            </DialogContent>
          </Dialog>
          <Button
            variant={showAutoTrader ? "default" : "ghost"}
            size="sm"
            className={`text-xs h-7 ${autoTrader.isActive && !showAutoTrader ? "text-primary" : ""}`}
            onClick={() => { setShowAutoTrader(!showAutoTrader); if (!showAutoTrader) setShowAI(false); }}
          >
            <Cpu className="w-3.5 h-3.5 mr-1" /> Auto
          </Button>
          <Button
            variant={showAI ? "default" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => { setShowAI(!showAI); if (!showAI) setShowAutoTrader(false); }}
          >
            <Bot className="w-3.5 h-3.5 mr-1" /> AI
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/journal")}>
            <ClipboardList className="w-3.5 h-3.5 mr-1" /> Journal
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/education")}>
            <BookOpen className="w-3.5 h-3.5 mr-1" /> Academy
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/")}>
            <Home className="w-3.5 h-3.5 mr-1" /> Home
          </Button>
        </div>
      </div>

      <AccountBar account={account} />

      <div className="flex-1 flex min-h-0">
        <div className="w-64 xl:w-72 border-r border-border flex flex-col flex-shrink-0">
          <div className="flex-1 min-h-0">
            <MarketWatch onSelectSymbol={setSelectedSymbol} selectedSymbol={selectedSymbol} pairs={pairs} />
          </div>
          <div className="border-t border-border overflow-y-auto max-h-[45%]">
            <OrderPanel selectedPair={selectedPair} onPlaceOrder={handlePlaceOrder} isDemo={account.isDemo} />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            {chartWithSignal}
          </div>
          <div className="h-48 border-t border-border flex-shrink-0">
            <PositionsPanel positions={positions} onClosePosition={handleClosePosition} />
          </div>
        </div>

        {showAutoTrader && (
          <div className="w-80 border-l border-border flex-shrink-0">
            <AutoTraderPanel config={autoTrader.config} logs={autoTrader.logs} isActive={autoTrader.isActive} onToggle={autoTrader.toggleEnabled} onUpdateConfig={autoTrader.updateConfig} onClearLogs={autoTrader.clearLogs} />
          </div>
        )}
        {showAI && (
          <div className="w-80 border-l border-border flex-shrink-0">
            <AIAssistant pairs={pairs} account={account} positions={positions} selectedSymbol={selectedSymbol} onClose={() => setShowAI(false)} onPlaceOrder={handlePlaceOrder} onSelectSymbol={setSelectedSymbol} onSignalToChart={handleAiSignal} />
          </div>
        )}
      </div>
    </div>
  );
};

// Embedded Journal for History tab
const Journal = ({ embedded }: { embedded?: boolean }) => {
  const trades: TradeHistory[] = (() => {
    try {
      const saved = localStorage.getItem("mt5_trade_journal");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  })();

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-8 text-center">
        No trade history yet. Close positions to log trades here.
      </div>
    );
  }

  // Summary row
  const deposit = 10000;
  const totalProfit = trades.reduce((s, t) => s + t.profit, 0);
  const profitLabel = totalProfit >= 0 ? "Profit" : "Loss";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-border/50">
          {trades.slice().reverse().map((trade) => {
            const isGold = trade.symbol === "XAUUSD";
            const isJPY = trade.symbol.includes("JPY");
            const decimals = isGold ? 2 : isJPY ? 3 : 5;
            return (
              <div key={trade.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-foreground">{trade.symbol}</span>
                    <span className={`ml-2 text-xs font-semibold ${trade.type === "BUY" ? "price-up" : "price-down"}`}>
                      {trade.type.toLowerCase()} {trade.volume}
                    </span>
                  </div>
                  <span className={`text-base font-bold font-mono ${trade.profit >= 0 ? "price-up" : "price-down"}`}>
                    {trade.profit >= 0 ? "" : ""}{trade.profit.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground font-mono mt-0.5">
                  <span>{trade.openPrice.toFixed(decimals)} → {trade.closePrice.toFixed(decimals)}</span>
                  <span>{new Date(trade.closeTime).toLocaleDateString()} {new Date(trade.closeTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Summary footer like MT5 */}
      <div className="px-4 py-3 border-t border-border space-y-1 text-sm font-mono">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Deposit</span>
          <span className="text-foreground">{deposit.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{profitLabel}</span>
          <span className={totalProfit >= 0 ? "price-up" : "price-down"}>
            {totalProfit.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between font-bold">
          <span className="text-muted-foreground">Balance</span>
          <span className="text-foreground">{(deposit + totalProfit).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

// Embedded Settings for Settings tab
const SettingsEmbed = ({ account }: { account: AccountInfo }) => {
  const navigate = useNavigate();
  return (
    <div className="pb-20">
      <button className="w-full p-4 border-b border-border text-center relative">
        {account.isDemo && (
          <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold bg-primary text-primary-foreground rounded">Demo</span>
        )}
        <h2 className="text-base font-bold text-foreground">{account.name}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">MetaQuotes Ltd.</p>
        <p className="text-xs text-muted-foreground">{account.accountId} - {account.server}</p>
      </button>
      {[
        { label: "Interface", desc: "English" },
        { label: "Charts", desc: "" },
        { label: "Journal", desc: "", onClick: () => navigate("/journal") },
        { label: "Leverage", desc: `1:${account.leverage}` },
        { label: "Currency", desc: account.currency },
      ].map((item) => (
        <button
          key={item.label}
          onClick={item.onClick}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-border/50 hover:bg-secondary/30"
        >
          <span className="text-sm text-foreground">{item.label}</span>
          <span className="text-xs text-muted-foreground">{item.desc}</span>
        </button>
      ))}
    </div>
  );
};

export default Trading;
