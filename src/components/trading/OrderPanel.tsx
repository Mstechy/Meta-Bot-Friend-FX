import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ForexPair, Position } from "@/lib/tradingData";

interface OrderPanelProps {
  selectedPair: ForexPair | undefined;
  onPlaceOrder: (position: Position) => void;
  isDemo: boolean;
}

const OrderPanel = ({ selectedPair, onPlaceOrder, isDemo }: OrderPanelProps) => {
  const [volume, setVolume] = useState("0.01");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  if (!selectedPair) return null;

  const handleOrder = (type: "BUY" | "SELL") => {
    const price = type === "BUY" ? selectedPair.ask : selectedPair.bid;
    const position: Position = {
      id: `pos-${Date.now()}`,
      symbol: selectedPair.symbol,
      type,
      volume: parseFloat(volume),
      openPrice: price,
      currentPrice: price,
      profit: 0,
      openTime: new Date().toISOString(),
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
    };

    onPlaceOrder(position);
    toast.success(`${type} ${volume} ${selectedPair.symbol} @ ${price.toFixed(5)}`, {
      description: isDemo ? "Demo Order Executed" : "Live Order Executed",
    });
  };

  return (
    <div className="p-3 space-y-3">
      <div className="text-center">
        <h3 className="font-mono font-bold text-foreground">{selectedPair.symbol}</h3>
        <p className="text-[10px] text-muted-foreground">{selectedPair.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center font-mono">
        <div className="trading-panel p-2">
          <div className="text-[10px] text-muted-foreground">BID</div>
          <div className="text-lg font-bold price-down">
            {selectedPair.bid.toFixed(selectedPair.symbol === "XAUUSD" ? 2 : 5)}
          </div>
        </div>
        <div className="trading-panel p-2">
          <div className="text-[10px] text-muted-foreground">ASK</div>
          <div className="text-lg font-bold price-up">
            {selectedPair.ask.toFixed(selectedPair.symbol === "XAUUSD" ? 2 : 5)}
          </div>
        </div>
      </div>

      <div className="text-center text-[10px] text-muted-foreground">
        Spread: {(selectedPair.spread * (selectedPair.symbol.includes("JPY") ? 100 : 100000)).toFixed(1)} pips
      </div>

      <div className="space-y-2">
        <div>
          <Label className="text-xs text-muted-foreground">Volume (Lots)</Label>
          <Input
            type="number"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            className="h-8 font-mono text-sm bg-secondary border-border"
            step="0.01"
            min="0.01"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Stop Loss</Label>
            <Input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="Optional"
              className="h-8 font-mono text-xs bg-secondary border-border"
              step="0.00001"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Take Profit</Label>
            <Input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="Optional"
              className="h-8 font-mono text-xs bg-secondary border-border"
              step="0.00001"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => handleOrder("SELL")}
          className="bg-trading-red hover:bg-trading-red/90 text-white font-mono font-bold h-12"
        >
          <div className="text-center">
            <div className="text-xs">SELL</div>
            <div className="text-sm">{selectedPair.bid.toFixed(selectedPair.symbol === "XAUUSD" ? 2 : 5)}</div>
          </div>
        </Button>
        <Button
          onClick={() => handleOrder("BUY")}
          className="bg-trading-green hover:bg-trading-green/90 text-white font-mono font-bold h-12"
        >
          <div className="text-center">
            <div className="text-xs">BUY</div>
            <div className="text-sm">{selectedPair.ask.toFixed(selectedPair.symbol === "XAUUSD" ? 2 : 5)}</div>
          </div>
        </Button>
      </div>

      {isDemo && (
        <div className="text-center">
          <span className="text-[10px] px-2 py-0.5 rounded bg-trading-yellow/20 text-accent font-semibold">
            DEMO ACCOUNT
          </span>
        </div>
      )}
    </div>
  );
};

export default OrderPanel;
