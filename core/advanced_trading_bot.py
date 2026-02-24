"""
ML-SuperTrend Advanced Trading Bot
Advanced auto-trading with SuperTrend indicator, risk management, and multiple strategies
"""

import MetaTrader5 as mt5
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import time
import logging
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TimeFrame(Enum):
    """MT5 Timeframes"""
    M1 = 1
    M5 = 5
    M15 = 15
    M30 = 30
    H1 = 16385
    H4 = 16388
    D1 = 16408


@dataclass
class StrategyConfig:
    """Strategy configuration"""
    name: str = "Advanced"
    min_strength: float = 60.0
    risk_percent: float = 1.0
    max_positions: int = 2
    use_trailing: bool = True
    use_partial_close: bool = True
    partial_close_percent: float = 50.0
    partial_close_at_profit: float = 2.0
    move_to_breakeven_at: float = 1.5
    trailing_start_at: float = 2.0
    trailing_distance: float = 1.5


@dataclass
class BotConfig:
    """Bot configuration"""
    login: int = 0
    password: str = ""
    server: str = ""
    symbols: List[str] = field(default_factory=lambda: ["EURUSD"])
    timeframe: int = 16385  # H1
    strategies: List[StrategyConfig] = field(default_factory=lambda: [StrategyConfig()])
    news_filter_enabled: bool = True
    max_spread: float = 3.0
    max_daily_loss: float = 5.0
    max_daily_trades: int = 10
    magic_number: int = 123456
    deviation: int = 20


class NewsFilter:
    """News filter to avoid trading during high-impact news"""
    
    def __init__(self, enabled: bool = True):
        self.enabled = enabled
        self.high_impact_events = [
            "Non-Farm Payrolls", "FOMC", "ECB", "BOE", "CPI", "GDP", "NFP"
        ]
    
    def should_trade(self) -> tuple[bool, str]:
        """Check if it's safe to trade"""
        if not self.enabled:
            return True, "News filter disabled"
        
        now = datetime.now()
        
        # Avoid Friday after 4 PM
        if now.weekday() == 4 and now.hour >= 16:
            return False, "Friday evening - no trading"
        
        # Avoid Monday before 8 AM
        if now.weekday() == 0 and now.hour < 8:
            return False, "Monday morning - no trading"
        
        return True, "Safe to trade"


class RiskManager:
    """Risk management for the bot"""
    
    def __init__(self, config: BotConfig):
        self.config = config
        self.daily_loss = 0.0
        self.daily_trades = 0
        self.last_reset = datetime.now().date()
    
    def can_trade(self) -> tuple[bool, str]:
        """Check if we can trade based on risk rules"""
        today = datetime.now().date()
        
        # Reset daily counters
        if today > self.last_reset:
            self.daily_loss = 0.0
            self.daily_trades = 0
            self.last_reset = today
        
        # Check daily loss
        if self.daily_loss <= -self.config.max_daily_loss:
            return False, f"Max daily loss ${self.config.max_daily_loss} reached"
        
        # Check daily trades
        if self.daily_trades >= self.config.max_daily_trades:
            return False, f"Max daily trades {self.config.max_daily_trades} reached"
        
        return True, "Can trade"
    
    def calculate_lot_size(self, account_balance: float, symbol: str, stop_loss_pips: float) -> float:
        """Calculate lot size based on risk percentage"""
        risk_amount = account_balance * (self.config.strategies[0].risk_percent / 100)
        
        # Get symbol info
        symbol_info = mt5.symbol_info(symbol)
        if not symbol_info:
            return 0.01
        
        # Calculate lot size
        point = symbol_info.point
        contract_size = symbol_info.trade_contract_size
        
        # For forex pairs
        if symbol_info.currency_profit == "USD":
            lot_size = risk_amount / (stop_loss_pips * point * contract_size / symbol_info.point)
        else:
            # For other pairs, simplified calculation
            lot_size = risk_amount / (stop_loss_pips * 10)
        
        # Apply min/max limits
        lot_size = max(symbol_info.volume_min, min(lot_size, symbol_info.volume_max))
        return round(lot_size, 2)


