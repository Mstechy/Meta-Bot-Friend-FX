import { Position } from "./tradingData";

interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

interface TradeMessage {
  type: "OPEN" | "CLOSE" | "SIGNAL" | "ERROR" | "STATUS";
  position?: Position;
  message: string;
  profit?: number;
  balance?: number;
}

class TelegramNotifier {
  private config: TelegramConfig | null = null;
  private messageQueue: TradeMessage[] = [];
  private isProcessing = false;

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    const token = localStorage.getItem("telegram_bot_token");
    const chatId = localStorage.getItem("telegram_chat_id");
    const enabled = localStorage.getItem("telegram_enabled") === "true";

    if (token && chatId) {
      this.config = {
        botToken: token,
        chatId: chatId,
        enabled
      };
    }
  }

  configure(token: string, chatId: string, enabled: boolean = true) {
    this.config = { botToken: token, chatId, enabled };
    localStorage.setItem("telegram_bot_token", token);
    localStorage.setItem("telegram_chat_id", chatId);
    localStorage.setItem("telegram_enabled", String(enabled));
  }

  isConfigured(): boolean {
    return this.config !== null && this.config.enabled;
  }

  private formatMessage(msg: TradeMessage): string {
    const icons = {
      OPEN: "🟢",
      CLOSE: "🔴",
      SIGNAL: "📊",
      ERROR: "❌",
      STATUS: "ℹ️"
    };

    let text = `${icons[msg.type]} *${msg.type}*\n\n`;
    text += `${msg.message}\n\n`;

    if (msg.position) {
      const p = msg.position;
      text += `📈 *Position Details*\n`;
      text += `• Symbol: ${p.symbol}\n`;
      text += `• Type: ${p.type.toUpperCase()}\n`;
      text += `• Volume: ${p.volume}\n`;
      text += `• Entry: ${p.openPrice}\n`;
      if (p.stopLoss) text += `• SL: ${p.stopLoss}\n`;
      if (p.takeProfit) text += `• TP: ${p.takeProfit}\n`;
    }

    if (msg.profit !== undefined) {
      const profitIcon = msg.profit >= 0 ? "💰" : "💸";
      text += `\n${profitIcon} *Profit:* ${msg.profit >= 0 ? "+" : ""}${msg.profit.toFixed(2)}`;
    }

    if (msg.balance !== undefined) {
      text += `\n💵 *Balance:* ${msg.balance.toFixed(2)}`;
    }

    text += `\n\n⏰ ${new Date().toLocaleString()}`;

    return text;
  }

  async send(msg: TradeMessage): Promise<boolean> {
    if (!this.config || !this.config.enabled) {
      console.log("Telegram disabled or not configured");
      return false;
    }

    this.messageQueue.push(msg);

    if (!this.isProcessing) {
      this.processQueue();
    }

    return true;
  }

  private async processQueue() {
    if (this.isProcessing || this.messageQueue.length === 0) return;

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        await this.sendToTelegram(msg);
      }
    }

    this.isProcessing = false;
  }

  private async sendToTelegram(msg: TradeMessage): Promise<boolean> {
    if (!this.config) return false;

    const text = this.formatMessage(msg);
    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: text,
          parse_mode: "Markdown"
        })
      });

      const result = await response.json();
      return result.ok;
    } catch (error) {
      console.error("Telegram notification failed:", error);
      return false;
    }
  }

  // Convenience methods
  async notifyOpenTrade(position: Position): Promise<boolean> {
    return this.send({
      type: "OPEN",
      position,
      message: `New ${position.type.toUpperCase()} trade opened on ${position.symbol}`
    });
  }

  async notifyCloseTrade(position: Position, profit: number, balance: number): Promise<boolean> {
    return this.send({
      type: "CLOSE",
      position,
      message: `Trade closed on ${position.symbol}`,
      profit,
      balance
    });
  }

  async notifySignal(symbol: string, signal: "BUY" | "SELL", reason: string): Promise<boolean> {
    return this.send({
      type: "SIGNAL",
      message: `🎯 *${signal} Signal* on ${symbol}\n\n${reason}`
    });
  }

  async notifyError(error: string): Promise<boolean> {
    return this.send({
      type: "ERROR",
      message: `⚠️ Error: ${error}`
    });
  }

  async notifyStatus(message: string): Promise<boolean> {
    return this.send({
      type: "STATUS",
      message
    });
  }
}

export const telegramNotifier = new TelegramNotifier();
export default telegramNotifier;
