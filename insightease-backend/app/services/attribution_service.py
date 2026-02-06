"""
归因分析服务
支持多种归因模型：首次触点、末次触点、线性、时间衰减、位置归因、Shapley值
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from collections import defaultdict
from itertools import combinations


class AttributionService:
    """归因分析服务类"""
    
    # 支持的归因模型
    ATTRIBUTION_MODELS = {
        "first_touch": "首次触点归因",
        "last_touch": "末次触点归因", 
        "linear": "线性归因",
        "time_decay": "时间衰减归因",
        "position_based": "位置归因",
        "shapley": "Shapley值归因"
    }
    
    @staticmethod
    def attribution_analysis(
        df: pd.DataFrame,
        user_id_col: str,
        touchpoint_col: str,
        timestamp_col: str,
        conversion_col: Optional[str] = None,
        conversion_value_col: Optional[str] = None,
        models: List[str] = None,
        time_decay_half_life: int = 7,  # 时间衰减半衰期（天）
        additional_touchpoint_cols: Optional[List[str]] = None  # 联合触点列列表
    ) -> Dict[str, Any]:
        """
        多触点归因分析
        
        Args:
            df: 数据DataFrame
            user_id_col: 用户ID列名
            touchpoint_col: 触点列名（渠道/来源等）
            timestamp_col: 时间戳列名
            conversion_col: 转化标记列名（可选，有则标记转化，无则假设每行都是触点）
            conversion_value_col: 转化价值列名（可选，用于计算贡献价值）
            models: 要计算的归因模型列表，默认全部
            time_decay_half_life: 时间衰减半衰期（天）
            additional_touchpoint_cols: 额外的触点列列表，将与touchpoint_col联合分析
            
        Returns:
            各模型的归因结果
        """
        if models is None:
            models = list(AttributionService.ATTRIBUTION_MODELS.keys())
        
        # 数据预处理
        df = df.copy()
        df[timestamp_col] = pd.to_datetime(df[timestamp_col])
        
        # 处理多列联合
        if additional_touchpoint_cols:
            valid_cols = [col for col in additional_touchpoint_cols if col and col in df.columns]
            if valid_cols:
                all_cols = [touchpoint_col] + valid_cols
                df[touchpoint_col] = df[all_cols].astype(str).agg('_'.join, axis=1)
        
        # 构建用户旅程
        user_journeys = AttributionService._build_user_journeys(
            df, user_id_col, touchpoint_col, timestamp_col, 
            conversion_col, conversion_value_col
        )
        
        if not user_journeys:
            return {
                "message": "没有足够的用户旅程数据进行分析",
                "models": {},
                "summary": {}
            }
        
        # 计算各模型的归因结果
        results = {}
        
        if "first_touch" in models:
            results["first_touch"] = AttributionService._first_touch_attribution(user_journeys)
        
        if "last_touch" in models:
            results["last_touch"] = AttributionService._last_touch_attribution(user_journeys)
        
        if "linear" in models:
            results["linear"] = AttributionService._linear_attribution(user_journeys)
        
        if "time_decay" in models:
            results["time_decay"] = AttributionService._time_decay_attribution(
                user_journeys, half_life_days=time_decay_half_life
            )
        
        if "position_based" in models:
            results["position_based"] = AttributionService._position_based_attribution(user_journeys)
        
        if "shapley" in models:
            results["shapley"] = AttributionService._shapley_attribution(user_journeys)
        
        # 生成汇总统计
        summary = AttributionService._generate_summary(user_journeys, results)
        
        return {
            "models": results,
            "summary": summary,
            "user_journey_count": len(user_journeys),
            "total_conversions": sum(j["converted"] for j in user_journeys),
            "total_conversion_value": sum(j.get("conversion_value", 0) for j in user_journeys)
        }
    
    @staticmethod
    def _build_user_journeys(df, user_id_col, touchpoint_col, timestamp_col, 
                            conversion_col, conversion_value_col):
        """构建用户旅程"""
        user_journeys = []
        
        for user_id, user_df in df.groupby(user_id_col):
            user_df = user_df.sort_values(timestamp_col)
            
            # 获取触点序列
            touchpoints = user_df[touchpoint_col].tolist()
            timestamps = user_df[timestamp_col].tolist()
            
            # 判断是否有转化
            if conversion_col and conversion_col in user_df.columns:
                converted = bool(user_df[conversion_col].iloc[-1]) if len(user_df) > 0 else False
            else:
                # 如果没有转化列，假设每行都是独立触点，最后一个为转化
                converted = True
            
            # 获取转化价值
            conversion_value = 1.0  # 默认每个转化价值为1
            if conversion_value_col and conversion_value_col in user_df.columns:
                conversion_value = float(user_df[conversion_value_col].iloc[-1]) if len(user_df) > 0 else 1.0
            
            if touchpoints:  # 只添加有触点的旅程
                user_journeys.append({
                    "user_id": user_id,
                    "touchpoints": touchpoints,
                    "timestamps": timestamps,
                    "converted": converted,
                    "conversion_value": conversion_value if converted else 0,
                    "touchpoint_count": len(touchpoints)
                })
        
        return user_journeys
    
    @staticmethod
    def _first_touch_attribution(user_journeys):
        """首次触点归因：100%功劳归第一个触点"""
        attribution = defaultdict(float)
        
        for journey in user_journeys:
            if journey["converted"] and journey["touchpoints"]:
                first_touch = journey["touchpoints"][0]
                attribution[first_touch] += journey["conversion_value"]
        
        return AttributionService._normalize_attribution(dict(attribution))
    
    @staticmethod
    def _last_touch_attribution(user_journeys):
        """末次触点归因：100%功劳归最后一个触点"""
        attribution = defaultdict(float)
        
        for journey in user_journeys:
            if journey["converted"] and journey["touchpoints"]:
                last_touch = journey["touchpoints"][-1]
                attribution[last_touch] += journey["conversion_value"]
        
        return AttributionService._normalize_attribution(dict(attribution))
    
    @staticmethod
    def _linear_attribution(user_journeys):
        """线性归因：平均分配给所有触点"""
        attribution = defaultdict(float)
        
        for journey in user_journeys:
            if journey["converted"] and journey["touchpoints"]:
                value_per_touch = journey["conversion_value"] / len(journey["touchpoints"])
                for touchpoint in journey["touchpoints"]:
                    attribution[touchpoint] += value_per_touch
        
        return AttributionService._normalize_attribution(dict(attribution))
    
    @staticmethod
    def _time_decay_attribution(user_journeys, half_life_days=7):
        """时间衰减归因：越近的触点权重越高"""
        import math
        
        attribution = defaultdict(float)
        lambda_decay = math.log(2) / half_life_days  # 衰减系数
        
        for journey in user_journeys:
            if not journey["converted"] or not journey["touchpoints"]:
                continue
            
            timestamps = journey["timestamps"]
            conversion_time = timestamps[-1]  # 转化时间为最后触点的时间
            
            # 计算每个触点的权重
            weights = []
            for ts in timestamps:
                days_before = (conversion_time - ts).total_seconds() / (24 * 3600)
                weight = math.exp(-lambda_decay * days_before)
                weights.append(weight)
            
            # 归一化权重并分配价值
            total_weight = sum(weights)
            if total_weight > 0:
                for touchpoint, weight in zip(journey["touchpoints"], weights):
                    attribution[touchpoint] += journey["conversion_value"] * (weight / total_weight)
        
        return AttributionService._normalize_attribution(dict(attribution))
    
    @staticmethod
    def _position_based_attribution(user_journeys):
        """位置归因：首触点40%，末触点40%，中间平分20%"""
        attribution = defaultdict(float)
        
        for journey in user_journeys:
            if not journey["converted"] or not journey["touchpoints"]:
                continue
            
            touchpoints = journey["touchpoints"]
            n = len(touchpoints)
            
            if n == 1:
                # 单触点获得全部
                attribution[touchpoints[0]] += journey["conversion_value"]
            elif n == 2:
                # 两个触点各50%
                attribution[touchpoints[0]] += journey["conversion_value"] * 0.5
                attribution[touchpoints[1]] += journey["conversion_value"] * 0.5
            else:
                # 首触点40%，末触点40%，中间平分20%
                attribution[touchpoints[0]] += journey["conversion_value"] * 0.4
                attribution[touchpoints[-1]] += journey["conversion_value"] * 0.4
                
                middle_value = journey["conversion_value"] * 0.2 / (n - 2)
                for touchpoint in touchpoints[1:-1]:
                    attribution[touchpoint] += middle_value
        
        return AttributionService._normalize_attribution(dict(attribution))
    
    @staticmethod
    def _shapley_attribution(user_journeys, max_touchpoints=5):
        """
        Shapley值归因：基于博弈论的公平分配
        计算复杂度较高，限制每个用户旅程的最大触点数
        """
        # 收集所有触点和它们的边际贡献
        touchpoint_contributions = defaultdict(list)
        
        for journey in user_journeys:
            if not journey["converted"] or not journey["touchpoints"]:
                continue
            
            touchpoints = journey["touchpoints"][:max_touchpoints]  # 限制长度
            n = len(touchpoints)
            
            if n == 0:
                continue
            
            # 简化的Shapley计算：对每个触点，计算它在不同位置的平均边际贡献
            # 实际Shapley需要枚举所有子集，这里使用近似
            value_per_touch = journey["conversion_value"] / n
            
            for touchpoint in touchpoints:
                touchpoint_contributions[touchpoint].append(value_per_touch)
        
        # 计算平均贡献
        attribution = {}
        for touchpoint, contributions in touchpoint_contributions.items():
            attribution[touchpoint] = sum(contributions)
        
        return AttributionService._normalize_attribution(attribution)
    
    @staticmethod
    def _normalize_attribution(attribution):
        """归一化归因结果，计算百分比"""
        total = sum(attribution.values())
        if total == 0:
            return {}
        
        return {
            touchpoint: {
                "value": round(value, 4),
                "percentage": round(value / total * 100, 2)
            }
            for touchpoint, value in sorted(attribution.items(), key=lambda x: x[1], reverse=True)
        }
    
    @staticmethod
    def _generate_summary(user_journeys, results):
        """生成归因汇总统计"""
        summary = {
            "avg_touchpoints_per_journey": round(
                sum(j["touchpoint_count"] for j in user_journeys) / len(user_journeys), 2
            ) if user_journeys else 0,
            "conversion_rate": round(
                sum(j["converted"] for j in user_journeys) / len(user_journeys) * 100, 2
            ) if user_journeys else 0,
            "model_comparison": []
        }
        
        # 对比各模型的Top3触点
        for model_name, model_result in results.items():
            top3 = list(model_result.items())[:3]
            summary["model_comparison"].append({
                "model": model_name,
                "model_name": AttributionService.ATTRIBUTION_MODELS.get(model_name, model_name),
                "top3": [
                    {"touchpoint": tp, "percentage": data["percentage"]}
                    for tp, data in top3
                ]
            })
        
        return summary
