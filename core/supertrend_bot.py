"""
ML-SuperTrend Bot
SuperTrend-based trading bot with machine learning optimization
"""

import MetaTrader5 as mt5
import pandas as pd
import numpy as np
from datetime import datetime
import time
import logging
from dataclasses import dataclass
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


@dataclass
class Config:
    """Bot configuration"""
    symbol: str = "EURUSD"
    timeframe: int = mt5.TIMEFRAME_M30
    atr_period: int = 10
    min_factor: float = 1.0
    max_factor: float = 3.0
    factor_step: float = 0.5
    perf_alpha: float = 0.1
    cluster_choice: int = 0
    volume_ma_period: int = 20
    volume_multiplier: float = 1.5
    sl_multiplier: float = 1.5
    tp_multiplier: float = 3.0
    use_trailing: bool = True
    trail_activation: float = 1.5
    risk_percent: float = 1.0
    max_positions: int = 2


class SuperTrendBot:
    """SuperTrend Trading Bot"""
    
    def __init__(self, config: Config):
        self.config = config
        self.is_connected = False
        self.dry_run = False
        self.positions: List[Dict] = []
        self.best_factor = (config.min_factor + config.max_factor) / 2
        
    def calculate_supertrend(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate SuperTrend indicator"""
        high = df['high']
        low = df['low']
        close = df['close']
        
        # ATR calculation
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = tr.rolling(self.config.atr_period).mean()
        
        # SuperTrend calculation
        hl_avg = (high + low) / 2
        upper_band = hl_avg + (self.best_factor * atr)
        lower_band = hl_avg - (self.best_factor * atr)
        
        # Direction
        direction = pd.Series(1, index=df.index)
        
        for i in range(self.config.atr_period, len(df)):
            if close.iloc[i] > upper_band.iloc[i-1]:
                direction.iloc[i] = 1
            elif close.iloc[i] < lower_band.iloc[i-1]:
                direction.iloc[i] = -1
            else:
                direction.iloc[i] = direction.iloc[i-1]
        
        df['supertrend'] = lower_band.where(direction == 1, upper_band)
        df['direction'] = direction
        df['atr'] = atr
        
        return df
    
    def calculate_volume_ma(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate Volume Moving Average"""
        df['volume_ma'] = df['tick_volume'].rolling(self.config.volume_ma_period).mean()
        return df
    
    def get_data(self, bars: int = 100) -> Optional[pd.DataFrame]:
        """Get price data"""
        rates = mt5.copy_rates_from_pos(self.config.symbol, self.config.timeframe, 0, bars)
        if rates is None:
            return None
        
        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')
        
        return df
    
    def analyze(self) -> Dict[str, Any]:
        """Analyze market and generate signal"""
        df = self.get_data()
        if df is None or len(df) < 50:
            return {"signal": "none", "strength": 0}
        
        # Calculate indicators
        df = self.calculate_supertrend(df)
        df = self.calculate_volume_ma(df)
        
        current = df.iloc[-1]
        previous = df.iloc[-2]
        
        # Signal detection
        signal = "none"
        strength = 0
        
        # Volume check
        volume_ok = current['tick_volume'] > (current['volume_ma'] * self.config.volume_multiplier)
        
        # SuperTrend crossover
        if previous['direction'] == -1 and current['direction'] == 1 and volume_ok:
            signal = "buy"
            strength = 70
        elif previous['direction'] == 1 and current['direction'] == -1 and volume_ok:
            signal = "sell"
            strength = 70
        
        return {
            "signal": signal,
            "strength": strength,
            "price": current['close'],
            "supertrend": current['supertrend'],
            "atr": current['atr'],
            "direction": current['direction']
        }
    
    def calculate_lot_size(self, stop_loss_pips: float) -> float:
        """Calculate lot size based on risk"""
        account_info = mt5.account_info()
        if account_info is None:
            return 0.01
        
        risk_amount = account_info.balance * (self.config.risk_percent / 100)
        
        symbol_info = mt5.symbol_info(self.config.symbol)
        if symbol_info is None:
            return 0.01
        
        point = symbol_info.point
        lot_size = risk_amount / (stop_loss_pips * point * symbol_info.trade_contract_size)
        
        return round(max(symbol_info.volume_min, min(lot_size, symbol_info.volume_max)), 2)
    
    def place_order(self, order_type: str) -> bool:
        """Place a trade order"""
        if self.dry_run:
            logger.info(f"[DRY RUN] Would place {order_type} order")
            return True
        
        symbol_info = mt5.symbol_info(self.config.symbol)
        if symbol_info is None:
            return False
        
        tick = mt5.symbol_info_tick(self.config.symbol)
        point = symbol_info.point
        
        if order_type == "buy":
            price = tick.ask
            sl = price - (self.config.sl_multiplier * self.config.atr_period * point)
            tp = price + (self.config.tp_multiplier * self.config.atr_period * point)
            order_type_enum = mt5.ORDER_TYPE_BUY
        else:
            price = tick.bid
            sl = price + (self.config.sl_multiplier * self.config.atr_period * point)
            tp = price - (self.config.tp_multiplier * self.config.atr_period * point)
            order_type_enum = mt5.ORDER_TYPE_SELL
        
        lot_size = self.calculate_lot_size(self.config.sl_multiplier * self.config.atr_period)
        
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": self.config.symbol,
            "volume": lot_size,
            "type": order_type_enum,
            "price": price,
            "sl": sl,
            "tp": tp,
            "deviation": 20,
            "magic": 123456,
            "comment": "SuperTrend Bot",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        
        result = mt5.order_send(request)
        
        if result.retcode == mt5.TRADE_RETCODE_DONE:
            logger.info(f"Order placed: {order_type} {lot_size} {self.config.symbol}")
            return True
        
        logger.error(f"Order failed: {result.comment}")
        return False
    
    def get_positions(self) -> List[Dict]:
        """Get open positions"""
        positions = mt5.positions_get(symbol=self.config.symbol)
        if positions is None:
            return []
        
        return [
            {
                "ticket": p.ticket,
                "type": "buy" if p.type == 0 else "sell",
                "volume": p.volume,
                "profit": p.profit,
                "open_price": p.price_open,
            }
            for p in positions
        ]
    
    def manage_trailing_stop(self):
        """Manage trailing stops"""
        if not self.config.use_trailing:
            return
        
        positions = self.get_positions()
        if not positions:
            return
        
        for pos in positions:
            current_price = mt5.symbol_info_tick(self.config.symbol).bid if pos['type'] == 'buy' else mt5.symbol_info_tick(self.config.symbol).ask
            pnl_pips = (current_price - pos['open_price']) / mt5.symbol_info(self.config.symbol).point
            
            if pnl_pips >= self.config.trail_activation * self.config.atr_period:
                # Update trailing stop
                new_sl = pos['open_price'] + (0.5 * self.config.atr_period * mt5.symbol_info(self.config.symbol).point) if pos['type'] == 'buy' else pos['open_price'] - (0.5 * self.config.atr_period * mt5.symbol_info(self.config.symbol).point)
                
                request = {
                    "action": mt5.TRADE_ACTION_SLTP,
                    "symbol": self.config.symbol,
                    "position": pos['ticket'],
                    "sl": new_sl,
                }
                mt5.order_send(request)
    
    def run(self, interval_seconds: int = 30):
        """Run the trading bot"""
        logger.info("Starting SuperTrend Bot...")
        
        while True:
            try:
                # Check positions
                self.positions = self.get_positions()
                
                if len(self.positions) < self.config.max_positions:
                    # Analyze market
                    analysis = self.analyze()
                    
                    if analysis['strength'] >= 60:
                        if analysis['signal'] == 'buy':
                            self.place_order('buy')
                        elif analysis['signal'] == 'sell':
                            self.place_order('sell')
                
                # Manage trailing stops
                self.manage_trailing_stop()
                
                time.sleep(interval_seconds)
                
            except Exception as e:
                logger.error(f"Error in trading loop: {e}")
                time.sleep(interval_seconds)
