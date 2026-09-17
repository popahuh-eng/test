# Machine Learning Pipeline & Causal Modeling

## 1. Zero Look-Ahead Bias Guarantee

In financial ML, look-ahead bias and data leakage render models artificially profitable in backtests while failing disastrously in production.

This platform enforces **zero look-ahead bias** through three architectural rules:

1. **Temporal Horizon Strictness**:
   For training label at index $T$ with prediction horizon $H$:
   $$\text{future\_return} = \frac{\text{close}[T + H] - \text{close}[T]}{\text{close}[T]}$$
   The final $H$ candles in any dataset evaluate to `NaN` labels and are strictly discarded prior to training.
2. **Causal Feature Computations**:
   Any indicator (SMA, EMA, RSI, MACD, ATR, ADX) at candle $T$ only accesses slices $\le T$.
   Verified by `apps/ml/tests/test_no_leakage.py`.
3. **Release Flagging for Macro Events**:
   Macro events (e.g. Non-Farm Payrolls, CPI) keep their `actual` figures masked until the publication timestamp has elapsed.

---

## 2. Supervised Models

### Direction Model (`apps/ml/src/models/direction_model.py`)
- **Algorithm**: `XGBClassifier` wrapped with `CalibratedClassifierCV`.
- **Target**:
  $$y_T = \begin{cases} +1 & \text{if } \text{future\_return} > +(\text{threshold} \times \text{ATR}) \\ -1 & \text{if } \text{future\_return} < -(\text{threshold} \times \text{ATR}) \\ 0 & \text{otherwise (Neutral)} \end{cases}$$
- **Outputs**: Calibrated probabilities: $P(\text{UP})$, $P(\text{DOWN})$, $P(\text{NEUTRAL})$.

### Volatility Model (`apps/ml/src/models/volatility_model.py`)
- **Algorithm**: `XGBRegressor`.
- **Target**: Realized volatility over the next $H$ periods.

### Market Regime Model (`apps/ml/src/models/regime_model.py`)
- **Classes**: `TREND_UP`, `TREND_DOWN`, `RANGE`, `HIGH_VOLATILITY`, `LOW_VOLATILITY`.
- **Methodology**: Hybrid rule-based trend-strength (ADX + EMA slope) and ML refinement.

---

## 3. Training & Validation Strategy

- **Temporal Splits**: Chronological $70\%$ train, $15\%$ validation, $15\%$ test. Never randomized!
- **Model Registry**: Every trained model is saved with hyperparameters, feature versions, validation metrics, and an active toggle in the `model_versions` database table.
