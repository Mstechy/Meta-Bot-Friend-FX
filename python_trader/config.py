# MetaTrader 5 Python Trading Bot Configuration

# ============================================
# MT5 CONNECTION - ENTER YOUR CREDENTIALS HERE
# ============================================
# You can set credentials here OR in .env / environment:
#   MT5_LOGIN=your_account_number
#   MT5_PASSWORD=your_password
#   MT5_SERVER=YourBroker-Demo

# Auto-detect MT5 path (common Windows locations)
import os

# Load .env so credentials can be set without editing this file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def get_mt5_path():
    """Auto-detect MT5 terminal path"""
    common_paths = [
        "C:\\Program Files\\MetaTrader 5\\terminal64.exe",
        "C:\\Program Files (x86)\\MetaTrader 5\\terminal64.exe",
        "C:\\Program Files\\MetaTrader 5\\terminal.exe",
        os.path.expanduser("~\\AppData\\Roaming\\MetaTrader 5\\terminal64.exe"),
    ]
    for path in common_paths:
        if os.path.exists(path):
            return path
    return None  # Will use default MT5 path

MT5_CONFIG = {
    "timeout": 60000,
    "portable": False,
    "platform": "Windows",
    "mt5_path": get_mt5_path(),  # Auto-detected MT5 path
}

# Demo Account: from env (MT5_LOGIN, MT5_PASSWORD, MT5_SERVER) or defaults below
def _int_env(name, default=0):
    v = os.getenv(name)
    if v is None or v == "":
        return default
    try:
        return int(v)
    except ValueError:
        return default

MT5_DEMO = {
    "login": _int_env("MT5_LOGIN", 10008260595),
    "password": os.getenv("MT5_PASSWORD", ""),
    "server": os.getenv("MT5_SERVER", "MetaQuotes-Demo"),
}

# Real Account: from env (MT5_REAL_LOGIN, MT5_REAL_PASSWORD, MT5_REAL_SERVER) or defaults
MT5_REAL = {
    "login": _int_env("MT5_REAL_LOGIN", 0),
    "password": os.getenv("MT5_REAL_PASSWORD", ""),
    "server": os.getenv("MT5_REAL_SERVER", ""),
}

# ============================================
# TRADING CONFIGURATION
# ============================================

TRADING_CONFIG = {
    "default_lot": 0.01,
    "max_lot": 1.0,
    "default_risk_percent": 1.0,  # Risk per trade %
    "default_sl_pips": 20,
    "default_tp_pips": 30,
    "trailing_stop_enabled": True,
    "trailing_stop_pips": 15,
    "max_open_trades": 3,
    "magic_number": 123456,
    "max_spread": 30,  # Max spread to trade
}

# Trading Symbols
SYMBOLS = {
    "EURUSD": {"spread_max": 20, "min_lot": 0.01, "point": 0.00001},
    "GBPUSD": {"spread_max": 30, "min_lot": 0.01, "point": 0.00001},
    "USDJPY": {"spread_max": 20, "min_lot": 0.01, "point": 0.0001},
    "XAUUSD": {"spread_max": 50, "min_lot": 0.01, "point": 0.01},
    "AUDUSD": {"spread_max": 30, "min_lot": 0.01, "point": 0.00001},
    "USDCAD": {"spread_max": 30, "min_lot": 0.01, "point": 0.00001},
    "USDCHF": {"spread_max": 30, "min_lot": 0.01, "point": 0.00001},
    "NZDUSD": {"spread_max": 30, "min_lot": 0.01, "point": 0.00001},
    "EURJPY": {"spread_max": 30, "min_lot": 0.01, "point": 0.0001},
    "GBPJPY": {"spread_max": 40, "min_lot": 0.01, "point": 0.0001},
}

# ============================================
# SMART RISK MANAGEMENT
# ============================================

RISK_CONFIG = {
    # Basic Limits
    "max_daily_loss": 500,
    "max_daily_profit": 2000,  # Take profit daily limit
    "max_drawdown_percent": 10,
    "max_consecutive_losses": 3,  # Stop after 3 losses
    "max_consecutive_wins": 5,  # Take break after 5 wins
    
    # Adaptive Risk (adjusts based on performance)
    "adaptive_risk": True,
    "increase_risk_after_win": True,  # Increase risk after win
    "decrease_risk_after_loss": True,  # Decrease risk after loss
    "min_risk_percent": 0.5,
    "max_risk_percent": 3.0,
    "risk_multiplier_after_win": 1.2,
    "risk_divider_after_loss": 0.5,
    
    # Session Management
    "session_trading_hours": {"start": 8, "end": 20},
    "max_trades_per_session": 10,
    "min_trade_interval": 30,  # Seconds between trades
    
    # Loss Analysis
    "analyze_losses": True,
    "pause_after_loss": True,
    "pause_seconds_after_loss": 60,
    "require_new_signal_after_loss": True,  # Only trade on stronger signals after loss
    "increased_confidence_after_loss": 10,  # Increase required confidence after loss
    
    # News Filter
    "news_filter_enabled": True,
    "news_avoid_minutes_before": 30,
    "news_avoid_minutes_after": 30,
    "high_impact_news_avoid": True,
}

# ============================================
# STRATEGY CONFIGURATION
# ============================================

STRATEGY_CONFIG = {
    # Multi-Strategy Mode
    "use_multi_strategy": True,
    
    # Trend Following
    "trend_enabled": True,
    "trend_weight": 25,
    
    # Mean Reversion
    "mean_reversion_enabled": True,
    "mean_reversion_weight": 25,
    
    # Momentum
    "momentum_enabled": True,
    "momentum_weight": 25,
    
    # Breakout
    "breakout_enabled": True,
    "breakout_weight": 25,
    
    # Minimum confidence to trade
    "min_confidence": 50,
    "min_confidence_after_loss": 60,  # Higher after loss
    
    # Strategy Adaptation (learns from performance)
    "auto_optimize": True,
    "optimization_interval": 10,  # Trades
    "reduce_weight_on_loss": 10,  # % to reduce
}

# ============================================
# NEWS CONFIGURATION
# ============================================

NEWS_CONFIG = {
    # Forex Factory Calendar API (free)
    "use_forexfactory": True,
    "calendar_url": "https://www.forexfactory.com/api/calendar",
    
    # Major news events to avoid
    "high_impact_events": [
        "US Non-Farm Payrolls",
        "FOMC Meeting Minutes",
        "ECB Interest Rate",
        "BOE Interest Rate",
        "US CPI",
        "US GDP",
        "US NFP",
        "Brexit",
    ],
    
    # Safe trading times
    "avoid_friday_evening": True,
    "avoid_monday_morning": True,
}

# ============================================
# API SERVER
# ============================================

API_HOST = "127.0.0.1"
API_PORT = 5000

# ============================================
# POPULAR BROKER SERVERS
# ============================================

KNOWN_BROKERS = {
    "MetaQuotes-Demo": "MetaQuotes Demo Server",
    "ICMarkets-Demo": "IC Markets Demo",
    "ICMarkets-Live": "IC Markets Live",
    "FXTM-Demo": "FXTM Demo",
    "FXTM-Live": "FXTM Live",
    "OANDA-Demo": "OANDA Demo",
    "OANDA-Live": "OANDA Live",
    "Pepperstone-Demo": "Pepperstone Demo",
    "Pepperstone-Live": "Pepperstone Live",
    "Tickmill-Demo": "Tickmill Demo",
    "Tickmill-Live": "Tickmill Live",
    "AdmiralMarkets-Demo": "Admiral Markets Demo",
    "AdmiralMarkets-Live": "Admiral Markets Live",
}
