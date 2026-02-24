import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, LineStyle } from "lightweight-charts";
import { generateCandleData, Position } from "@/lib/tradingData";

interface TradingChartProps {
  symbol: string;
  positions?: Position[];
}

function calcSMA(data: { close: number; time: number }[], period: number) {
  const result: { time: number; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

function calcEMA(data: { close: number; time: number }[], period: number) {
  const result: { time: number; value: number }[] = [];
  const k = 2 / (period + 1);
  let ema = data[0].close;
  for (let i = 0; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    if (i >= period - 1) result.push({ time: data[i].time, value: ema });
  }
  return result;
}

function calcRSI(data: { close: number; time: number }[], period: number = 14) {
  const result: { time: number; value: number }[] = [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result.push({ time: data[period].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) });
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    result.push({ time: data[i].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) });
  }
  return result;
}

function calcBollingerBands(data: { close: number; time: number }[], period: number = 20, mult: number = 2) {
  const upper: { time: number; value: number }[] = [];
  const lower: { time: number; value: number }[] = [];
  const middle: { time: number; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    const mean = sum / period;
    let variance = 0;
    for (let j = 0; j < period; j++) variance += Math.pow(data[i - j].close - mean, 2);
    const stdDev = Math.sqrt(variance / period);
    middle.push({ time: data[i].time, value: mean });
    upper.push({ time: data[i].time, value: mean + mult * stdDev });
    lower.push({ time: data[i].time, value: mean - mult * stdDev });
  }
  return { upper, middle, lower };
}

