"""
Performance Monitor
Track and analyze trading performance
"""

import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any
import json
from pathlib import Path


class PerformanceMonitor:
    """Monitor and analyze trading performance"""
    
    def __init__(self):
        self.trades: List[Dict] = []
        self.equity_curve: List[float] = []
        
    def add_trade(self, trade: Dict):
        """Add a completed trade to the record"""
        self.trades.append(trade)
        
    def get_stats(self, days: int = 30) -> Dict[str, Any]:
        """Get performance statistics"""
        if not self.trades:
            return {
                "total_trades": 0,
                "win_rate": 0,
                "total_profit": 0,
                "avg_profit": 0,
            }
        
        # Filter by date
        cutoff = datetime.now() - timedelta(days=days)
        recent_trades = [
            t for t in self.trades 
            if datetime.fromisoformat(t.get('close_time', '2020-01-01')) > cutoff
        ]
        
        wins = sum(1 for t in recent_trades if t.get('profit', 0) > 0)
        total = len(recent_trades)
        
        return {
            "total_trades": total,
            "winning_trades": wins,
            "losing_trades": total - wins,
            "win_rate": (wins / total * 100) if total > 0 else 0,
            "total_profit": sum(t.get('profit', 0) for t in recent_trades),
            "avg_profit": sum(t.get('profit', 0) for t in recent_trades) / total if total > 0 else 0,
            "best_trade": max((t.get('profit', 0) for t in recent_trades), default=0),
            "worst_trade": min((t.get('profit', 0) for t in recent_trades), default=0),
        }
    
    def generate_report(self, days: int = 30):
        """Generate a performance report"""
        stats = self.get_stats(days)
        
        report = f"""
╔═══════════════════════════════════════════════════════════╗
║            PERFORMANCE REPORT - Last {days} Days                ║
╠═══════════════════════════════════════════════════════════╣
║  Total Trades:     {stats['total_trades']:<35}║
║  Winning Trades:   {stats['winning_trades']:<35}║
║  Losing Trades:   {stats['losing_trades']:<35}║
║  Win Rate:        {stats['win_rate']:.1f}%{' '*32}║
╠═══════════════════════════════════════════════════════════╣
║  Total Profit:    ${stats['total_profit']:<34}║
║  Average Profit:  ${stats['avg_profit']:<34}║
║  Best Trade:      ${stats['best_trade']:<34}║
║  Worst Trade:     ${stats['worst_trade']:<34}║
╚═══════════════════════════════════════════════════════════╝
        """
        
        print(report)
        return stats
    
    def save_to_file(self, filename: str = "reports/performance.json"):
        """Save trade history to file"""
        Path(filename).parent.mkdir(exist_ok=True)
        
        with open(filename, 'w') as f:
            json.dump(self.trades, f, indent=2)
        
        print(f"Performance data saved to {filename}")
    
    def load_from_file(self, filename: str = "reports/performance.json"):
        """Load trade history from file"""
        if Path(filename).exists():
            with open(filename, 'r') as f:
                self.trades = json.load(f)
