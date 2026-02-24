#!/usr/bin/env python3
"""
ML-SuperTrend Advanced Bot Runner
Usage: python run_advanced_bot.py
"""

import sys
import argparse
import logging
from datetime import datetime

# Load .env so MT5_LOGIN, MT5_PASSWORD, MT5_SERVER are used automatically
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Import MT5
try:
    import MetaTrader5 as mt5
except ImportError:
    print("Error: MetaTrader5 module not found")
    print("Please install: pip install MetaTrader5")
    sys.exit(1)

from core.advanced_trading_bot import AdvancedTradingBot, BotConfig, StrategyConfig


def setup_logging():
    """Setup logging"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(f'logs/bot_{datetime.now().strftime("%Y%m%d")}.log'),
            logging.StreamHandler()
        ]
    )


def load_config_from_env():
    """Load configuration from environment or use defaults"""
    import os
    
    return BotConfig(
        login=int(os.getenv('MT5_LOGIN', '0') or 0),
        password=os.getenv('MT5_PASSWORD', ''),
        server=os.getenv('MT5_SERVER', 'MetaQuotes-Demo'),
        symbols=os.getenv('MT5_SYMBOLS', 'EURUSD,GBPUSD').split(','),
        timeframe=int(os.getenv('MT5_TIMEFRAME', '16385')),  # M30
        strategies=[StrategyConfig(
            name="Advanced",
            min_strength=float(os.getenv('MIN_STRENGTH', '60')),
            risk_percent=float(os.getenv('RISK_PERCENT', '1.0')),
            max_positions=int(os.getenv('MAX_POSITIONS', '2')),
            use_trailing=True,
            use_partial_close=True,
            partial_close_percent=50,
            partial_close_at_profit=2.0,
            move_to_breakeven_at=1.5,
            trailing_start_at=2.0,
        )],
        news_filter_enabled=True,
        max_spread=float(os.getenv('MAX_SPREAD', '3.0')),
        max_daily_loss=float(os.getenv('MAX_DAILY_LOSS', '5.0')),
        max_daily_trades=int(os.getenv('MAX_DAILY_TRADES', '10')),
    )


def main():
    parser = argparse.ArgumentParser(description='ML-SuperTrend Advanced Bot')
    parser.add_argument('--login', type=int, help='MT5 Login')
    parser.add_argument('--password', type=str, help='MT5 Password')
    parser.add_argument('--server', type=str, help='MT5 Server')
    parser.add_argument('--symbols', type=str, default='EURUSD', help='Trading symbols (comma separated)')
    parser.add_argument('--risk', type=float, default=1.0, help='Risk percent per trade')
    parser.add_argument('--interval', type=int, default=60, help='Update interval in seconds')
    parser.add_argument('--dry-run', action='store_true', help='Dry run mode')
    
    args = parser.parse_args()
    
    setup_logging()
    
    # Create config
    config = load_config_from_env()
    
    # Override with command line args
    if args.login:
        config.login = args.login
    if args.password:
        config.password = args.password
    if args.server:
        config.server = args.server
    if args.symbols:
        config.symbols = [s.strip() for s in args.symbols.split(',')]
    if args.risk:
        config.strategies[0].risk_percent = args.risk
    
    print("=" * 60)
    print("ML-SuperTrend Advanced Trading Bot")
    print("=" * 60)
    print(f"Symbols: {', '.join(config.symbols)}")
    print(f"Risk: {config.strategies[0].risk_percent}%")
    print(f"Max Positions: {config.strategies[0].max_positions}")
    print(f"Update Interval: {args.interval} seconds")
    print("=" * 60)
    
    if args.dry_run:
        print("DRY RUN MODE - No real trades will be placed")
    
    # Create and run bot
    bot = AdvancedTradingBot(config)
    
    if bot.connect():
        bot.start(interval=args.interval)
    else:
        print("Failed to connect to MT5!")
        print("Please check:")
        print("1. MT5 Terminal is running")
        print("2. Login credentials are correct")
        print("3. Internet connection is active")
        sys.exit(1)


if __name__ == "__main__":
    main()
