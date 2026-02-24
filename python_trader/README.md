# MetaTrader 5 Python Trading Bot

Smart auto-trading bot with real-time market analysis and technical indicators.

## Features

- 📊 **Smart Market Analysis** - Uses RSI, MACD, EMA, Bollinger Bands
- 🎯 **Quick Re-entry** - Opens new trades immediately after wins
- 🛡️ **Risk Management** - Daily loss limits, drawdown protection
- 📈 **Trailing Stop** - Protects profits as price moves
- 🔄 **Multi-Symbol Trading** - Monitors 10+ currency pairs
- 🌐 **API Server** - Connects with web interface

## ⚠️ IMPORTANT: Connection Troubleshooting

If you see "Failed to connect. Make sure Python API is running!", follow these steps:

### Step 1: Install Dependencies
```
bash
cd python_trader
pip install -r requirements.txt
```

### Step 2: Open MT5 Terminal FIRST
**IMPORTANT:** MetaTrader 5 must be running and logged in BEFORE you run the Python bot!

1. Open MetaTrader 5 terminal
2. Login to your demo or live account
3. Keep MT5 running in the background

### Step 3: Configure MT5 Path (if auto-detect fails)

Edit `config.py` and set your MT5 path manually:

```
python
MT5_CONFIG = {
    "timeout": 60000,
    "portable": False,
    "platform": "Windows",
    "mt5_path": "C:\\Program Files\\MetaTrader 5\\terminal64.exe",  # UPDATE THIS
}
```

**To find your MT5 path:**
1. Right-click MT5 shortcut on desktop
2. Click Properties
3. Copy the path from "Target" field

### Step 4: Run the API Server

```
bash
python mt5_bot.py --api
```

The API runs on `http://127.0.0.1:5000`

## Common Error Codes

| Error | Meaning | Fix |
|-------|---------|-----|
| `(-10004, ...)` | MT5 not running | Open MT5 terminal first |
| `(-2, ...)` | Wrong path | Update mt5_path in config.py |
| `(-6, ...)` | No connection to broker | Check internet |
| `(1, ...)` | Not authorized | Login to MT5 manually |

## Usage

### Option 1: Standalone Bot
```
bash
python mt5_bot.py
```

### Option 2: API Server (for web interface)
```
bash
python mt5_bot.py --api
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Get bot status |
| `/api/connect` | POST | Connect to MT5 |
| `/api/start` | POST | Start trading |
| `/api/stop` | POST | Stop trading |
| `/api/analysis/EURUSD` | GET | Get market analysis |
| `/api/positions` | GET | Get open positions |

## Configuration

Edit `config.py` to customize:

- **MT5 login credentials** - Set your demo/live account details
- **MT5 path** - Set path to terminal64.exe
- **Trading parameters** - lot size, SL/TP
- **Risk management** - daily loss limits, drawdown
- **Trading hours** - session times
- **Symbol settings** - trading pairs

## Quick Start

```
python
from mt5_bot import MT5SmartTrader

# Create trader instance
trader = MT5SmartTrader()

# Connect to MT5 (make sure MT5 is open first!)
if trader.connect(account_type="demo"):
    # Run trading bot
    trader.run(symbols=["EURUSD", "GBPUSD", "XAUUSD"])
```

## Risk Management

The bot includes:
- Max daily loss limit ($500)
- Max drawdown (10%)
- Max consecutive losses (3)
- Session trading hours
- Max trades per session

## Technical Indicators Used

- **RSI** - Overbought/Oversold detection
- **EMA 9/21** - Trend direction
- **MACD** - Momentum indicator
- **Bollinger Bands** - Volatility & reversal
- **ATR** - Position sizing

## Notes

- ⚠️ Always ensure MT5 is OPEN before running the Python bot
- Use a demo account first
- Start with small lot sizes
- Monitor the bot initially
- Adjust settings based on results