function calcMACD(data: { close: number; time: number }[], fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(data, fast);
  const emaSlow = calcEMA(data, slow);
  const slowTimes = new Set(emaSlow.map((d) => d.time));
  const alignedFast = emaFast.filter((d) => slowTimes.has(d.time));
  const macdLine: { time: number; value: number; close: number }[] = [];
  for (let i = 0; i < emaSlow.length; i++) {
    const f = alignedFast.find((d) => d.time === emaSlow[i].time);
    if (f) macdLine.push({ time: emaSlow[i].time, value: f.value - emaSlow[i].value, close: f.value - emaSlow[i].value });
  }
  const signalLine = calcEMA(macdLine, signal);
  const signalTimes = new Map(signalLine.map((d) => [d.time, d.value]));
  const histogram = macdLine
    .filter((d) => signalTimes.has(d.time))
    .map((d) => ({ time: d.time, value: d.value - signalTimes.get(d.time)!, color: d.value - signalTimes.get(d.time)! >= 0 ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)" }));
  return { macdLine: macdLine.map(({ time, value }) => ({ time, value })), signalLine, histogram };
}

const TradingChart = ({ symbol, positions = [] }: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [timeframe, setTimeframe] = useState("H1");
  const [indicators, setIndicators] = useState({ sma20: true, ema50: true, rsi: false, bb: false, macd: false });

  const timeframes = ["M1", "M5", "M15", "H1", "H4", "D1", "W1"];

  const toggleIndicator = (key: keyof typeof indicators) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const charts: IChartApi[] = [];

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#171c28" },
        textColor: "#7a8599",
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: { vertLines: { color: "#1e2433" }, horzLines: { color: "#1e2433" } },
      crosshair: {
        vertLine: { color: "#22c55e", width: 1, style: 2 },
        horzLine: { color: "#22c55e", width: 1, style: 2 },
      },
      rightPriceScale: { borderColor: "#252d3d" },
      timeScale: { borderColor: "#252d3d", timeVisible: true },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });
    charts.push(chart);

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#22c55e", downColor: "#ef4444",
      borderDownColor: "#ef4444", borderUpColor: "#22c55e",
      wickDownColor: "#ef4444", wickUpColor: "#22c55e",
    });

    const volumeSeries = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "" });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    const data = generateCandleData(symbol);
    candleSeries.setData(data as any);
    volumeSeries.setData(
      data.map((d) => ({ time: d.time, value: d.volume, color: d.close >= d.open ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)" })) as any
    );

    // === Position lines (Entry, SL, TP) ===
    const symbolPositions = positions.filter((p) => p.symbol === symbol);
    for (const pos of symbolPositions) {
      // Entry line
      candleSeries.createPriceLine({
        price: pos.openPrice,
        color: "#3b82f6",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${pos.type} ${pos.volume} @ ${pos.openPrice}`,
      });

      // Stop Loss line
      if (pos.stopLoss != null) {
        candleSeries.createPriceLine({
          price: pos.stopLoss,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `SL ${pos.stopLoss}`,
        });
      }

      // Take Profit line
      if (pos.takeProfit != null) {
        candleSeries.createPriceLine({
          price: pos.takeProfit,
          color: "#22c55e",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TP ${pos.takeProfit}`,
        });
      }
    }

    // SMA 20
    if (indicators.sma20) {
      const s = chart.addLineSeries({ color: "#3b82f6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      s.setData(calcSMA(data, 20) as any);
    }
    // EMA 50
    if (indicators.ema50) {
      const s = chart.addLineSeries({ color: "#f59e0b", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      s.setData(calcEMA(data, 50) as any);
    }
    // Bollinger Bands
    if (indicators.bb) {
      const bb = calcBollingerBands(data);
      const upper = chart.addLineSeries({ color: "rgba(168,85,247,0.6)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const lower = chart.addLineSeries({ color: "rgba(168,85,247,0.6)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const mid = chart.addLineSeries({ color: "rgba(168,85,247,0.3)", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
      upper.setData(bb.upper as any);
      lower.setData(bb.lower as any);
      mid.setData(bb.middle as any);
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    // RSI sub-chart
    if (indicators.rsi && rsiContainerRef.current) {
      const rsiChart = createChart(rsiContainerRef.current, {
        layout: { background: { type: ColorType.Solid, color: "#171c28" }, textColor: "#7a8599", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" },
        grid: { vertLines: { color: "#1e2433" }, horzLines: { color: "#1e2433" } },
        rightPriceScale: { borderColor: "#252d3d" },
        timeScale: { visible: false },
        width: rsiContainerRef.current.clientWidth,
        height: rsiContainerRef.current.clientHeight,
      });
      charts.push(rsiChart);
      const rsiSeries = rsiChart.addLineSeries({ color: "#a855f7", lineWidth: 1, priceLineVisible: false });
      rsiSeries.setData(calcRSI(data) as any);
      const ob = rsiChart.addLineSeries({ color: "rgba(239,68,68,0.3)", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
      const os = rsiChart.addLineSeries({ color: "rgba(34,197,94,0.3)", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
      const rsiData = calcRSI(data);
      ob.setData(rsiData.map((d) => ({ time: d.time, value: 70 })) as any);
      os.setData(rsiData.map((d) => ({ time: d.time, value: 30 })) as any);
      rsiChart.timeScale().fitContent();
    }

    // MACD sub-chart
    if (indicators.macd && macdContainerRef.current) {
      const macdChart = createChart(macdContainerRef.current, {
        layout: { background: { type: ColorType.Solid, color: "#171c28" }, textColor: "#7a8599", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" },
        grid: { vertLines: { color: "#1e2433" }, horzLines: { color: "#1e2433" } },
        rightPriceScale: { borderColor: "#252d3d" },
        timeScale: { visible: false },
        width: macdContainerRef.current.clientWidth,
        height: macdContainerRef.current.clientHeight,
      });
      charts.push(macdChart);
      const macd = calcMACD(data);
      const macdLineSeries = macdChart.addLineSeries({ color: "#3b82f6", lineWidth: 1, priceLineVisible: false });
      const signalSeries = macdChart.addLineSeries({ color: "#f59e0b", lineWidth: 1, priceLineVisible: false });
      const histSeries = macdChart.addHistogramSeries({ priceScaleId: "" });
      histSeries.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });
      macdLineSeries.setData(macd.macdLine as any);
      signalSeries.setData(macd.signalLine as any);
      histSeries.setData(macd.histogram as any);
      macdChart.timeScale().fitContent();
    }

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
      }
      if (indicators.rsi && rsiContainerRef.current && charts[1]) {
        charts[1].applyOptions({ width: rsiContainerRef.current.clientWidth, height: rsiContainerRef.current.clientHeight });
      }
      if (indicators.macd && macdContainerRef.current) {
        const idx = indicators.rsi ? 2 : 1;
        if (charts[idx]) charts[idx].applyOptions({ width: macdContainerRef.current.clientWidth, height: macdContainerRef.current.clientHeight });
      }
    };

    window.addEventListener("resize", handleResize);

    const interval = setInterval(() => {
      const lastCandle = data[data.length - 1];
      const isGold = symbol === "XAUUSD";
      const isJPY = symbol.includes("JPY");
      const volatility = isGold ? 2 : isJPY ? 0.05 : 0.001;
      const newClose = lastCandle.close + (Math.random() - 0.5) * volatility;
      const decimals = isGold ? 2 : isJPY ? 3 : 5;
      const factor = Math.pow(10, decimals);
      lastCandle.close = Math.round(newClose * factor) / factor;
      lastCandle.high = Math.max(lastCandle.high, lastCandle.close);
      lastCandle.low = Math.min(lastCandle.low, lastCandle.close);
      candleSeries.update(lastCandle as any);
    }, 1000);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(interval);
      charts.forEach((c) => c.remove());
    };
  }, [symbol, timeframe, indicators, positions]);

  const hasSubChart = indicators.rsi || indicators.macd;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border flex-wrap">
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
              timeframe === tf ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {tf}
          </button>
        ))}
        <span className="w-px h-4 bg-border mx-1" />
        {[
          { key: "sma20" as const, label: "SMA20", color: "#3b82f6" },
          { key: "ema50" as const, label: "EMA50", color: "#f59e0b" },
          { key: "bb" as const, label: "BB", color: "#a855f7" },
          { key: "rsi" as const, label: "RSI", color: "#a855f7" },
          { key: "macd" as const, label: "MACD", color: "#3b82f6" },
        ].map((ind) => (
          <button
            key={ind.key}
            onClick={() => toggleIndicator(ind.key)}
            className={`px-2 py-1 text-[10px] font-mono rounded transition-colors border ${
              indicators[ind.key] ? "border-current opacity-100" : "border-transparent opacity-50 hover:opacity-75"
            }`}
            style={{ color: ind.color }}
          >
            {ind.label}
          </button>
        ))}
      </div>
      <div ref={chartContainerRef} className={`min-h-0 ${hasSubChart ? "flex-[3]" : "flex-1"}`} />
      {indicators.rsi && (
        <div className="border-t border-border">
          <div className="px-3 py-0.5 text-[9px] font-mono text-muted-foreground bg-secondary/30">RSI (14)</div>
          <div ref={rsiContainerRef} className="h-20" />
        </div>
      )}
      {indicators.macd && (
        <div className="border-t border-border">
          <div className="px-3 py-0.5 text-[9px] font-mono text-muted-foreground bg-secondary/30">MACD (12,26,9)</div>
          <div ref={macdContainerRef} className="h-20" />
        </div>
      )}
    </div>
  );
};

export default TradingChart;
