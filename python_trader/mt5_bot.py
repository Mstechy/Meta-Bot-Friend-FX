"""
MetaTrader 5 Python Trading Bot - Smart Edition
Advanced auto-trading with real-time analysis, risk management, and news filtering
"""

import MetaTrader5 as mt5
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import time
import json
import threading
import requests
from typing import Dict, List, Optional, Tuple
from config import MT5_DEMO, MT5_REAL, MT5_CONFIG, TRADING_CONFIG, SYMBOLS, RISK_CONFIG, STRATEGY_CONFIG, NEWS_CONFIG

class NewsManager:
    """Manages news events and filters trading around them"""
    
    def __init__(self):
        self.news_events = []
        self.last_fetch = None
        self.fetch_interval = 300  # 5 minutes
    
    def fetch_calendar(self) -> List[dict]:
        """Fetch forex calendar from Forex Factory"""
        if not NEWS_CONFIG.get("use_forexfactory", True):
            return []
        
        try:
            # Try to get calendar from Forex Factory
            url = "https://www.forexfactory.com/api/calendar"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get("calendar", [])
        except Exception as e:
            print(f"News fetch error: {e}")
        
        # Return empty if fetch fails
        return []
    
    def should_trade(self, symbol: str = None) -> Tuple[bool, str]:
        """Check if it's safe to trade based on news"""
        now = datetime.now()
        
        # Avoid Friday evening
        if NEWS_CONFIG.get("avoid_friday_evening", True):
            if now.weekday() == 4 and now.hour >= 16:
                return False, "Friday evening - no trading"
        
        # Avoid Monday morning
        if NEWS_CONFIG.get("avoid_monday_morning", True):
            if now.weekday() == 0 and now.hour < 8:
                return False, "Monday morning - no trading"
        
        # Check upcoming news
        avoid_before = NEWS_CONFIG.get("news_avoid_minutes_before", 30)
        avoid_after = NEWS_CONFIG.get("news_avoid_minutes_after", 30)
        
        for event in self.news_events:
            try:
                event_time = datetime.fromisoformat(event.get("date", ""))
                time_diff = (event_time - now).total_seconds() / 60
                
                if -avoid_before < time_diff < avoid_after:
                    if NEWS_CONFIG.get("high_impact_news_avoid", True) and event.get("impact") == "High":
                        return False, f"High impact news: {event.get('title')}"
            except:
                pass
        
        return True, "OK"
    
    def update_news(self):
        """Update news events periodically"""
        now = datetime.now()
        if self.last_fetch and (now - self.last_fetch).total_seconds() < self.fetch_interval:
            return
        
        self.news_events = self.fetch_calendar()
        self.last_fetch = now


