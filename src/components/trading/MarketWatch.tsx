import { useState, useEffect, useRef } from "react";
import { ForexPair } from "@/lib/tradingData";
import { TrendingUp, TrendingDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface MarketWatchProps {
  onSelectSymbol: (symbol: string) => void;
  selectedSymbol: string;
  pairs?: ForexPair[];
}

const MarketWatch = ({ onSelectSymbol, selectedSymbol, pairs: externalPairs }: MarketWatchProps) => {
  const [pairs, setPairs] = useState<ForexPair[]>(externalPairs || []);
  const [search, setSearch] = useState("");
  const prevPrices = useRef<Map<string, number>>(new Map());
  const [flashState, setFlashState] = useState<Map<string, "up" | "down">>(new Map());

  useEffect(() => {
    if (externalPairs) {
      const newFlash = new Map<string, "up" | "down">();
      for (const pair of externalPairs) {
        const prev = prevPrices.current.get(pair.symbol);
        if (prev != null && prev !== pair.bid) {
          newFlash.set(pair.symbol, pair.bid > prev ? "up" : "down");
        }
        prevPrices.current.set(pair.symbol, pair.bid);
      }
      if (newFlash.size > 0) {
        setFlashState(newFlash);
        setTimeout(() => setFlashState(new Map()), 400);
      }
      setPairs(externalPairs);
    }
  }, [externalPairs]);

  const filteredPairs = search
    ? pairs.filter((p) => p.symbol.toLowerCase().includes(search.toLowerCase()))
    : pairs;

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quotes</h3>
        <div className="flex items-center gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
          <span className="text-[9px] font-mono text-primary">LIVE</span>
        </div>
      </div>
      {/* Search */}
      <div className="px-3 py-1.5 border-b border-border">
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="enter symbol or search"
            className="h-7 text-xs pl-7 bg-secondary border-border"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredPairs.map((pair) => {
          const flash = flashState.get(pair.symbol);
          const isGold = pair.symbol === "XAUUSD";
          const isJPY = pair.symbol.includes("JPY");
          const decimals = isGold ? 2 : isJPY ? 3 : 5;
          // MT5-style: show big digits for last 2 significant digits
          const bidStr = pair.bid.toFixed(decimals);
          const askStr = pair.ask.toFixed(decimals);
          const bidBig = bidStr.slice(-2);
          const bidSmall = bidStr.slice(0, -2);
          const askBig = askStr.slice(-2);
          const askSmall = askStr.slice(0, -2);

          return (
            <div
              key={pair.symbol}
              onClick={() => onSelectSymbol(pair.symbol)}
              className={`cursor-pointer ticker-row border-b border-border/50 px-3 py-2.5 ${
                selectedSymbol === pair.symbol ? "bg-secondary" : ""
              } ${flash === "up" ? "price-flash-up" : flash === "down" ? "price-flash-down" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-mono ${pair.changePercent >= 0 ? "price-up" : "price-down"}`}>
                      {pair.changePercent >= 0 ? "+" : ""}{Math.round(pair.change * (isGold ? 100 : isJPY ? 100 : 100000))} {pair.changePercent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="font-bold text-foreground text-sm">{pair.symbol}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {pair.tickTime} ⊞ {pair.tickVolume}
                  </div>
                </div>
                <div className="flex gap-4 items-baseline">
                  {/* Bid */}
                  <div className="text-right">
                    <span className="text-xs font-mono text-foreground">{bidSmall}</span>
                    <span className="text-lg font-bold font-mono text-foreground leading-none">{bidBig}</span>
                    <div className="text-[9px] text-muted-foreground font-mono">L: {pair.low.toFixed(decimals)}</div>
                  </div>
                  {/* Ask */}
                  <div className="text-right">
                    <span className="text-xs font-mono text-foreground">{askSmall}</span>
                    <span className="text-lg font-bold font-mono text-foreground leading-none">{askBig}</span>
                    <div className="text-[9px] text-muted-foreground font-mono">H: {pair.high.toFixed(decimals)}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MarketWatch;
