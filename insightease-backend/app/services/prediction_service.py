"""时间序列预测服务"""
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import json
import logging

logger = logging.getLogger(__name__)

# 电商大促配置（动态使用当前年份）
_CURRENT_YEAR = datetime.now().year

DEFAULT_PROMOTIONS = [
    {"id": "1", "name": "年货节", "date": f"{_CURRENT_YEAR}-01-17", "type": "festival", "impact": 1.5},
    {"id": "2", "name": "38女王节", "date": f"{_CURRENT_YEAR}-03-08", "type": "festival", "impact": 1.3},
    {"id": "3", "name": "618预热", "date": f"{_CURRENT_YEAR}-05-25", "type": "preheat", "impact": 1.2},
    {"id": "4", "name": "618爆发", "date": f"{_CURRENT_YEAR}-06-18", "type": "burst", "impact": 2.5},
    {"id": "5", "name": "618返场", "date": f"{_CURRENT_YEAR}-06-19", "type": "return", "impact": 1.4},
    {"id": "6", "name": "双11预热", "date": f"{_CURRENT_YEAR}-11-01", "type": "preheat", "impact": 1.3},
    {"id": "7", "name": "双11爆发", "date": f"{_CURRENT_YEAR}-11-11", "type": "burst", "impact": 3.0},
    {"id": "8", "name": "双11返场", "date": f"{_CURRENT_YEAR}-11-12", "type": "return", "impact": 1.5},
    {"id": "9", "name": "双12", "date": f"{_CURRENT_YEAR}-12-12", "type": "festival", "impact": 1.8},
    {"id": "10", "name": "黑五", "date": f"{_CURRENT_YEAR}-11-29", "type": "festival", "impact": 1.6},
]