class AdaptiveStrategy:
    """Self-optimizing strategy that learns from performance"""
    
    def __init__(self):
        self.strategy_weights = {
            "trend": STRATEGY_CONFIG.get("trend_weight", 25),
            "mean_reversion": STRATEGY_CONFIG.get("mean_reversion_weight", 25),
            "momentum": STRATEGY_CONFIG.get("momentum_weight", 25),
            "breakout": STRATEGY_CONFIG.get("breakout_weight", 25),
        }
        self.trade_results = []
        self.last_optimize = 0
    
    def get_signal(self, indicators: dict, analysis: dict) -> Tuple[Optional[str], int, str]:
        """Generate signal based on weighted strategies"""
        signals = []
        
        # Trend Following
        if STRATEGY_CONFIG.get("trend_enabled", True):
            if indicators.get("ema_9", 0) > indicators.get("ema_21", 0):
                signals.append(("BUY", self.strategy_weights["trend"], "Trend UP"))
            elif indicators.get("ema_9", 0) < indicators.get("ema_21", 0):
                signals.append(("SELL", self.strategy_weights["trend"], "Trend DOWN"))
        
        # Mean Reversion
        if STRATEGY_CONFIG.get("mean_reversion_enabled", True):
            rsi = indicators.get("rsi", 50)
            if rsi < 35:
                signals.append(("BUY", self.strategy_weights["mean_reversion"], f"RSI oversold {rsi:.0f}"))
            elif rsi > 65:
                signals.append(("SELL", self.strategy_weights["mean_reversion"], f"RSI overbought {rsi:.0f}"))
            
            # Bollinger Bands
            price = indicators.get("current_price", 0)
            if price <= indicators.get("bb_lower", 0):
                signals.append(("BUY", self.strategy_weights["mean_reversion"], "BB bounce"))
            elif price >= indicators.get("bb_upper", 0):
                signals.append(("SELL", self.strategy_weights["mean_reversion"], "BB reversal"))
        
        # Momentum
        if STRATEGY_CONFIG.get("momentum_enabled", True):
            macd = indicators.get("macd", 0)
            macd_signal = indicators.get("macd_signal", 0)
            if macd > macd_signal:
                signals.append(("BUY", self.strategy_weights["momentum"], "MACD bullish"))
            elif macd < macd_signal:
                signals.append(("SELL", self.strategy_weights["momentum"], "MACD bearish"))
        
        # Breakout
        if STRATEGY_CONFIG.get("breakout_enabled", True):
            price = indicators.get("current_price", 0)
            high = indicators.get("high", 0)
            low = indicators.get("low", 0)
            # Simple breakout detection
            if price >= high * 0.998:  # Near high
                signals.append(("SELL", self.strategy_weights["breakout"], "Breakout UP"))
            elif price <= low * 1.002:  # Near low
                signals.append(("BUY", self.strategy_weights["breakout"], "Breakout DOWN"))
        
        # Count votes
        buy_votes = sum(v for s, v, _ in signals if s == "BUY")
        sell_votes = sum(v for s, v, _ in signals if s == "SELL")
        
        total = buy_votes + sell_votes
        min_conf = STRATEGY_CONFIG.get("min_confidence", 50)
        
        if total >= min_conf:
            if buy_votes > sell_votes:
                conf = int((buy_votes / 100) * 100)
                reasons = [r for s, v, r in signals if s == "BUY"]
                return "BUY", conf, " | ".join(reasons[:2])
            elif sell_votes > buy_votes:
                conf = int((sell_votes / 100) * 100)
                reasons = [r for s, v, r in signals if s == "SELL"]
                return "SELL", conf, " | ".join(reasons[:2])
        
        return None, 0, "No clear signal"
    
    def record_result(self, symbol: str, result: str):
        """Record trade result for optimization"""
        self.trade_results.append({"symbol": symbol, "result": result, "time": datetime.now()})
        
        # Optimize periodically
        if len(self.trade_results) >= STRATEGY_CONFIG.get("optimization_interval", 10):
            self.optimize()
    
    def optimize(self):
        """Adjust strategy based on results"""
        recent = self.trade_results[-10:]
        
        # Find worst performing strategy
        strategy_results = {"trend": [], "mean_reversion": [], "momentum": [], "breakout": []}
        
        for trade in recent:
            # Simple optimization - just track wins/losses
            if trade["result"] == "win":
                pass  # Could increase weight
        
        # Reduce weights that caused losses
        reduce_pct = STRATEGY_CONFIG.get("reduce_weight_on_loss", 10)
        
        # Reset optimization counter
        self.trade_results = []


