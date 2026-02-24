import { useNavigate } from "react-router-dom";
import { AccountInfo } from "@/lib/tradingData";
import {
  ArrowLeft, User, Mail, Newspaper, Calendar, MessageSquare, Users,
  Bot, Key, Globe, BarChart3, ClipboardList, Settings as SettingsIcon,
  ChevronRight, Shield
} from "lucide-react";

interface SettingsPageProps {
  account?: AccountInfo;
}

const Settings = () => {
  const navigate = useNavigate();

  // Load account from localStorage
  let account: AccountInfo;
  try {
    const saved = localStorage.getItem("mt5_account");
    account = saved ? JSON.parse(saved) : { balance: 10000, equity: 10000, margin: 0, freeMargin: 10000, marginLevel: 0, profit: 0, isDemo: true, leverage: 100, currency: "USD", server: "MetaQuotes-Demo", accountId: "10008260595", name: "Demo Trader" };
  } catch {
    account = { balance: 10000, equity: 10000, margin: 0, freeMargin: 10000, marginLevel: 0, profit: 0, isDemo: true, leverage: 100, currency: "USD", server: "MetaQuotes-Demo", accountId: "10008260595", name: "Demo Trader" };
  }

  const menuSections = [
    {
      items: [
        { icon: User, label: "New Account", desc: "", onClick: () => {} },
        { icon: Mail, label: "Mailbox", desc: "You have registered a new account", onClick: () => {} },
        { icon: Newspaper, label: "News", desc: "", onClick: () => {} },
        { icon: Calendar, label: "Tradays", desc: "Economic calendar", onClick: () => {} },
      ],
    },
    {
      items: [
        { icon: MessageSquare, label: "Chat and Messages", desc: "Sign in to MQL5.community!", onClick: () => {} },
        { icon: Users, label: "Traders Community", desc: "", onClick: () => {} },
        { icon: Bot, label: "MQL5 Algo Trading", desc: "", onClick: () => {} },
      ],
    },
    {
      items: [
        { icon: Key, label: "OTP", desc: "One-time password generator", onClick: () => {} },
        { icon: Globe, label: "Interface", desc: "English", onClick: () => {} },
        { icon: BarChart3, label: "Charts", desc: "", onClick: () => navigate("/trading") },
        { icon: ClipboardList, label: "Journal", desc: "", onClick: () => navigate("/journal") },
        { icon: SettingsIcon, label: "Settings", desc: "", onClick: () => {} },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-foreground">Settings</h1>
        <div className="w-5" />
      </div>

      {/* Account Card */}
      <button
        className="mx-4 mt-4 p-4 rounded-lg bg-card border border-border text-center relative overflow-hidden"
        onClick={() => {}}
      >
        {account.isDemo && (
          <span className="absolute top-0 right-0 px-3 py-1 text-[10px] font-bold bg-primary text-primary-foreground rounded-bl-lg">
            Demo
          </span>
        )}
        <h2 className="text-base font-bold text-foreground">{account.name}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">MetaQuotes Ltd.</p>
        <p className="text-xs text-muted-foreground">
          {account.accountId} - {account.server}
        </p>
        <p className="text-xs text-muted-foreground">Access Point HA</p>
        <ChevronRight className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
      </button>

      {/* Menu Sections */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 mt-4">
        {menuSections.map((section, si) => (
          <div key={si} className="rounded-lg bg-card border border-border overflow-hidden">
            {section.items.map((item, ii) => (
              <button
                key={ii}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors border-b border-border/50 last:border-b-0"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  {item.desc && (
                    <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center border-t border-border bg-card">
        {[
          { icon: BarChart3, label: "Quotes", path: "/trading", tab: "market" },
          { icon: BarChart3, label: "Chart", path: "/trading", tab: "chart" },
          { icon: Shield, label: "Trade", path: "/trading", tab: "order" },
          { icon: ClipboardList, label: "History", path: "/journal" },
          { icon: SettingsIcon, label: "Settings", path: "/settings", active: true },
        ].map((nav) => (
          <button
            key={nav.label}
            onClick={() => navigate(nav.path)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors ${
              nav.active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <nav.icon className="w-4 h-4" />
            {nav.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Settings;
