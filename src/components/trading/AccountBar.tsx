import { AccountInfo } from "@/lib/tradingData";
import { Wallet, TrendingUp, Shield, Activity } from "lucide-react";

interface AccountBarProps {
  account: AccountInfo;
}

const AccountBar = ({ account }: AccountBarProps) => {
  return (
    <div className="flex items-center gap-3 md:gap-6 px-3 md:px-4 py-1.5 md:py-2 bg-card border-b border-border text-[10px] md:text-xs font-mono overflow-x-auto">
      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        <div className="flex items-center gap-1 md:gap-1.5">
          <Wallet className="w-3 h-3 md:w-3.5 md:h-3.5 text-muted-foreground hidden md:block" />
          <span className="text-muted-foreground">Bal:</span>
          <span className="font-semibold text-foreground">${account.balance.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1 md:gap-1.5">
          <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5 text-muted-foreground hidden md:block" />
          <span className="text-muted-foreground">Equity:</span>
          <span className="font-semibold text-foreground">${account.equity.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1 md:gap-1.5 hidden sm:flex">
          <Shield className="w-3 h-3 md:w-3.5 md:h-3.5 text-muted-foreground hidden md:block" />
          <span className="text-muted-foreground">Margin:</span>
          <span className="font-semibold text-foreground">${account.margin.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1 md:gap-1.5 hidden lg:flex">
          <span className="text-muted-foreground">Free:</span>
          <span className="font-semibold text-foreground">${account.freeMargin.toFixed(2)}</span>
        </div>
        {account.marginLevel > 0 && (
          <div className="flex items-center gap-1 md:gap-1.5 hidden lg:flex">
            <span className="text-muted-foreground">Level:</span>
            <span className="font-semibold text-foreground">{account.marginLevel.toFixed(2)}%</span>
          </div>
        )}
        <div className="flex items-center gap-1 md:gap-1.5">
          <Activity className="w-3 h-3 md:w-3.5 md:h-3.5 text-muted-foreground hidden md:block" />
          <span className="text-muted-foreground">P/L:</span>
          <span className={`font-semibold ${account.profit >= 0 ? "price-up" : "price-down"}`}>
            ${account.profit.toFixed(2)}
          </span>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        <span className="text-[9px] text-muted-foreground hidden md:inline">{account.server} | 1:{account.leverage}</span>
        {account.isDemo ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/20 text-accent">DEMO</span>
        ) : (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary">LIVE</span>
        )}
      </div>
    </div>
  );
};

export default AccountBar;
