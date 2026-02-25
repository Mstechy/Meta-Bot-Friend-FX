import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { telegramNotifier } from "@/lib/telegram";
import { Send, CheckCircle, XCircle, Loader2 } from "lucide-react";

export function TelegramSettings() {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    // Load saved settings
    const savedToken = localStorage.getItem("telegram_bot_token") || "";
    const savedChatId = localStorage.getItem("telegram_chat_id") || "";
    const savedEnabled = localStorage.getItem("telegram_enabled") === "true";
    
    setBotToken(savedToken);
    setChatId(savedChatId);
    setEnabled(savedEnabled);
  }, []);

  const handleSave = () => {
    telegramNotifier.configure(botToken, chatId, enabled);
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!botToken || !chatId) return;
    
    setTesting(true);
    setTestResult(null);
    
    // Temporarily configure and test
    const wasEnabled = enabled;
    telegramNotifier.configure(botToken, chatId, true);
    
    const success = await telegramNotifier.notifyStatus("🔔 Test message from MT5 Trading Hub!");
    
    setTestResult(success ? "success" : "error");
    setTesting(false);
    
    // Restore previous enabled state
    telegramNotifier.configure(botToken, chatId, wasEnabled);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM17 13H13V17H11V13H7V11H11V7H13V11H17V13Z" fill="#229ED9"/>
          </svg>
          Telegram Notifications
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Get trade alerts and signals directly on your Telegram
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="telegram-enabled" className="flex flex-col gap-1">
            <span>Enable Notifications</span>
            <span className="text-xs text-muted-foreground font-normal">
              Receive trade alerts on Telegram
            </span>
          </Label>
          <Switch
            id="telegram-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bot-token">Bot Token</Label>
          <Input
            id="bot-token"
            type="password"
            placeholder="Enter your Telegram bot token"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Create a bot via @BotFather on Telegram
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="chat-id">Chat ID</Label>
          <Input
            id="chat-id"
            placeholder="Enter your Telegram chat ID"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Start a chat with @userinfobot to get your Chat ID
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1">
            Save Settings
          </Button>
          <Button 
            variant="outline" 
            onClick={handleTest}
            disabled={!botToken || !chatId || testing}
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Test
          </Button>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            testResult === "success" 
              ? "bg-green-500/10 text-green-500" 
              : "bg-red-500/10 text-red-500"
          }`}>
            {testResult === "success" ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Test message sent successfully!</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                <span>Failed to send test message. Check your token and chat ID.</span>
              </>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <h4 className="font-medium mb-2">What you'll receive:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>🟢 Trade opened notifications</li>
            <li>🔴 Trade closed with profit/loss</li>
            <li>📊 Trading signals</li>
            <li>❌ Error alerts</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default TelegramSettings;
