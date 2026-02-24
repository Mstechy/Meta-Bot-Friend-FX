import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, X, Loader2, TrendingUp, Shield, Brain, AlertTriangle, BarChart3 } from "lucide-react";
import { streamChat } from "@/lib/aiChat";
import { ForexPair, AccountInfo, Position } from "@/lib/tradingData";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

interface AIAssistantProps {
  pairs: ForexPair[];
  account: AccountInfo;
  positions: Position[];
  selectedSymbol: string;
  onClose?: () => void;
  onPlaceOrder?: (position: Position) => void;
  onSelectSymbol?: (symbol: string) => void;
  onSignalToChart?: (signal: { type: "BUY" | "SELL"; symbol: string; entry: number; sl: number; tp: number }) => void;
}

const QUICK_PROMPTS = [
  { icon: TrendingUp, label: "Signal", prompt: "Give me a trade signal for the current pair with entry, SL, TP levels. Include action tag." },
  { icon: Shield, label: "Risk", prompt: "Analyze my current positions and tell me my risk exposure honestly" },
  { icon: Brain, label: "Analysis", prompt: "Do a deep technical analysis of the current pair - support/resistance, trend, key levels" },
  { icon: AlertTriangle, label: "Discipline", prompt: "Review my trading today - am I overtrading? What should I do next?" },
];

/** Parse AI response for actionable trade signals like [BUY EURUSD 1.0850 SL:1.0800 TP:1.0920] */
function parseTradeActions(content: string) {
  const pattern = /\[(BUY|SELL)\s+(\w+)\s+([\d.]+)\s+SL:([\d.]+)\s+TP:([\d.]+)\]/gi;
  const actions: { type: "BUY" | "SELL"; symbol: string; price: number; sl: number; tp: number }[] = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    actions.push({
      type: match[1].toUpperCase() as "BUY" | "SELL",
      symbol: match[2].toUpperCase(),
      price: parseFloat(match[3]),
      sl: parseFloat(match[4]),
      tp: parseFloat(match[5]),
    });
  }
  return actions;
}

const AIAssistant = ({ pairs, account, positions, selectedSymbol, onClose, onPlaceOrder, onSelectSymbol, onSignalToChart }: AIAssistantProps) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const getContext = () => ({
    selectedSymbol,
    currentPair: pairs.find((p) => p.symbol === selectedSymbol),
    account: { balance: account.balance, equity: account.equity, profit: account.profit, freeMargin: account.freeMargin },
    openPositions: positions.map((p) => ({
      symbol: p.symbol, type: p.type, volume: p.volume, openPrice: p.openPrice, currentPrice: p.currentPrice, profit: p.profit,
    })),
    allPairs: pairs.map((p) => ({ symbol: p.symbol, bid: p.bid, ask: p.ask, change: p.changePercent })),
  });

  const sendToChart = (action: { type: "BUY" | "SELL"; symbol: string; price: number; sl: number; tp: number }) => {
    if (onSignalToChart) {
      onSignalToChart({ type: action.type, symbol: action.symbol, entry: action.price, sl: action.sl, tp: action.tp });
      toast.success(`Signal sent to chart! Check ${action.symbol} chart to execute.`);
    }
  };

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    await streamChat({
      messages: [...messages, userMsg],
      context: getContext(),
      onDelta: upsertAssistant,
      onDone: () => setIsLoading(false),
      onError: (err) => {
        toast.error(err);
        setIsLoading(false);
      },
    });
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">AI Trading Assistant</span>
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-green" />
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center py-2">
              AI-powered signals appear directly on your chart. Tap to execute instantly.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => send(qp.prompt)}
                  className="trading-panel p-2 text-left hover:border-primary/30 transition-colors"
                >
                  <qp.icon className="w-3.5 h-3.5 text-primary mb-1" />
                  <span className="text-[10px] font-semibold text-foreground block">{qp.label}</span>
                  <span className="text-[9px] text-muted-foreground line-clamp-2">{qp.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          const tradeActions = msg.role === "assistant" ? parseTradeActions(msg.content) : [];
          return (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                }`}
              >
                <div className="whitespace-pre-wrap break-words prose prose-xs prose-invert max-w-none">
                  <ReactMarkdown>{msg.content.replace(/\[(BUY|SELL)\s+\w+\s+[\d.]+\s+SL:[\d.]+\s+TP:[\d.]+\]/gi, "")}</ReactMarkdown>
                </div>
                {/* Send signal to chart button */}
                {tradeActions.length > 0 && (
                  <div className="mt-2 space-y-1.5 border-t border-border/50 pt-2">
                    {tradeActions.map((action, j) => (
                      <button
                        key={j}
                        onClick={() => sendToChart(action)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-[11px] font-mono font-bold text-white transition-all active:scale-95 ${
                          action.type === "BUY"
                            ? "bg-trading-green hover:bg-trading-green/90"
                            : "bg-trading-red hover:bg-trading-red/90"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <BarChart3 className="w-3 h-3" />
                          <span>Send to Chart</span>
                        </div>
                        <div className="text-right text-[9px] opacity-90">
                          <div>{action.type} {action.symbol} @ {action.price}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Analyzing...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about signals, risk, analysis..."
            className="h-8 text-xs bg-secondary border-border"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={isLoading || !input.trim()}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AIAssistant;
