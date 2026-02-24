import { Position } from "@/lib/tradingData";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface PositionsPanelProps {
  positions: Position[];
  onClosePosition: (id: string) => void;
}

const PositionsPanel = ({ positions, onClosePosition }: PositionsPanelProps) => {
  return (
    <div className="h-full flex flex-col bg-card">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Open Positions</h3>
        <span className="text-xs font-mono text-muted-foreground">{positions.length} trades</span>
      </div>
      {positions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          No open positions
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs font-mono">
            <thead className="sticky top-0 bg-card">
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-1.5">Symbol</th>
                <th className="text-left px-2 py-1.5">Type</th>
                <th className="text-right px-2 py-1.5">Vol</th>
                <th className="text-right px-2 py-1.5">Open</th>
                <th className="text-right px-2 py-1.5">Current</th>
                <th className="text-right px-2 py-1.5">SL</th>
                <th className="text-right px-2 py-1.5">TP</th>
                <th className="text-right px-2 py-1.5">P/L</th>
                <th className="text-right px-3 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const isGold = pos.symbol === "XAUUSD";
                const isJPY = pos.symbol.includes("JPY");
                const dec = isGold ? 2 : isJPY ? 3 : 5;
                return (
                  <tr 
                    key={pos.id} 
                    className={`border-b border-border/50 hover:bg-secondary/50 transition-colors ${
                      pos.profit > 0 ? "animate-flash-green" : pos.profit < 0 ? "animate-flash-red" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-semibold">{pos.symbol}</td>
                    <td className={`px-2 py-2 font-semibold ${pos.type === "BUY" ? "buy-color" : "sell-color"}`}>
                      {pos.type.toLowerCase()}
                    </td>
                    <td className="text-right px-2 py-2">{pos.volume}</td>
                    <td className="text-right px-2 py-2">{pos.openPrice.toFixed(dec)}</td>
                    <td className="text-right px-2 py-2">{pos.currentPrice.toFixed(dec)}</td>
                    <td className="text-right px-2 py-2 loss-color">{pos.stopLoss?.toFixed(dec) ?? "—"}</td>
                    <td className="text-right px-2 py-2 profit-color">{pos.takeProfit?.toFixed(dec) ?? "—"}</td>
                    <td className={`text-right px-2 py-2 font-semibold ${pos.profit >= 0 ? "profit-color" : "loss-color"}`}>
                      {pos.profit >= 0 ? "+" : ""}{pos.profit.toFixed(2)}
                    </td>
                    <td className="text-right px-3 py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-loss"
                        onClick={() => onClosePosition(pos.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {positions.length > 0 && (
        <div className="px-3 py-2 border-t border-border flex justify-between text-xs font-mono">
          <span className="text-muted-foreground">Total P/L</span>
          <span className={`font-bold ${positions.reduce((s, p) => s + p.profit, 0) >= 0 ? "profit-color" : "loss-color"}`}>
            {positions.reduce((s, p) => s + p.profit, 0) >= 0 ? "+" : ""}${positions.reduce((s, p) => s + p.profit, 0).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

export default PositionsPanel;
