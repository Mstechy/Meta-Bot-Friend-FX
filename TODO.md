# TODO List - MetaTrader 5 Bot Enhancement

## Phase 1: Remove Lovable References ✅
- [x] 1.1 Update index.html - Remove Lovable meta tags, update title to "MetaTrader 5 Bot"
- [x] 1.2 Update vite.config.ts - Remove lovable-tagger plugin
- [x] 1.3 Remove lovable-tagger from package.json

## Phase 2: Install Real MT5 API ✅
- [x] 2.1 Install MT5 connector packages (meta-api)
- [x] 2.2 Create MT5 connection service (src/lib/mt5Connection.ts)
- [ ] 2.3 Update tradingData.ts to use real MT5 data

## Phase 3: Enhance Risk Management ✅
- [x] 3.1 Add max daily loss limit
- [x] 3.2 Add maximum drawdown protection
- [x] 3.3 Add volatility-adjusted position sizing (ATR-based)
- [ ] 3.4 Add correlation-based position sizing
- [x] 3.5 Add session-based trading limits

## Phase 4: Improve Trading Strategy ✅
- [x] 4.1 Create technical indicators library (src/lib/indicators.ts)
- [x] 4.2 Add multiple strategy support (Trend, Mean Reversion, Breakout, Momentum)
- [ ] 4.3 Add multi-timeframe analysis
- [ ] 4.4 Add news filter

## Phase 5: Testing
- [x] 5.1 Install dependencies
- [ ] 5.2 Test local development server
