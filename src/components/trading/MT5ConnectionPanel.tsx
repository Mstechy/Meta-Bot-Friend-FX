import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import mt5Connection, { MT5_DEMO_SERVERS, MT5_LIVE_SERVERS, MT5ConnectionState } from "@/lib/mt5Connection";
import { Activity, CheckCircle, XCircle, Loader2, Shield, Zap, Server, Key, Cloud } from "lucide-react";
import { toast } from "sonner";

interface MT5ConnectionPanelProps {
  currentState: MT5ConnectionState;
  onStateChange: (state: MT5ConnectionState) => void;
}

const MT5ConnectionPanel = ({ currentState, onStateChange }: MT5ConnectionPanelProps) => {
  const [connecting, setConnecting] = useState(false);
  const [demoServer, setDemoServer] = useState("MetaQuotes-Demo");
  const [liveServer, setLiveServer] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  // Subscribe to MT5 connection state
  useEffect(() => {
    const unsubscribe = mt5Connection.subscribe((state) => {
      onStateChange(state);
    });
    return () => unsubscribe();
  }, [onStateChange]);

  const handleDemoConnect = async () => {
    setConnecting(true);
    try {
      // Connect to MetaApi cloud which handles MT5 connection
      const success = await mt5Connection.connect({
        host: "localhost",
        port: 5000,
        login: login ? parseInt(login) : 0,
        password: password || "",
        server: demoServer,
        isDemo: true,
      });
      
      if (success) {
        toast.success("Connected to MT5 via MetaApi", {
          description: `Server: ${demoServer}${login ? ` | Account: ${login}` : ''}`,
        });
      } else {
        toast.error("Failed to connect. Check credentials and try again!");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Connection error: ${errorMsg}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleLiveConnect = async () => {
    if (!login || !password || !liveServer) {
      toast.error("Please fill in all fields");
      return;
    }

    setConnecting(true);
    try {
      // Connect to MetaApi cloud which handles MT5 connection
      const success = await mt5Connection.connect({
        host: "localhost",
        port: 5000,
        login: parseInt(login),
        password,
        server: liveServer,
        isDemo: false,
      });
      
      if (success) {
        toast.success("Connected to MT5 via MetaApi", {
          description: `Server: ${liveServer} | Account: ${login}`,
        });
      } else {
        toast.error("Failed to connect. Check credentials and try again!");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Connection error: ${errorMsg}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    mt5Connection.disconnect();
    toast.info("Disconnected from MT5");
  };

  return (
    <Card className="w-full bg-card border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">MT5 Connection</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {currentState.connected ? (
              <>
                <CheckCircle className="w-4 h-4 text-profit" />
                <span className="text-sm text-profit font-medium">Connected</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-loss" />
                <span className="text-sm text-muted-foreground">Disconnected</span>
              </>
            )}
          </div>
        </div>
        <CardDescription>
          Connect to MetaApi cloud (which connects to MetaTrader 5)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currentState.connected ? (
          // Connected state
          <div className="space-y-4">
            <Alert className="bg-profit/10 border-profit/30">
              <CheckCircle className="h-4 w-4 text-profit" />
              <AlertDescription className="text-profit">
                Successfully connected to MT5 via MetaApi cloud!
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-secondary/30">
              <div>
                <div className="text-xs text-muted-foreground">Account</div>
                <div className="font-mono font-medium">{currentState.account?.accountId}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Server</div>
                <div className="font-mono font-medium">{currentState.account?.server}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Balance</div>
                <div className="font-mono font-medium">${currentState.account?.balance.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Type</div>
                <div className={`font-medium ${currentState.account?.isDemo ? 'text-primary' : 'text-profit'}`}>
                  {currentState.account?.isDemo ? 'DEMO' : 'LIVE'}
                </div>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full border-loss/30 text-loss hover:bg-loss/10"
              onClick={handleDisconnect}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          </div>
        ) : (
          // Disconnected state - show connection options
          <Tabs defaultValue="demo" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="demo" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Demo Account
              </TabsTrigger>
              <TabsTrigger value="live" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Live Account
              </TabsTrigger>
            </TabsList>

            {/* Demo Account Tab */}
            <TabsContent value="demo" className="space-y-4 mt-4">
              <Alert className="bg-primary/10 border-primary/30">
                <Cloud className="h-4 w-4 text-primary" />
                <AlertDescription className="text-muted-foreground">
                  Enter your demo account credentials to connect via MetaApi cloud.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Demo Server</Label>
                <Select value={demoServer} onValueChange={setDemoServer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select server" />
                  </SelectTrigger>
                  <SelectContent>
                    {MT5_DEMO_SERVERS.map((server) => (
                      <SelectItem key={server} value={server}>
                        {server}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Account Login (Demo Account Number)</Label>
                <Input
                  type="number"
                  placeholder="Enter your demo account number"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Enter your demo password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button 
                className="w-full bg-primary text-black hover:bg-primary/90"
                onClick={handleDemoConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4 mr-2" />
                    Connect via MetaApi
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Live Account Tab */}
            <TabsContent value="live" className="space-y-4 mt-4">
              <Alert className="bg-loss/10 border-loss/30">
                <Shield className="h-4 w-4 text-loss" />
                <AlertDescription className="text-muted-foreground">
                  Live trading involves real money. Enter your live credentials.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Trading Server</Label>
                <Select value={liveServer} onValueChange={setLiveServer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your broker's server" />
                  </SelectTrigger>
                  <SelectContent>
                    {MT5_LIVE_SERVERS.map((server) => (
                      <SelectItem key={server} value={server}>
                        {server}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Enter Custom Server...</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Account Login (MT5 Login)</Label>
                <Input
                  type="number"
                  placeholder="Enter your MT5 login number"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Enter your MT5 password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button 
                className="w-full bg-profit text-black hover:bg-profit/90"
                onClick={handleLiveConnect}
                disabled={connecting || !login || !password || !liveServer}
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Connect via MetaApi
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default MT5ConnectionPanel;