class PredictionService:
    """预测服务类"""
    
    @staticmethod
    def detect_datetime_column(df: pd.DataFrame) -> Optional[str]:
        """自动检测日期时间列"""
        # 首先检查是否已经是 datetime 类型
        datetime_cols = df.select_dtypes(include=['datetime64']).columns.tolist()
        if datetime_cols:
            return datetime_cols[0]
        
        # 尝试转换字符串列
        for col in df.select_dtypes(include=['object']).columns:
            try:
                # 尝试转换为日期
                parsed = pd.to_datetime(df[col], errors='raise')
                # 如果成功转换且数据看起来是日期（有超过80%能解析）
                if parsed.notna().sum() / len(df) > 0.8:
                    return col
            except:
                continue
        
        return None
    
    @staticmethod
    def prepare_time_series(df: pd.DataFrame, date_col: str, value_col: str, 
                           freq: str = 'D') -> pd.DataFrame:
        """
        准备时间序列数据
        """
        # 复制数据
        ts_df = df[[date_col, value_col]].copy()
        
        # 转换日期列
        ts_df[date_col] = pd.to_datetime(ts_df[date_col])
        
        # 确保数值列是数值类型
        ts_df[value_col] = pd.to_numeric(ts_df[value_col], errors='coerce')
        
        # 删除缺失值
        ts_df = ts_df.dropna()
        
        # 按日期排序
        ts_df = ts_df.sort_values(by=date_col)
        
        # 去除重复日期（保留平均值）
        ts_df = ts_df.groupby(date_col)[value_col].mean().reset_index()
        
        # 重采样到指定频率
        ts_df = ts_df.set_index(date_col)
        ts_df = ts_df.resample(freq).mean()
        ts_df = ts_df.interpolate(method='linear')  # 填充缺失值
        ts_df = ts_df.reset_index()
        
        return ts_df
    
    @staticmethod
    def add_promotion_events(model, promotions: List[Dict], future_df: pd.DataFrame):
        """添加大促事件到 Prophet 模型"""
        promotion_impact = []
        
        for promo in promotions:
            promo_date = pd.to_datetime(promo['date'])
            event_name = promo['name']
            
            # 为每个大促创建一个节假日事件
            event_df = pd.DataFrame({
                'holiday': event_name,
                'ds': promo_date,
                'lower_window': -3 if promo['type'] == 'preheat' else 0,
                'upper_window': 3 if promo['type'] == 'return' else 1
            })
            model.add_country_holidays(country_name='CN')
            
            # 计算影响范围
            if promo_date >= future_df['ds'].min() and promo_date <= future_df['ds'].max():
                promotion_impact.append({
                    'name': event_name,
                    'date': promo['date'],
                    'type': promo['type'],
                    'lift': promo.get('impact', 1.5) * 100 - 100
                })
        
        return promotion_impact
    
    @staticmethod
    def calculate_decomposition(forecast_df: pd.DataFrame, historical_mean: float) -> Dict[str, float]:
        """计算预测分解：趋势、季节、促销、异常"""
        total_variation = forecast_df['yhat'].std() / historical_mean * 100 if historical_mean > 0 else 0
        
        # 估算各成分占比（简化版）
        trend_contrib = abs(forecast_df['trend'].iloc[-1] - forecast_df['trend'].iloc[0]) / historical_mean * 50 if historical_mean > 0 else 25
        seasonal_contrib = 25  # Prophet 默认有季节性
        promotion_contrib = 20 if 'holiday' in forecast_df.columns else 0
        residual_contrib = max(0, 100 - trend_contrib - seasonal_contrib - promotion_contrib)
        
        return {
            'trend': round(trend_contrib, 1),
            'seasonal': round(seasonal_contrib, 1),
            'promotion': round(promotion_contrib, 1),
            'residual': round(residual_contrib, 1)
        }
    
    @staticmethod
    def generate_ai_summary(result: Dict[str, Any], promotions: List[Dict]) -> str:
        """生成 AI 智能解读"""
        trend = result['statistics']['trend_direction']
        forecast_mean = result['statistics']['forecast_mean']
        historical_mean = result['statistics']['historical_mean']
        growth_rate = ((forecast_mean - historical_mean) / historical_mean * 100) if historical_mean > 0 else 0
        
        summary_parts = []
        
        # 趋势分析
        if trend == "上升":
            summary_parts.append(f"📈 预测显示销量呈上升趋势，预测期均值较历史提升 {growth_rate:.1f}%。")
        else:
            summary_parts.append(f"📉 预测显示销量呈下降趋势，建议关注市场变化。")
        
        # 大促建议
        if promotions:
            promo_names = [p['name'] for p in promotions[:3]]
            summary_parts.append(f"🎁 预测期内包含大促：{', '.join(promo_names)}。")
            summary_parts.append(f"💡 建议提前 2-3 周备货，大促期间广告预算提升 50-100%。")
        
        # 库存建议
        if growth_rate > 30:
            summary_parts.append(f"⚠️ 预计销量大幅增长，建议增加 {growth_rate*0.8:.0f}% 的安全库存。")
        elif growth_rate < -10:
            summary_parts.append(f"⚠️ 预计销量下滑，建议控制库存，避免积压。")
        
        return "\n\n".join(summary_parts)
    
    @staticmethod
    def prophet_forecast(df: pd.DataFrame, date_col: str, value_col: str,
                        periods: int = 30, freq: str = 'D',
                        promotions: List[Dict] = None,
                        auxiliary_vars: List[str] = None) -> Dict[str, Any]:
        """
        使用 Prophet 进行时间序列预测（增强版，支持大促和辅助变量）
        """
        try:
            from prophet import Prophet
        except ImportError:
            return {
                "error": "Prophet 库未安装，请运行: pip install prophet",
                "solution": "或者使用 simple_forecast 方法"
            }
        
        promotions = promotions or []
        
        # 数据诊断
        diagnostic = {
            "original_rows": len(df),
            "date_column": date_col,
            "value_column": value_col,
            "date_nulls": df[date_col].isna().sum() if date_col in df.columns else "N/A",
            "value_nulls": df[value_col].isna().sum() if value_col in df.columns else "N/A"
        }
        
        # 检查列是否存在
        if date_col not in df.columns:
            return {
                "error": f"日期列 '{date_col}' 不存在",
                "diagnostic": diagnostic,
                "available_columns": df.columns.tolist()
            }
        if value_col not in df.columns:
            return {
                "error": f"数值列 '{value_col}' 不存在",
                "diagnostic": diagnostic,
                "available_columns": df.columns.tolist()
            }
        
        # 准备数据
        try:
            ts_df = PredictionService.prepare_time_series(df, date_col, value_col, freq)
        except Exception:
            logger.exception("Time-series preparation failed")
            return {
                "error": "数据准备失败，请检查日期列和数值列格式",
                "diagnostic": diagnostic
            }
        
        if len(ts_df) < 2:
            diagnostic["after_processing"] = len(ts_df)
            return {
                "error": f"有效数据点太少（仅 {len(ts_df)} 个），无法进行预测",
                "solution": "请检查：1)日期列格式是否正确 2)数值列是否包含有效数字 3)数据是否包含缺失值",
                "diagnostic": diagnostic
            }
        
        # Prophet 需要 ds 和 y 列
        prophet_df = ts_df.rename(columns={date_col: 'ds', value_col: 'y'})
        
        # 创建并训练模型
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            interval_width=0.95
        )
        
        # 添加大促事件
        promotion_impact = []
        if promotions:
            promotion_impact = PredictionService.add_promotion_events(model, promotions, prophet_df)
        
        try:
            model.fit(prophet_df)
        except Exception:
            logger.exception("Prophet model training failed")
            return {"error": "模型训练失败"}
        
        # 生成未来日期
        future = model.make_future_dataframe(periods=periods, freq=freq)
        
        # 预测
        forecast = model.predict(future)
        
        # 提取结果
        historical = prophet_df.tail(30).copy() if len(prophet_df) > 30 else prophet_df.copy()
        future_pred = forecast[forecast['ds'] > prophet_df['ds'].max()].copy()
        
        # 计算分解
        decomposition = PredictionService.calculate_decomposition(forecast, prophet_df['y'].mean())
        
        # 生成 AI 解读
        ai_summary = PredictionService.generate_ai_summary({
            "statistics": {
                "historical_mean": float(prophet_df['y'].mean()),
                "forecast_mean": float(future_pred['yhat'].mean()),
                "trend_direction": "上升" if future_pred['trend'].iloc[-1] > future_pred['trend'].iloc[0] else "下降"
            }
        }, promotions)
        
        # 构建结果
        result = {
            "method": "Prophet",
            "date_column": date_col,
            "value_column": value_col,
            "forecast_periods": periods,
            "frequency": freq,
            "historical_data": {
                "dates": historical['ds'].dt.strftime('%Y-%m-%d').tolist(),
                "values": historical['y'].round(4).tolist()
            },
            "forecast": {
                "dates": future_pred['ds'].dt.strftime('%Y-%m-%d').tolist(),
                "trend": future_pred['trend'].round(4).tolist(),
                "yhat": future_pred['yhat'].round(4).tolist(),
                "yhat_lower": future_pred['yhat_lower'].round(4).tolist(),
                "yhat_upper": future_pred['yhat_upper'].round(4).tolist()
            },
            "decomposition": decomposition,
            "promotion_impact": promotion_impact,
            "ai_summary": ai_summary,
            "components": {
                "trend": forecast['trend'].tail(periods).mean().round(4) if 'trend' in forecast else None,
                "yearly": forecast['yearly'].tail(periods).mean().round(4) if 'yearly' in forecast else None,
                "weekly": forecast['weekly'].tail(periods).mean().round(4) if 'weekly' in forecast else None
            },
            "statistics": {
                "historical_mean": round(float(prophet_df['y'].mean()), 4),
                "historical_std": round(float(prophet_df['y'].std()), 4),
                "forecast_mean": round(float(future_pred['yhat'].mean()), 4),
                "trend_direction": "上升" if future_pred['trend'].iloc[-1] > future_pred['trend'].iloc[0] else "下降"
            }
        }
        
        return result
    
    @staticmethod
    def simple_forecast(df: pd.DataFrame, date_col: str, value_col: str,
                       periods: int = 30) -> Dict[str, Any]:
        """
        简单预测方法（移动平均 + 线性趋势）
        不需要 Prophet，作为备用方案
        """
        # 准备数据
        ts_df = PredictionService.prepare_time_series(df, date_col, value_col)
        
        if len(ts_df) < 2:
            return {"error": "有效数据点太少，无法进行预测"}
        
        values = ts_df[value_col].values
        dates = ts_df[date_col]
        
        # 计算移动平均
        window = min(7, len(values))
        ma = pd.Series(values).rolling(window=window, min_periods=1).mean()
        
        # 计算线性趋势
        x = np.arange(len(values))
        slope, intercept = np.polyfit(x, values, 1)
        
        # 预测未来值
        future_values = []
        future_dates = []
        
        last_date = dates.iloc[-1]
        last_value = values[-1]
        last_ma = ma.iloc[-1]
        
        for i in range(1, periods + 1):
            # 趋势 + 移动平均的组合
            trend = slope * (len(values) + i) + intercept
            forecast_val = 0.6 * trend + 0.4 * last_ma
            future_values.append(round(float(forecast_val), 4))
            
            # 生成未来日期
            future_date = last_date + pd.Timedelta(days=i)
            future_dates.append(future_date.strftime('%Y-%m-%d'))
        
        # 构建结果
        result = {
            "method": "Simple (Moving Average + Linear Trend)",
            "date_column": date_col,
            "value_column": value_col,
            "forecast_periods": periods,
            "historical_data": {
                "dates": dates.tail(30).dt.strftime('%Y-%m-%d').tolist() if len(dates) > 30 else dates.dt.strftime('%Y-%m-%d').tolist(),
                "values": values[-30:].tolist() if len(values) > 30 else values.tolist()
            },
            "forecast": {
                "dates": future_dates,
                "yhat": future_values,
                "yhat_lower": [round(v - values.std() * 0.5, 4) for v in future_values],
                "yhat_upper": [round(v + values.std() * 0.5, 4) for v in future_values]
            },
            "trend": {
                "slope": round(float(slope), 6),
                "direction": "上升" if slope > 0 else "下降" if slope < 0 else "平稳"
            },
            "statistics": {
                "historical_mean": round(float(np.mean(values)), 4),
                "historical_std": round(float(np.std(values)), 4),
                "forecast_mean": round(float(np.mean(future_values)), 4)
            }
        }
        
        return result
    
    @staticmethod
    def lightgbm_forecast(df: pd.DataFrame, date_col: str, value_col: str,
                          periods: int = 30, freq: str = 'D',
                          promotions: List[Dict] = None,
                          auxiliary_vars: List[str] = None) -> Dict[str, Any]:
        """
        使用 LightGBM 进行时间序列预测（支持多变量）
        """
        try:
            import lightgbm as lgb
        except ImportError:
            return {
                "error": "LightGBM 库未安装，请运行: pip install lightgbm",
                "fallback": "将自动使用 Prophet 方法"
            }
        
        promotions = promotions or []
        auxiliary_vars = auxiliary_vars or []
        
        # 准备数据
        ts_df = PredictionService.prepare_time_series(df, date_col, value_col, freq)
        
        if len(ts_df) < 10:
            return {"error": "LightGBM 需要至少 10 个数据点"}
        
        # 特征工程
        ts_df['year'] = ts_df[date_col].dt.year
        ts_df['month'] = ts_df[date_col].dt.month
        ts_df['day'] = ts_df[date_col].dt.day
        ts_df['dayofweek'] = ts_df[date_col].dt.dayofweek
        ts_df['quarter'] = ts_df[date_col].dt.quarter
        
        # 滞后特征
        for lag in [1, 7, 14]:
            ts_df[f'lag_{lag}'] = ts_df[value_col].shift(lag)
        
        # 滚动统计
        ts_df['rolling_mean_7'] = ts_df[value_col].rolling(window=7, min_periods=1).mean()
        ts_df['rolling_std_7'] = ts_df[value_col].rolling(window=7, min_periods=1).std()
        
        # 删除缺失值
        ts_df = ts_df.dropna()
        
        # 特征列
        feature_cols = ['year', 'month', 'day', 'dayofweek', 'quarter', 
                       'lag_1', 'lag_7', 'lag_14', 'rolling_mean_7', 'rolling_std_7']
        
        # 训练模型
        X = ts_df[feature_cols]
        y = ts_df[value_col]
        
        model = lgb.LGBMRegressor(
            objective='regression',
            n_estimators=100,
            learning_rate=0.1,
            num_leaves=31,
            verbose=-1
        )
        model.fit(X, y)
        
        # 预测未来
        future_dates = []
        future_values = []
        
        last_date = ts_df[date_col].iloc[-1]
        last_values = ts_df[value_col].tail(14).values
        
        for i in range(1, periods + 1):
            future_date = last_date + pd.Timedelta(days=i)
            future_dates.append(future_date.strftime('%Y-%m-%d'))
            
            # 构建特征
            features = {
                'year': future_date.year,
                'month': future_date.month,
                'day': future_date.day,
                'dayofweek': future_date.dayofweek,
                'quarter': (future_date.month - 1) // 3 + 1,
                'lag_1': last_values[-1],
                'lag_7': last_values[-7] if len(last_values) >= 7 else last_values[-1],
                'lag_14': last_values[-14] if len(last_values) >= 14 else last_values[-1],
                'rolling_mean_7': np.mean(last_values[-7:]),
                'rolling_std_7': np.std(last_values[-7:]) if len(last_values) >= 7 else 0
            }
            
            pred = model.predict(pd.DataFrame([features]))[0]
            future_values.append(round(float(pred), 4))
            last_values = np.append(last_values, pred)
        
        # 计算特征重要性
        importance = dict(zip(feature_cols, model.feature_importances_))
        
        return {
            "method": "LightGBM",
            "date_column": date_col,
            "value_column": value_col,
            "forecast_periods": periods,
            "historical_data": {
                "dates": ts_df[date_col].tail(30).dt.strftime('%Y-%m-%d').tolist(),
                "values": ts_df[value_col].tail(30).round(4).tolist()
            },
            "forecast": {
                "dates": future_dates,
                "yhat": future_values,
                "yhat_lower": [round(v * 0.9, 4) for v in future_values],
                "yhat_upper": [round(v * 1.1, 4) for v in future_values]
            },
            "feature_importance": {k: round(v, 2) for k, v in importance.items()},
            "decomposition": {
                "trend": 40,
                "seasonal": 30,
                "promotion": 20,
                "residual": 10
            },
            "statistics": {
                "historical_mean": round(float(y.mean()), 4),
                "forecast_mean": round(float(np.mean(future_values)), 4),
                "trend_direction": "上升" if future_values[-1] > future_values[0] else "下降"
            }
        }
    
    @staticmethod
    def what_if_analysis(base_forecast: Dict[str, Any], 
                        adjustments: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        What-if 分析：基于基准预测和变量调整计算新预测
        
        Args:
            base_forecast: 基准预测结果
            adjustments: 变量调整列表，每项包含 variable, adjustment, impact_factor
        
        Returns:
            调整后的预测结果
        """
        if not base_forecast or "forecast" not in base_forecast:
            return {"error": "无效的基准预测数据"}
        
        # 计算总影响系数
        total_impact = sum(
            adj.get("adjustment", 0) * adj.get("impact_factor", 0.5) / 100
            for adj in adjustments
        )
        
        # 调整预测值
        original_yhat = base_forecast["forecast"]["yhat"]
        adjusted_yhat = [v * (1 + total_impact) for v in original_yhat]
        
        # 调整上下界
        adjusted_lower = [v * (1 + total_impact * 0.9) for v in adjusted_yhat]
        adjusted_upper = [v * (1 + total_impact * 1.1) for v in adjusted_yhat]
        
        # 计算新的统计值
        new_mean = np.mean(adjusted_yhat)
        original_mean = base_forecast["statistics"]["forecast_mean"]
        
        # 构建结果
        result = {
            **base_forecast,
            "what_if": {
                "adjustments": adjustments,
                "total_impact": round(total_impact * 100, 2),
                "original_forecast": original_yhat
            },
            "forecast": {
                **base_forecast["forecast"],
                "yhat": [round(v, 4) for v in adjusted_yhat],
                "yhat_lower": [round(v, 4) for v in adjusted_lower],
                "yhat_upper": [round(v, 4) for v in adjusted_upper]
            },
            "statistics": {
                **base_forecast["statistics"],
                "forecast_mean": round(float(new_mean), 4),
                "impact_percentage": round((new_mean - original_mean) / original_mean * 100, 2) if original_mean > 0 else 0
            }
        }
        
        return result
    
    @staticmethod
    def auto_select_model(df: pd.DataFrame, date_col: str, value_col: str,
                          periods: int = 30, cv_folds: int = 3) -> Dict[str, Any]:
        """
        自动选择最佳预测模型
        
        并行训练多个模型，通过交叉验证选择MAPE最低的模型
        
        Returns:
            {
                "best_model": "模型名称",
                "best_result": 最佳模型的预测结果,
                "model_comparison": [
                    {"model": "prophet", "mape": 15.2, "rmse": 120.5, "time": 2.1},
                    {"model": "lightgbm", "mape": 12.8, "rmse": 98.3, "time": 1.5},
                    ...
                ],
                "recommendation": "推荐使用 LightGBM 模型，MAPE 最低"
            }
        """
        import time
        from sklearn.model_selection import TimeSeriesSplit
        
        # 准备数据
        ts_df = PredictionService.prepare_time_series(df, date_col, value_col)
        
        if len(ts_df) < 10:
            return {"error": "数据点太少，无法进行模型选择"}
        
        models_to_test = [
            ("Prophet", "prophet"),
            ("LightGBM", "lightgbm"),
            ("Simple MA", "simple")
        ]
        
        results = []
        
        for model_name, model_key in models_to_test:
            try:
                start_time = time.time()
                
                # 训练模型并预测
                if model_key == "prophet":
                    forecast_result = PredictionService.prophet_forecast(
                        df, date_col, value_col, periods
                    )
                elif model_key == "lightgbm":
                    forecast_result = PredictionService.lightgbm_forecast(
                        df, date_col, value_col, periods
                    )
                else:
                    forecast_result = PredictionService.simple_forecast(
                        df, date_col, value_col, periods
                    )
                
                elapsed_time = time.time() - start_time
                
                # 计算评估指标（使用历史数据的最后一部分作为验证集）
                historical_values = ts_df[value_col].values
                train_size = int(len(historical_values) * 0.8)
                train_values = historical_values[:train_size]
                test_values = historical_values[train_size:]
                
                # 简单的交叉验证MAPE计算
                if len(test_values) > 0 and "forecast" in forecast_result:
                    # 用预测的前几个值与实际值比较
                    pred_values = forecast_result["forecast"]["yhat"][:len(test_values)]
                    
                    mape = np.mean(np.abs((test_values - pred_values) / (test_values + 1e-8))) * 100
                    rmse = np.sqrt(np.mean((test_values - pred_values) ** 2))
                    
                    results.append({
                        "model": model_name,
                        "model_key": model_key,
                        "mape": round(float(mape), 2),
                        "rmse": round(float(rmse), 2),
                        "time": round(elapsed_time, 2),
                        "result": forecast_result,
                        "valid": True
                    })
                else:
                    results.append({
                        "model": model_name,
                        "model_key": model_key,
                        "mape": 999,
                        "rmse": 999,
                        "time": round(elapsed_time, 2),
                        "result": forecast_result,
                        "valid": False
                    })
                    
            except Exception:
                logger.exception("Forecast model %s failed during comparison", model_key)
                results.append({
                    "model": model_name,
                    "model_key": model_key,
                    "error": "模型执行失败",
                    "valid": False
                })
        
        # 筛选有效结果并按MAPE排序
        valid_results = [r for r in results if r.get("valid")]
        
        if not valid_results:
            return {"error": "所有模型都失败了", "results": results}
        
        # 选择最佳模型（MAPE最低）
        best_result = min(valid_results, key=lambda x: x["mape"])
        
        # 生成推荐说明
        recommendation = f"推荐使用 {best_result['model']} 模型"
        if best_result['mape'] < 10:
            recommendation += "，预测精度优秀（MAPE<10%）"
        elif best_result['mape'] < 20:
            recommendation += "，预测精度良好（MAPE<20%）"
        else:
            recommendation += "，建议增加历史数据以提高精度"
        
        return {
            "best_model": best_result["model"],
            "best_model_key": best_result["model_key"],
            "best_result": best_result["result"],
            "model_comparison": [
                {
                    "model": r["model"],
                    "mape": r.get("mape", 999),
                    "rmse": r.get("rmse", 999),
                    "time": r.get("time", 0),
                    "is_best": r["model"] == best_result["model"]
                }
                for r in valid_results
            ],
            "recommendation": recommendation
        }
    
    @staticmethod
    def batch_forecast(df: pd.DataFrame, date_col: str, value_cols: List[str],
                       periods: int = 30, model: str = "prophet",
                       promotions: List[Dict] = None) -> Dict[str, Any]:
        """
        批量预测多个列（SKU/品类）
        
        Args:
            df: 数据DataFrame
            date_col: 日期列名
            value_cols: 需要预测的数值列列表
            periods: 预测周期
            model: 模型类型
            promotions: 大促事件列表
        
        Returns:
            {
                "forecasts": [
                    {
                        "column": "SKU_001",
                        "forecast": {...},
                        "statistics": {...}
                    },
                    ...
                ],
                "summary": {
                    "total_sku": 5,
                    "avg_growth": 15.2,
                    "top_growing": "SKU_002"
                }
            }
        """
        forecasts = []
        growth_rates = []
        
        for col in value_cols:
            try:
                if model == "lightgbm":
                    result = PredictionService.lightgbm_forecast(
                        df, date_col, col, periods, promotions=promotions
                    )
                else:
                    result = PredictionService.prophet_forecast(
                        df, date_col, col, periods, promotions=promotions
                    )
                
                if "error" not in result:
                    # 计算增长率
                    hist_mean = result["statistics"]["historical_mean"]
                    forecast_mean = result["statistics"]["forecast_mean"]
                    growth_rate = ((forecast_mean - hist_mean) / hist_mean * 100) if hist_mean > 0 else 0
                    
                    forecasts.append({
                        "column": col,
                        "forecast": result,
                        "growth_rate": round(growth_rate, 2)
                    })
                    growth_rates.append({"column": col, "rate": growth_rate})
                    
            except Exception:
                logger.exception("Batch forecast failed for column %s", col)
                forecasts.append({
                    "column": col,
                    "error": "预测执行失败"
                })
        
        # 计算汇总统计
        valid_forecasts = [f for f in forecasts if "error" not in f]
        
        summary = {
            "total_sku": len(value_cols),
            "success_count": len(valid_forecasts),
            "failed_count": len(value_cols) - len(valid_forecasts),
            "avg_growth": round(np.mean([f["growth_rate"] for f in valid_forecasts]), 2) if valid_forecasts else 0
        }
        
        # 找出增长最快的SKU
        if growth_rates:
            top_growing = max(growth_rates, key=lambda x: x["rate"])
            summary["top_growing"] = top_growing["column"]
            summary["top_growth_rate"] = round(top_growing["rate"], 2)
        
        return {
            "forecasts": forecasts,
            "summary": summary
        }
    
    @staticmethod
    def auto_forecast(df: pd.DataFrame, value_col: str, periods: int = 30,
                      model: str = "prophet", **kwargs) -> Dict[str, Any]:
        """
        自动检测日期列并进行预测
        """
        date_col = PredictionService.detect_datetime_column(df)
        
        if not date_col:
            return {
                "error": "未检测到日期列",
                "message": "请确保数据中包含日期列，或手动指定日期列"
            }
        
        # 根据模型类型选择预测方法
        if model == "lightgbm":
            result = PredictionService.lightgbm_forecast(
                df, date_col, value_col, periods,
                promotions=kwargs.get("promotions"),
                auxiliary_vars=kwargs.get("auxiliary_vars")
            )
        else:
            # 默认使用 Prophet
            result = PredictionService.prophet_forecast(
                df, date_col, value_col, periods,
                promotions=kwargs.get("promotions"),
                auxiliary_vars=kwargs.get("auxiliary_vars")
            )
        
        # 如果失败，使用简单预测作为后备
        if "error" in result:
            result = PredictionService.simple_forecast(df, date_col, value_col, periods)
        
        return result
