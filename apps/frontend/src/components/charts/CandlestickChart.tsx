// ============================================================
// Lightweight Charts (TradingView) Candlestick Component
// ============================================================
import React, { useEffect, useRef } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
} from 'lightweight-charts';

interface CandleData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

interface SignalMarker {
  time: number;
  direction: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit: number;
}

interface CandlestickChartProps {
  candles: CandleData[];
  signals?: SignalMarker[];
  height?: number;
}

export function CandlestickChart({ candles, signals = [], height = 400 }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#999999',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        vertLine: { color: '#333333', width: 1, style: 2 },
        horzLine: { color: '#333333', width: 1, style: 2 },
      },
      timeScale: {
        borderColor: '#262626',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#262626',
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height]);

  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    // Filter and sort unique ascending candles
    const sorted = [...candles]
      .sort((a, b) => a.time - b.time)
      .filter((v, i, a) => i === 0 || v.time > a[i - 1].time);

    candleSeriesRef.current.setData(sorted as any);

    // Apply markers
    if (signals.length > 0) {
      const markers = signals.map((s) => ({
        time: s.time as any,
        position: s.direction === 'LONG' ? ('belowBar' as const) : ('aboveBar' as const),
        color: s.direction === 'LONG' ? '#22c55e' : '#ef4444',
        shape: s.direction === 'LONG' ? ('arrowUp' as const) : ('arrowDown' as const),
        text: `${s.direction} @ ${s.entry}`,
      }));
      candleSeriesRef.current.setMarkers(markers);
    }
  }, [candles, signals]);

  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-card)',
        overflow: 'hidden',
      }}
    >
      <div ref={chartContainerRef} style={{ width: '100%' }} />
    </div>
  );
}