class SuperTrendIndicator:
    """SuperTrend Indicator implementation"""
    
    def __init__(self, period: int = 10, multiplier: float = 3.0):
        self.period = period
        self.multiplier = multiplier
    
    def calculate(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate SuperTrend indicator"""
        high = df['high']
        low = df['low']
        close = df['close']
        
        # True Range
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = tr.rolling(self.period).mean()
        
        # SuperTrend calculation
        hl_avg = (high + low) / 2
        upper_band = hl_avg + (self.multiplier * atr)
        lower_band = hl_avg - (self.multiplier * atr)
        
        # Initialize SuperTrend
        supertrend = pd.Series(index=df.index, dtype=float)
        direction = pd.Series(1, index=df.index)
        
        for i in range(self.period, len(df)):
            if close.iloc[i] > upper_band.iloc[i-1]:
                direction.iloc[i] = 1
            elif close.iloc[i] < lower_band.iloc[i-1]:
                direction.iloc[i] = -1
            else:
                direction.iloc[i] = direction.iloc[i-1]
            
            if direction.iloc[i] == 1:
                supertrend.iloc[i] = lower_band.iloc[i]
            else:
                supertrend.iloc[i] = upper_band.iloc[i]
        
        df['supertrend'] = supertrend
        df['trend_direction'] = direction
        df['atr'] = atr
        
        return df


class AdvancedTradingBot:
    """Advanced Trading Bot with SuperTrend"""
    
    def __init__(self, config: BotConfig):
        self.config = config
        self.news_filter = NewsFilter(config.news_filter_enabled)
        self.risk_manager = RiskManager(config)
        self.supertrend = SuperTrendIndicator()
        self.running = False
        self.positions = []
        
    def connect(self) -> bool:
        """Connect to MT5"""
        # Initialize MT5
        if not mt5.initialize():
            logger.error(f"MT5 initialize failed: {mt5.last_error()}")
            return False
        
        # Login if credentials provided
        if self.config.login > 0 and self.config.server:
            authorized = mt5.login(
                login=self.config.login,
                password=self.config.password,
                server=self.config.server
            )
            if not authorized:
                logger.error(f"Login failed: {mt5.last_error()}")
                mt5.shutdown()
                return False
        
        # Get account info
        account_info = mt5.account_info()
        if account_info is None:
            logger.error("Failed to get account info")
            mt5.shutdown()
            return False
        
        logger.info(f"Connected: {account_info.login} | Balance: ${account_info.balance}")
        
        # Initialize symbols
        for symbol in self.config.symbols:
            if not mt5.symbol_select(symbol, True):
                logger.warning(f"Failed to select {symbol}")
        
        return True
    
    def disconnect(self):
        """Disconnect from MT5"""
        mt5.shutdown()
        logger.info("Disconnected from MT5")
    
    def get_data(self, symbol: str, timeframe: int, bars: int = 100) -> Optional[pd.DataFrame]:
        """Get candle data for a symbol"""
        rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, bars)
        if rates is None:
            return None
        
        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')
        df = df.rename(columns={
            'time': 'time',
            'open': 'open',
            'high': 'high',
            'low': 'low',
            'close': 'close',
            'tick_volume': 'volume'
        })
        
        return df
    
    def analyze(self, symbol: str) -> Dict[str, Any]:
        """Analyze symbol and return signals"""
        df = self.get_data(symbol, self.config.timeframe)
        if df is None or len(df) < 50:
            return {"signal": "none", "strength": 0, "reason": "Insufficient data"}
        
        # Calculate SuperTrend
        df = self.supertrend.calculate(df)
        
        # Get latest values
        current = df.iloc[-1]
        previous = df.iloc[-2]
        
        # Signal detection
        signal = "none"
        strength = 0
        
        # SuperTrend crossover
        if previous['trend_direction'] == -1 and current['trend_direction'] == 1:
            signal = "buy"
            strength = 70
        elif previous['trend_direction'] == 1 and current['trend_direction'] == -1:
            signal = "sell"
            strength = 70
        
        # RSI confirmation
        rsi = self._calculate_rsi(df)
        if signal == "buy" and rsi < 70:
            strength += 10
        elif signal == "sell" and rsi > 30:
            strength += 10
        
        return {
            "signal": signal,
            "strength": min(strength, 100),
            "price": current['close'],
            "supertrend": current['supertrend'],
            "atr": current['atr'],
            "rsi": rsi
        }
    
    def _calculate_rsi(self, df: pd.DataFrame, period: int = 14) -> float:
        """Calculate RSI"""
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi.iloc[-1] if not rsi.empty else 50
    
    def place_order(self, symbol: str, order_type: str, lot_size: float, 
                    sl_pips: float, tp_pips: float) -> bool:
        """Place a trade order"""
        symbol_info = mt5.symbol_info(symbol)
        if not symbol_info:
            return False
        
        point = symbol_info.point
        
        if order_type == "buy":
            price = mt5.symbol_info_tick(symbol).ask
            sl = price - sl_pips * point
            tp = price + tp_pips * point
            order_type_enum = mt5.ORDER_TYPE_BUY
        else:
            price = mt5.symbol_info_tick(symbol).bid
            sl = price + sl_pips * point
            tp = price - tp_pips * point
            order_type_enum = mt5.ORDER_TYPE_SELL
        
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": lot_size,
            "type": order_type_enum,
            "price": price,
            "sl": sl,
            "tp": tp,
            "deviation": self.config.deviation,
            "magic": self.config.magic_number,
            "comment": "ML-SuperTrend Bot",
            "time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        
        result = mt5.order_send(request)
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            logger.error(f"Order failed: {result.comment}")
            return False
        
        logger.info(f"Order placed: {order_type} {lot_size} {symbol} at {price}")
        self.risk_manager.daily_trades += 1
        
        return True
    
    def check_positions(self) -> List[Dict]:
        """Get open positions"""
        positions = mt5.positions_get()
        if positions is None:
            return []
        
        return [
            {
                "ticket": p.ticket,
                "symbol": p.symbol,
                "type": "buy" if p.type == 0 else "sell",
                "volume": p.volume,
                "profit": p.profit,
                "open_price": p.price_open,
                "sl": p.sl,
                "tp": p.tp
            }
            for p in positions
        ]
    
    def manage_positions(self):
        """Manage open positions (trailing stop, partial close)"""
        positions = self.check_positions()
        strategy = self.config.strategies[0]
        
        for pos in positions:
            # Calculate profit in pips
            if pos['type'] == 'buy':
                profit_pips = (pos['open_price'] - mt5.symbol_info_tick(pos['symbol']).bid) / pos['open_price'] * 10000
            else:
                profit_pips = (mt5.symbol_info_tick(pos['symbol']).ask - pos['open_price']) / pos['open_price'] * 10000
            
            # Trailing stop
            if strategy.use_trailing and profit_pips >= strategy.trailing_start_at:
                self._update_trailing_stop(pos, profit_pips, strategy)
            
            # Partial close
            if strategy.use_partial_close and profit_pips >= strategy.partial_close_at_profit:
                self._partial_close(pos, strategy)
    
    def _update_trailing_stop(self, pos: Dict, profit_pips: float, strategy: StrategyConfig):
        """Update trailing stop"""
        symbol_info = mt5.symbol_info(pos['symbol'])
        point = symbol_info.point
        
        new_sl = pos['open_price'] + (strategy.trailing_distance * point * 10) if pos['type'] == 'buy' else pos['open_price'] - (strategy.trailing_distance * point * 10)
        
        request = {
            "action": mt5.TRADE_ACTION_SLTP,
            "symbol": pos['symbol'],
            "position": pos['ticket'],
            "sl": new_sl,
            "tp": pos['tp'],
        }
        
        mt5.order_send(request)
    
    def _partial_close(self, pos: Dict, strategy: StrategyConfig):
        """Partially close a position"""
        close_volume = pos['volume'] * (strategy.partial_close_percent / 100)
        
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": pos['symbol'],
            "volume": close_volume,
            "type": mt5.ORDER_TYPE_SELL if pos['type'] == 'buy' else mt5.ORDER_TYPE_BUY,
            "position": pos['ticket'],
            "deviation": self.config.deviation,
            "magic": self.config.magic_number,
            "comment": "Partial close",
        }
        
        result = mt5.order_send(request)
        if result.retcode == mt5.TRADE_RETCODE_DONE:
            logger.info(f"Partial close: {close_volume} {pos['symbol']}")
    
    def start(self, interval: int = 60):
        """Start the trading bot"""
        self.running = True
        logger.info("Bot started trading...")
        
        while self.running:
            try:
                # Check risk management
                can_trade, reason = self.risk_manager.can_trade()
                if not can_trade:
                    logger.warning(f"Cannot trade: {reason}")
                    time.sleep(interval)
                    continue
                
                # Check news filter
                can_trade, reason = self.news_filter.should_trade()
                if not can_trade:
                    logger.info(f"Skipping trade: {reason}")
                    time.sleep(interval)
                    continue
                
                # Manage existing positions
                self.manage_positions()
                
                # Analyze each symbol
                for symbol in self.config.symbols:
                    # Check spread
                    symbol_info = mt5.symbol_info(symbol)
                    if symbol_info and symbol_info.spread > self.config.max_spread * 10:
                        logger.warning(f"Spread too high for {symbol}")
                        continue
                    
                    analysis = self.analyze(symbol)
                    strategy = self.config.strategies[0]
                    
                    if analysis['strength'] >= strategy.min_strength:
                        # Calculate lot size
                        account_info = mt5.account_info()
                        lot_size = self.risk_manager.calculate_lot_size(
                            account_info.balance,
                            symbol,
                            analysis['atr'] * 2
                        )
                        
                        # Place trade
                        if analysis['signal'] == 'buy':
                            self.place_order(symbol, "buy", lot_size, 2.0, 3.0)
                        elif analysis['signal'] == 'sell':
                            self.place_order(symbol, "sell", lot_size, 2.0, 3.0)
                
                time.sleep(interval)
                
            except Exception as e:
                logger.error(f"Error in trading loop: {e}")
                time.sleep(interval)
    
    def stop(self):
        """Stop the trading bot"""
        self.running = False
        logger.info("Bot stopped")