class MT5SmartTrader:
    """Smart MetaTrader 5 Trading Bot"""
    
    def __init__(self):
        self.connected = False
        self.account_type = "demo"  # or "real"
        self.positions = []
        self.account_info = None
        self.running = False
        self.news_manager = NewsManager()
        self.strategy = AdaptiveStrategy()
        
        # Statistics
        self.stats = {
            "trades": 0,
            "wins": 0,
            "losses": 0,
            "profit": 0.0,
            "start_date": datetime.now().date(),
            "last_trade_time": None,
            "consecutive_wins": 0,
            "consecutive_losses": 0,
            "current_risk_percent": TRADING_CONFIG.get("default_risk_percent", 1.0),
        }
        
        # Performance tracking
        self.symbol_performance = {}  # Track per-symbol performance
    
    def connect(self, account_type: str = "demo", login: int = None, password: str = None, server: str = None) -> bool:
        """Connect to MT5 with provided credentials"""
        
        # Get credentials based on account type
        if account_type == "demo":
            creds = MT5_DEMO.copy()
        else:
            creds = MT5_REAL.copy()
        
        # Override with provided credentials if given
        if login:
            creds["login"] = login
        if password:
            creds["password"] = password
        if server:
            creds["server"] = server
        
        # Get MT5 path from config
        mt5_path = MT5_CONFIG.get("mt5_path")
        
        # Initialize MT5 with path if available
        if mt5_path:
            print(f"🔗 Initializing MT5 from: {mt5_path}")
            if not mt5.initialize(path=mt5_path):
                error = mt5.last_error()
                print(f"❌ MT5 initialize failed: {error}")
                print("💡 Common fixes:")
                print("   1. Make sure MT5 terminal is OPEN before running this script")
                print("   2. Check if the path in config.py is correct")
                print("   3. Try running as Administrator")
                return False
        else:
            print("🔗 Initializing MT5 (using default path)...")
            if not mt5.initialize():
                error = mt5.last_error()
                print(f"❌ MT5 initialize failed: {error}")
                print("💡 Common fixes:")
                print("   1. Make sure MT5 terminal is OPEN before running this script")
                print("   2. Update MT5_CONFIG['mt5_path'] in config.py with your MT5 path")
                print("   3. Try running as Administrator")
                return False
        
        # Try to login if credentials provided
        if creds.get("login", 0) > 0 and creds.get("server"):
            print(f"🔐 Logging in to {creds['server']}...")
            authorized = mt5.login(
                login=creds["login"],
                password=creds.get("password", ""),
                server=creds["server"]
            )
            if not authorized:
                error = mt5.last_error()
                print(f"❌ Login failed: {error}")
                print("💡 Check your login credentials in config.py")
                print("   For demo accounts: Make sure login and server are correct")
                mt5.shutdown()
                return False
        else:
            print("⚠️ No login credentials provided - MT5 initialized but not logged in")
        
        # Get account info
        self.account_info = mt5.account_info()
        if not self.account_info:
            print("❌ Could not get account info")
            mt5.shutdown()
            return False
        
        self.connected = True
        self.account_type = account_type
        
        print(f"\n✅ Connected to MT5 ({account_type.upper()})")
        print(f"   Account: {self.account_info.login}")
        print(f"   Server: {self.account_info.server}")
        print(f"   Balance: ${self.account_info.balance:.2f}")
        print(f"   Equity: ${self.account_info.equity:.2f}")
        print(f"   Leverage: 1:{self.account_info.leverage}")
        
        return True
    
    def disconnect(self):
        """Disconnect from MT5"""
        self.running = False
        if self.connected:
            mt5.shutdown()
            self.connected = False
        print("🔌 Disconnected from MT5")
    
    def get_symbol_info(self, symbol: str) -> Optional[dict]:
        """Get symbol trading info"""
        info = mt5.symbol_info(symbol)
        if info is None:
            return None
        
        # Ensure symbol is visible
        if not info.visible:
            mt5.symbol_select(symbol, True)
            info = mt5.symbol_info(symbol)
        
        return {
            "symbol": info.name,
            "bid": info.bid,
            "ask": info.ask,
            "spread": info.spread,
            "digits": info.digits,
            "point": info.point,
            "volume_min": info.volume_min,
            "volume_max": info.volume_max,
            "volume_step": info.volume_step,
        }
    
    def get_candles(self, symbol: str, timeframe: str = "M1", count: int = 100) -> pd.DataFrame:
        """Get candle data for analysis"""
        timeframe_map = {
            "M1": mt5.TIMEFRAME_M1,
            "M5": mt5.TIMEFRAME_M5,
            "M15": mt5.TIMEFRAME_M15,
            "M30": mt5.TIMEFRAME_M30,
            "H1": mt5.TIMEFRAME_H1,
            "H4": mt5.TIMEFRAME_H4,
            "D1": mt5.TIMEFRAME_D1,
        }
        
        mt5_tf = timeframe_map.get(timeframe, mt5.TIMEFRAME_M1)
        rates = mt5.copy_rates_from_pos(symbol, mt5_tf, 0, count)
        
        if rates is None:
            return pd.DataFrame()
        
        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')
        
        # Add HLC for calculations
        df['high'] = df['high']
        df['low'] = df['low']
        df['close'] = df['close']
        
        return df
    
    def calculate_indicators(self, df: pd.DataFrame) -> dict:
        """Calculate technical indicators"""
        if len(df) < 26:
            return {}
        
        close = df['close']
        high = df['high']
        low = df['low']
        
        # RSI
        delta = close.diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        # EMA
        ema_9 = close.ewm(span=9, adjust=False).mean()
        ema_21 = close.ewm(span=21, adjust=False).mean()
        ema_50 = close.ewm(span=50, adjust=False).mean()
        
        # MACD
        ema_12 = close.ewm(span=12, adjust=False).mean()
        ema_26 = close.ewm(span=26, adjust=False).mean()
        macd = ema_12 - ema_26
        macd_signal = macd.ewm(span=9, adjust=False).mean()
        macd_hist = macd - macd_signal
        
        # Bollinger Bands
        sma_20 = close.rolling(20).mean()
        std_20 = close.rolling(20).std()
        bb_upper = sma_20 + (std_20 * 2)
        bb_lower = sma_20 - (std_20 * 2)
        
        # ATR
        high_low = high - low
        high_close = np.abs(high - close.shift())
        low_close = np.abs(low - close.shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = ranges.max(axis=1)
        atr = true_range.rolling(14).mean()
        
        # Stochastic
        low_14 = low.rolling(14).min()
        high_14 = high.rolling(14).max()
        stoch = 100 * (close - low_14) / (high_14 - low_14)
        
        return {
            "rsi": rsi.iloc[-1] if len(rsi) > 0 else 50,
            "ema_9": ema_9.iloc[-1],
            "ema_21": ema_21.iloc[-1],
            "ema_50": ema_50.iloc[-1],
            "macd": macd.iloc[-1] if len(macd) > 0 else 0,
            "macd_signal": macd_signal.iloc[-1] if len(macd_signal) > 0 else 0,
            "macd_hist": macd_hist.iloc[-1] if len(macd_hist) > 0 else 0,
            "bb_upper": bb_upper.iloc[-1] if len(bb_upper) > 0 else 0,
            "bb_middle": sma_20.iloc[-1] if len(sma_20) > 0 else 0,
            "bb_lower": bb_lower.iloc[-1] if len(bb_lower) > 0 else 0,
            "atr": atr.iloc[-1] if len(atr) > 0 else 0,
            "stoch": stoch.iloc[-1] if len(stoch) > 0 else 50,
            "current_price": close.iloc[-1],
            "high": high.iloc[-1],
            "low": low.iloc[-1],
        }
    
    def analyze_market(self, symbol: str, require_stronger_signal: bool = False) -> dict:
        """Smart market analysis"""
        df = self.get_candles(symbol, count=100)
        if df.empty:
            return {"signal": None, "confidence": 0, "reason": "No data"}
        
        indicators = self.calculate_indicators(df)
        if not indicators:
            return {"signal": None, "confidence": 0, "reason": "Insufficient data"}
        
        # Use adaptive strategy
        min_confidence = STRATEGY_CONFIG.get("min_confidence", 50)
        if require_stronger_signal:
            min_confidence += RISK_CONFIG.get("increased_confidence_after_loss", 10)
        
        signal, confidence, reason = self.strategy.get_signal(indicators, {})
        
        if signal and confidence >= min_confidence:
            return {
                "signal": signal,
                "confidence": confidence,
                "reason": reason,
                "indicators": indicators
            }
        
        return {"signal": None, "confidence": 0, "reason": reason, "indicators": indicators}
    
    def calculate_lot_size(self, symbol: str, stop_loss_pips: int = None) -> float:
        """Smart lot size calculation with adaptive risk"""
        if stop_loss_pips is None:
            stop_loss_pips = TRADING_CONFIG.get("default_sl_pips", 20)
        
        account_balance = self.account_info.balance
        risk_amount = account_balance * (self.stats["current_risk_percent"] / 100)
        
        symbol_info = SYMBOLS.get(symbol, {})
        point = symbol_info.get("point", 0.00001)
        
        # Pip value
        if "JPY" in symbol:
            pip_value = 1000
            sl_distance = stop_loss_pips * 0.01
        elif symbol == "XAUUSD":
            pip_value = 100
            sl_distance = stop_loss_pips * 1.0
        else:
            pip_value = 10
            sl_distance = stop_loss_pips * 0.0001
        
        lot_size = risk_amount / (sl_distance * pip_value)
        
        # Apply limits
        mt5_info = mt5.symbol_info(symbol)
        if mt5_info:
            lot_size = max(lot_size, mt5_info.volume_min)
            lot_size = min(lot_size, min(mt5_info.volume_max, TRADING_CONFIG.get("max_lot", 1.0)))
        
        return round(lot_size, 2)
    
    def open_trade(self, symbol: str, order_type: str, lot: float = None,
                   sl_pips: int = None, tp_pips: int = None) -> Optional[dict]:
        """Open a trade with smart parameters"""
        
        if not self.can_trade(symbol):
            return None
        
        symbol_info = self.get_symbol_info(symbol)
        if not symbol_info:
            return None
        
        # Check spread
        max_spread = TRADING_CONFIG.get("max_spread", 30)
        if symbol_info["spread"] > max_spread:
            print(f"⚠️ Spread too high for {symbol}: {symbol_info['spread']}")
            return None
        
        # Default lot
        if lot is None:
            lot = self.calculate_lot_size(symbol, sl_pips)
        
        # Default SL/TP
        if sl_pips is None:
            sl_pips = TRADING_CONFIG.get("default_sl_pips", 20)
        if tp_pips is None:
            tp_pips = TRADING_CONFIG.get("default_tp_pips", 30)
        
        # Calculate prices
        point = symbol_info["point"]
        if "JPY" in symbol:
            sl_dist = sl_pips * point * 10
            tp_dist = tp_pips * point * 10
        elif symbol == "XAUUSD":
            sl_dist = sl_pips * point
            tp_dist = tp_pips * point
        else:
            sl_dist = sl_pips * point * 10
            tp_dist = tp_pips * point * 10
        
        if order_type == "BUY":
            price = symbol_info["ask"]
            sl = price - sl_dist
            tp = price + tp_dist
        else:
            price = symbol_info["bid"]
            sl = price + sl_dist
            tp = price - tp_dist
        
        # Open position
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": lot,
            "type": mt5.ORDER_TYPE_BUY if order_type == "BUY" else mt5.ORDER_TYPE_SELL,
            "price": price,
            "sl": sl,
            "tp": tp,
            "deviation": 20,
            "magic": TRADING_CONFIG.get("magic_number", 123456),
            "comment": f"Smart Bot {order_type}",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        
        result = mt5.order_send(request)
        
        if result.retcode == mt5.TRADE_RETCODE_DONE:
            trade = {
                "ticket": result.order,
                "symbol": symbol,
                "type": order_type,
                "volume": lot,
                "price": price,
                "sl": sl,
                "tp": tp,
                "open_time": datetime.now()
            }
            
            self.stats["trades"] += 1
            self.stats["last_trade_time"] = datetime.now()
            
            print(f"\n✅ {order_type} {symbol} opened")
            print(f"   Lot: {lot} | SL: {sl:.5f} | TP: {tp:.5f}")
            
            return trade
        else:
            print(f"❌ Trade failed: {result.comment}")
            return None
    
    def close_trade(self, ticket: int) -> Tuple[bool, float]:
        """Close a trade and return success/profit"""
        positions = mt5.positions_get(ticket=ticket)
        if not positions:
            return False, 0
        
        pos = positions[0]
        symbol = pos.symbol
        volume = pos.volume
        order_type = "SELL" if pos.type == 0 else "BUY"
        
        symbol_info = self.get_symbol_info(symbol)
        price = symbol_info["ask"] if order_type == "BUY" else symbol_info["bid"]
        
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": volume,
            "type": mt5.ORDER_TYPE_SELL if order_type == "SELL" else mt5.ORDER_TYPE_BUY,
            "position": ticket,
            "price": price,
            "deviation": 20,
            "magic": TRADING_CONFIG.get("magic_number", 123456),
            "comment": "Smart Bot Close",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        
        result = mt5.order_send(request)
        
        if result.retcode == mt5.TRADE_RETCODE_DONE:
            profit = pos.profit
            
            # Update statistics
            if profit > 0:
                self.stats["wins"] += 1
                self.stats["profit"] += profit
                self.stats["consecutive_wins"] += 1
                self.stats["consecutive_losses"] = 0
                self.adjust_risk_after_win()
                print(f"\n🎯 WIN! {symbol} | Profit: ${profit:.2f}")
            else:
                self.stats["losses"] += 1
                self.stats["profit"] += profit
                self.stats["consecutive_losses"] += 1
                self.stats["consecutive_wins"] = 0
                self.adjust_risk_after_loss()
                print(f"\n❌ LOSS! {symbol} | Loss: ${profit:.2f}")
            
            # Record for strategy optimization
            self.strategy.record_result(symbol, "win" if profit > 0 else "loss")
            
            return True, profit
        
        return False, 0
    
    def adjust_risk_after_win(self):
        """Increase risk after winning trade"""
        if not RISK_CONFIG.get("adaptive_risk", True):
            return
        
        if RISK_CONFIG.get("increase_risk_after_win", True):
            mult = RISK_CONFIG.get("risk_multiplier_after_win", 1.2)
            new_risk = self.stats["current_risk_percent"] * mult
            max_risk = RISK_CONFIG.get("max_risk_percent", 3.0)
            self.stats["current_risk_percent"] = min(new_risk, max_risk)
    
    def adjust_risk_after_loss(self):
        """Decrease risk after losing trade"""
        if not RISK_CONFIG.get("adaptive_risk", True):
            return
        
        if RISK_CONFIG.get("decrease_risk_after_loss", True):
            div = RISK_CONFIG.get("risk_divider_after_loss", 0.5)
            new_risk = self.stats["current_risk_percent"] * div
            min_risk = RISK_CONFIG.get("min_risk_percent", 0.5)
            self.stats["current_risk_percent"] = max(new_risk, min_risk)
    
    def can_trade(self, symbol: str = None) -> Tuple[bool, str]:
        """Check if we can trade based on all risk rules"""
        
        # Check connection
        if not self.connected:
            return False, "Not connected"
        
        # Check daily loss
        daily_loss = RISK_CONFIG.get("max_daily_loss", 500)
        if self.stats["profit"] <= -daily_loss:
            self.stats["consecutive_losses"] = 999  # Force stop
            return False, "Max daily loss reached"
        
        # Check daily profit
        daily_profit = RISK_CONFIG.get("max_daily_profit", 2000)
        if self.stats["profit"] >= daily_profit:
            return False, "Daily profit target reached"
        
        # Check drawdown
        if self.account_info:
            equity = self.account_info.equity
            balance = self.account_info.balance
            drawdown = ((balance - equity) / balance) * 100
            if drawdown >= RISK_CONFIG.get("max_drawdown_percent", 10):
                return False, "Max drawdown reached"
        
        # Check consecutive losses
        max_losses = RISK_CONFIG.get("max_consecutive_losses", 3)
        if self.stats["consecutive_losses"] >= max_losses:
            return False, f"Max consecutive losses ({max_losses}) reached"
        
        # Check consecutive wins (take a break)
        max_wins = RISK_CONFIG.get("max_consecutive_wins", 5)
        if self.stats["consecutive_wins"] >= max_wins:
            return False, f"Take break after {max_wins} wins"
        
        # Check session hours
        session = RISK_CONFIG.get("session_trading_hours", None)
        if session:
            current_hour = datetime.now().hour
            if current_hour < session["start"] or current_hour > session["end"]:
                return False, "Outside trading hours"
        
        # Check news
        can_trade, reason = self.news_manager.should_trade(symbol)
        if not can_trade:
            return False, reason
        
        # Check trade interval
        min_interval = RISK_CONFIG.get("min_trade_interval", 30)
        if self.stats["last_trade_time"]:
            diff = (datetime.now() - self.stats["last_trade_time"]).total_seconds()
            if diff < min_interval:
                return False, f"Waiting {min_interval - int(diff)}s between trades"
        
        # Check max trades per session
        if self.stats["trades"] >= RISK_CONFIG.get("max_trades_per_session", 10):
            return False, "Max trades per session reached"
        
        return True, "OK"
    
    def check_positions(self) -> List[dict]:
        """Check and manage open positions"""
        positions = mt5.positions_get()
        if positions is None:
            return []
        
        closed = []
        magic = TRADING_CONFIG.get("magic_number", 123456)
        
        for pos in positions:
            if pos.magic != magic:
                continue
            
            symbol = pos.symbol
            symbol_info = self.get_symbol_info(symbol)
            if not symbol_info:
                continue
            
            current_price = symbol_info["bid"] if pos.type == 0 else symbol_info["ask"]
            
            # Check TP
            if pos.type == 0 and pos.tp > 0 and current_price >= pos.tp:
                self.close_trade(pos.ticket)
                closed.append({"ticket": pos.ticket, "reason": "TP", "symbol": symbol})
                continue
            elif pos.type == 1 and pos.tp > 0 and current_price <= pos.tp:
                self.close_trade(pos.ticket)
                closed.append({"ticket": pos.ticket, "reason": "TP", "symbol": symbol})
                continue
            
            # Check SL
            if pos.type == 0 and pos.sl > 0 and current_price <= pos.sl:
                self.close_trade(pos.ticket)
                closed.append({"ticket": pos.ticket, "reason": "SL", "symbol": symbol})
                continue
            elif pos.type == 1 and pos.sl > 0 and current_price >= pos.sl:
                self.close_trade(pos.ticket)
                closed.append({"ticket": pos.ticket, "reason": "SL", "symbol": symbol})
                continue
            
            # Trailing stop
            if TRADING_CONFIG.get("trailing_stop_enabled", True):
                self.update_trailing_stop(pos, symbol_info)
        
        return closed
    
    def update_trailing_stop(self, pos, symbol_info: dict):
        """Update trailing stop"""
        trail_pips = TRADING_CONFIG.get("trailing_stop_pips", 15)
        symbol = pos.symbol
        point = symbol_info["point"]
        
        if "JPY" in symbol:
            trail_dist = trail_pips * point * 10
        elif symbol == "XAUUSD":
            trail_dist = trail_pips * point
        else:
            trail_dist = trail_pips * point * 10
        
        current_price = symbol_info["bid"] if pos.type == 0 else symbol_info["ask"]
        
        # For BUY
        if pos.type == 0:
            new_sl = current_price - trail_dist
            if new_sl > pos.sl and pos.sl > 0:
                request = {
                    "action": mt5.TRADE_ACTION_SLTP,
                    "symbol": symbol,
                    "position": pos.ticket,
                    "sl": new_sl,
                    "tp": pos.tp,
                }
                mt5.order_send(request)
        
        # For SELL
        else:
            new_sl = current_price + trail_dist
            if new_sl < pos.sl or pos.sl == 0:
                request = {
                    "action": mt5.TRADE_ACTION_SLTP,
                    "symbol": symbol,
                    "position": pos.ticket,
                    "sl": new_sl,
                    "tp": pos.tp,
                }
                mt5.order_send(request)
    
    def get_open_positions(self) -> List[dict]:
        """Get all open positions managed by bot"""
        positions = mt5.positions_get()
        if positions is None:
            return []
        
        magic = TRADING_CONFIG.get("magic_number", 123456)
        
        return [
            {
                "ticket": p.ticket,
                "symbol": p.symbol,
                "type": "BUY" if p.type == 0 else "SELL",
                "volume": p.volume,
                "price": p.price_open,
                "current_price": p.price_current,
                "profit": p.profit,
                "sl": p.sl,
                "tp": p.tp,
            }
            for p in positions
            if p.magic == magic
        ]
    
    def reset_daily_stats(self):
        """Reset daily statistics"""
        today = datetime.now().date()
        if self.stats["start_date"] != today:
            self.stats = {
                "trades": 0,
                "wins": 0,
                "losses": 0,
                "profit": 0.0,
                "start_date": today,
                "last_trade_time": None,
                "consecutive_wins": 0,
                "consecutive_losses": 0,
                "current_risk_percent": TRADING_CONFIG.get("default_risk_percent", 1.0),
            }
    
    def run(self, symbols: List[str] = None, scan_interval: float = 1.0):
        """Main trading loop"""
        if symbols is None:
            symbols = list(SYMBOLS.keys())
        
        self.running = True
        self.reset_daily_stats()
        
        print(f"\n" + "="*50)
        print("🚀 SMART TRADING BOT STARTED")
        print("="*50)
        print(f"📊 Symbols: {', '.join(symbols)}")
        print(f"💰 Risk: {self.stats['current_risk_percent']}% | SL: {TRADING_CONFIG['default_sl_pips']}p | TP: {TRADING_CONFIG['default_tp_pips']}p")
        print(f"🛡️ Max Loss: ${RISK_CONFIG['max_daily_loss']} | Max DD: {RISK_CONFIG['max_drawdown_percent']}%")
        print(f"🎯 Max Trades: {TRADING_CONFIG['max_open_trades']} | Trailing: {TRADING_CONFIG['trailing_stop_enabled']}")
        print("="*50 + "\n")
        
        while self.running:
            try:
                # Reset daily
                self.reset_daily_stats()
                
                # Update news
                self.news_manager.update_news()
                
                # Check positions for TP/SL
                self.check_positions()
                
                # Check if can trade
                can_trade, reason = self.can_trade()
                if not can_trade:
                    if "loss" in reason.lower() or "reached" in reason.lower():
                        print(f"⏸️ {reason}")
                    time.sleep(scan_interval)
                    continue
                
                # Get open positions
                open_pos = self.get_open_positions()
                
                # If have winning positions, be more selective for new trades
                require_stronger = self.stats["consecutive_losses"] > 0
                
                # Scan for new opportunities
                for symbol in symbols:
                    # Skip if already have position
                    if any(p["symbol"] == symbol for p in open_pos):
                        continue
                    
                    # Skip if max positions reached
                    if len(open_pos) >= TRADING_CONFIG.get("max_open_trades", 3):
                        break
                    
                    # Analyze
                    analysis = self.analyze_market(symbol, require_stronger)
                    
                    if analysis["signal"] and analysis["confidence"] >= STRATEGY_CONFIG.get("min_confidence", 50):
                        # Open trade
                        self.open_trade(
                            symbol=symbol,
                            order_type=analysis["signal"],
                            sl_pips=TRADING_CONFIG.get("default_sl_pips", 20),
                            tp_pips=TRADING_CONFIG.get("default_tp_pips", 30)
                        )
                        time.sleep(1)  # Small delay
                
                time.sleep(scan_interval)
                
            except KeyboardInterrupt:
                print("\n🛑 Bot stopped by user")
                break
            except Exception as e:
                print(f"Error: {e}")
                time.sleep(scan_interval)
        
        self.running = False
    
    def get_status(self) -> dict:
        """Get bot status"""
        return {
            "connected": self.connected,
            "account_type": self.account_type,
            "running": self.running,
            "account": {
                "balance": self.account_info.balance if self.account_info else 0,
                "equity": self.account_info.equity if self.account_info else 0,
                "profit": self.account_info.profit if self.account_info else 0,
            },
            "positions": len(self.get_open_positions()),
            "stats": self.stats,
            "current_risk": self.stats["current_risk_percent"],
        }


# Flask API
from flask import Flask, jsonify, request, make_response

# Try to import CORS, if not available, we'll handle it manually
try:
    from flask_cors import CORS
    app = Flask(__name__)
    CORS(app)  # Enable CORS for all routes
except ImportError:
    # Fallback: Add CORS headers manually to all responses
    app = Flask(__name__)
    
    @app.after_request
    def add_cors_headers(response):
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response

trader = MT5SmartTrader()

@app.route('/api/status')
def status():
    return jsonify(trader.get_status())

@app.route('/api/connect', methods=['POST'])
def connect():
    data = request.json or {}
    account_type = data.get('account_type', 'demo')
    login = data.get('login')
    password = data.get('password')
    server = data.get('server')
    
    # If MT5 is already connected, just return success
    if trader.connected:
        return jsonify({"success": True, "message": "Already connected"})
    
    # Try to connect
    try:
        success = trader.connect(account_type, login, password, server)
        if success:
            return jsonify({"success": True})
        else:
            return jsonify({"success": False, "error": "Connection failed - make sure MT5 terminal is open and logged in"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/disconnect', methods=['POST'])
def disconnect():
    trader.disconnect()
    return jsonify({"success": True})

@app.route('/api/start', methods=['POST'])
def start():
    data = request.json or {}
    symbols = data.get('symbols', list(SYMBOLS.keys()))
    
    if not trader.connected:
        trader.connect()
    
    if trader.connected:
        thread = threading.Thread(target=trader.run, args=(symbols,))
        thread.daemon = True
        thread.start()
        return jsonify({"success": True})
    
    return jsonify({"success": False, "error": "Not connected"})

@app.route('/api/stop', methods=['POST'])
def stop():
    trader.running = False
    return jsonify({"success": True})

@app.route('/api/analysis/<symbol>')
def analyze(symbol):
    if not trader.connected:
        return jsonify({"error": "Not connected"})
    return jsonify(trader.analyze_market(symbol))

@app.route('/api/positions')
def positions():
    return jsonify(trader.get_open_positions())

@app.route('/api/close', methods=['POST'])
def close_position():
    data = request.json or {}
    ticket = data.get('ticket')
    if not ticket:
        return jsonify({"error": "Ticket required"}), 400
    
    success, profit = trader.close_trade(ticket)
    return jsonify({"success": success, "profit": profit})

@app.route('/api/order', methods=['POST'])
def open_position():
    """Open a new MT5 trade from the web UI/auto-trader."""
    if not trader.connected:
        return jsonify({"success": False, "error": "Not connected to MT5"}), 400

    data = request.json or {}
    symbol = data.get("symbol")
    order_type = data.get("type")
    volume = data.get("volume")
    sl_pips = data.get("sl_pips")
    tp_pips = data.get("tp_pips")

    if not symbol or order_type not in ("BUY", "SELL"):
        return jsonify({"success": False, "error": "symbol and type (BUY/SELL) are required"}), 400

    try:
        trade = trader.open_trade(
            symbol=symbol,
            order_type=order_type,
            lot=float(volume) if volume is not None else None,
            sl_pips=int(sl_pips) if sl_pips is not None else None,
            tp_pips=int(tp_pips) if tp_pips is not None else None,
        )
        if trade is None:
            return jsonify({"success": False, "error": "Trade rejected by risk/spread/MT5"}), 400
        return jsonify({"success": True, "trade": {
            "ticket": trade["ticket"],
            "symbol": trade["symbol"],
            "type": trade["type"],
            "volume": trade["volume"],
            "price": trade["price"],
            "sl": trade["sl"],
            "tp": trade["tp"],
            "open_time": trade["open_time"].isoformat(),
        }})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/prices')
def prices():
    """Get current prices for all symbols"""
    if not trader.connected:
        return jsonify({"error": "Not connected"})
    
    result = []
    for symbol in SYMBOLS.keys():
        info = trader.get_symbol_info(symbol)
        if info:
            result.append({
                "symbol": symbol,
                "bid": info["bid"],
                "ask": info["ask"],
                "spread": info["spread"],
            })
    return jsonify(result)

@app.route('/api/symbols')
def symbols():
    """Get available symbols"""
    return jsonify(list(SYMBOLS.keys()))


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--api":
        from config import API_HOST, API_PORT, MT5_DEMO
        
        # Auto-connect on API start
        print("Auto-connecting to MT5...")
        if trader.connect("demo"):
            print("✅ Auto-connected to MT5")
            # Start trading in background
            thread = threading.Thread(target=trader.run, args=(list(SYMBOLS.keys()), 1.0))
            thread.daemon = True
            thread.start()
            print("🚀 Auto-trading started")
        else:
            print("⚠️ Auto-connect failed - API available but MT5 not connected")
        
        print(f"Starting API on {API_HOST}:{API_PORT}")
        print(f"API: http://localhost:5000")
        app.run(host=API_HOST, port=API_PORT, debug=False)
    else:
        # Standalone
        trader = MT5SmartTrader()
        
        print("\n" + "="*50)
        print("META TRADER 5 SMART BOT")
        print("="*50)
        print("\nSelect account type:")
        print("1. Demo Account")
        print("2. Real Account")
        choice = input("Choice (1/2): ").strip()
        
        account_type = "demo" if choice == "1" else "real"
        
        if choice == "2":
            print("\nEnter your MT5 credentials:")
            try:
                login = int(input("Login (account number): "))
                password = input("Password: ")
                server = input("Server (e.g., ICMarkets-Demo): ")
            except:
                print("Invalid input, using demo")
                account_type = "demo"
                login = password = server = None
        else:
            login = password = server = None
        
        if trader.connect(account_type, login, password, server):
            try:
                trader.run()
            except KeyboardInterrupt:
                trader.disconnect()
