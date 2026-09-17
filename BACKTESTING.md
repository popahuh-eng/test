# Backtesting Methodology & Assumptions

## 1. Simulation Mechanics

The `BacktestEngine` (`apps/backend/src/backtest/BacktestEngine.ts`) implements realistic event-driven backtesting on historic candle ticks.

### A. Execution Delay (No Instant Fills)
When an AI signal is generated at the close of candle $T$:
- Entry does **not** execute at $\text{close}[T]$.
- Instead, execution occurs at the **$\text{open}[T+1]$** of the subsequent candle.

### B. Slippage & Spread Modeling
- For a `LONG` order:
  $$\text{Executed Entry} = \text{Open} \times (1 + \text{slippage})$$
- For a `SHORT` order:
  $$\text{Executed Entry} = \text{Open} \times (1 - \text{slippage})$$

### C. Commissions & Fees
Every executed order (both entry and exit) incurs broker commission:
$$\text{Fee} = \text{Price} \times \text{Position Size} \times \text{Commission Rate}$$

### D. Intra-Bar Stop Loss / Take Profit
Within each subsequent candle $[T+k]$:
- If $\text{Low} \le \text{Stop Loss}$, position is closed at Stop Loss.
- If $\text{High} \ge \text{Take Profit}$, position is closed at Take Profit.

---

## 2. Computed Performance Metrics

- **Net PnL**: Total realized profit or loss after subtracting all fees and simulated slippage.
- **Win Rate**: Percentage of executed trades that finished with positive net PnL.
- **Profit Factor**: Gross profits divided by gross losses.
- **Max Drawdown**: Peak-to-trough percentage decline in portfolio balance.
- **Sharpe Ratio**: Annualized return per unit of volatility:
  $$\text{Sharpe} = \frac{\mu_{\text{returns}}}{\sigma_{\text{returns}}} \times \sqrt{252}$$
- **Equity Curve**: Time-series progression of balance after every candle.
