"""
序列模式挖掘服务
支持：频繁序列挖掘、高转化序列发现、序列分类
算法：PrefixSpan简化版、关联规则
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple, Set
from collections import defaultdict, Counter
from itertools import combinations


class SequenceMiningService:
    """序列模式挖掘服务"""
    
    @staticmethod
    def sequence_pattern_mining(
        df: pd.DataFrame,
        user_id_col: str,
        event_col: str,
        timestamp_col: str,
        min_support: float = 0.1,
        max_pattern_length: int = 5,
        conversion_col: Optional[str] = None,
        min_confidence: float = 0.5,
        additional_event_cols: Optional[List[str]] = None  # 联合事件列列表
    ) -> Dict[str, Any]:
        """
        序列模式挖掘主入口
        
        Args:
            df: 数据DataFrame
            user_id_col: 用户ID列名
            event_col: 事件/页面列名
            timestamp_col: 时间戳列名
            min_support: 最小支持度（0-1之间）
            max_pattern_length: 最大模式长度
            conversion_col: 转化标记列名（可选）
            min_confidence: 最小置信度（用于关联规则）
            additional_event_cols: 额外的事件列列表，将与event_col联合分析
            
        Returns:
            包含频繁序列、关联规则、高转化模式的分析结果
        """
        # 数据预处理
        df = df.copy()
        df[timestamp_col] = pd.to_datetime(df[timestamp_col])
        df = df.sort_values([user_id_col, timestamp_col])
        
        # 处理多列联合
        if additional_event_cols:
            valid_cols = [col for col in additional_event_cols if col and col in df.columns]
            if valid_cols:
                all_cols = [event_col] + valid_cols
                df[event_col] = df[all_cols].astype(str).agg('_'.join, axis=1)
        
        # 构建用户序列数据库
        sequences = SequenceMiningService._build_sequences(
            df, user_id_col, event_col, conversion_col
        )
        
        if not sequences:
            return {
                "message": "没有足够的序列数据进行分析",
                "frequent_patterns": [],
                "association_rules": [],
                "high_conversion_patterns": [],
                "sequence_stats": {}
            }
        
        # 1. 频繁序列挖掘
        frequent_patterns = SequenceMiningService._prefixspan_mining(
            sequences, min_support, max_pattern_length
        )
        
        # 2. 关联规则挖掘（事件间的关联）
        association_rules = SequenceMiningService._mine_association_rules(
            sequences, min_support, min_confidence, max_antecedent_len=2
        )
        
        # 3. 高转化序列模式（如果有转化标记）
        high_conversion_patterns = []
        if conversion_col and conversion_col in df.columns:
            high_conversion_patterns = SequenceMiningService._find_high_conversion_patterns(
                sequences, frequent_patterns, min_confidence
            )
        
        # 4. 序列统计
        sequence_stats = SequenceMiningService._calculate_sequence_stats(sequences)
        
        return {
            "frequent_patterns": frequent_patterns,
            "association_rules": association_rules,
            "high_conversion_patterns": high_conversion_patterns,
            "sequence_stats": sequence_stats,
            "total_sequences": len(sequences),
            "avg_sequence_length": sum(len(s["events"]) for s in sequences) / len(sequences) if sequences else 0
        }
    
    @staticmethod
    def _build_sequences(df, user_id_col, event_col, conversion_col=None):
        """构建用户序列数据库"""
        sequences = []
        
        for user_id, user_df in df.groupby(user_id_col):
            user_df = user_df.sort_values(df.columns[df.columns.get_loc('event_time') if 'event_time' in df.columns else 0])
            events = user_df[event_col].tolist()
            
            # 如果有转化列，获取转化状态
            converted = False
            if conversion_col and conversion_col in user_df.columns:
                converted = bool(user_df[conversion_col].iloc[-1]) if len(user_df) > 0 else False
            
            if events:  # 只添加非空序列
                sequences.append({
                    "user_id": user_id,
                    "events": events,
                    "converted": converted,
                    "length": len(events)
                })
        
        return sequences
    
    @staticmethod
    def _prefixspan_mining(sequences, min_support, max_length):
        """
        PrefixSpan算法简化版 - 挖掘频繁序列
        """
        if not sequences:
            return []
        
        total_sequences = len(sequences)
        min_count = int(min_support * total_sequences)
        
        # 找到所有频繁单项
        item_counts = Counter()
        for seq in sequences:
            unique_items = set(seq["events"])
            for item in unique_items:
                item_counts[item] += 1
        
        # 过滤出频繁项
        frequent_items = {item for item, count in item_counts.items() if count >= min_count}
        
        # 递归挖掘频繁序列
        frequent_patterns = []
        
        def project_database(sequences, prefix):
            """投影数据库"""
            projected = []
            for seq in sequences:
                events = seq["events"]
                # 查找前缀在序列中的位置
                for i in range(len(events) - len(prefix) + 1):
                    if events[i:i+len(prefix)] == prefix:
                        # 返回前缀之后的后缀
                        suffix = events[i+len(prefix):]
                        if suffix:
                            projected.append({
                                "user_id": seq["user_id"],
                                "events": suffix,
                                "converted": seq["converted"]
                            })
                        break
            return projected
        
        def mine_recursive(sequences, prefix, length):
            """递归挖掘"""
            if length > max_length:
                return
            
            # 统计投影数据库中的频繁项
            suffix_counts = Counter()
            for seq in sequences:
                if seq["events"]:
                    # 只考虑第一个元素作为后缀扩展
                    suffix_counts[seq["events"][0]] += 1
            
            # 对每个频繁后缀扩展
            for item, count in suffix_counts.items():
                if count >= min_count:
                    new_prefix = prefix + [item]
                    support = count / total_sequences
                    
                    # 保存频繁模式
                    pattern_info = {
                        "pattern": new_prefix,
                        "support_count": count,
                        "support": round(support, 4),
                        "length": len(new_prefix)
                    }
                    
                    # 检查是否是转化模式
                    converted_count = sum(1 for seq in sequences 
                                        if seq["events"] and seq["events"][0] == item and seq["converted"])
                    if converted_count > 0:
                        pattern_info["conversion_count"] = converted_count
                        pattern_info["conversion_rate"] = round(converted_count / count, 4)
                    
                    frequent_patterns.append(pattern_info)
                    
                    # 递归挖掘
                    projected = project_database(sequences, [item])
                    if projected:
                        mine_recursive(projected, new_prefix, length + 1)
        
        # 从长度为1的频繁项开始
        for item in frequent_items:
            count = item_counts[item]
            support = count / total_sequences
            
            pattern_info = {
                "pattern": [item],
                "support_count": count,
                "support": round(support, 4),
                "length": 1
            }
            
            # 检查转化情况
            converted_count = sum(1 for seq in sequences if item in seq["events"] and seq["converted"])
            if converted_count > 0:
                pattern_info["conversion_count"] = converted_count
                pattern_info["conversion_rate"] = round(converted_count / count, 4)
            
            frequent_patterns.append(pattern_info)
            
            # 构建投影数据库并递归
            projected = []
            for seq in sequences:
                try:
                    idx = seq["events"].index(item)
                    if idx + 1 < len(seq["events"]):
                        projected.append({
                            "user_id": seq["user_id"],
                            "events": seq["events"][idx+1:],
                            "converted": seq["converted"]
                        })
                except ValueError:
                    continue
            
            if projected:
                mine_recursive(projected, [item], 2)
        
        # 按支持度排序
        frequent_patterns.sort(key=lambda x: (x["support"], x.get("conversion_rate", 0)), reverse=True)
        
        return frequent_patterns[:50]  # 返回Top 50
    
    @staticmethod
    def _mine_association_rules(sequences, min_support, min_confidence, max_antecedent_len=2):
        """
        挖掘事件间的关联规则（支持多前项）
        规则形式：A -> B, A+B -> C （A发生后，B也会发生；A和B都发生后，C也会发生）
        
        Args:
            sequences: 用户序列列表
            min_support: 最小支持度
            min_confidence: 最小置信度
            max_antecedent_len: 前项的最大长度（默认2，即最多A+B -> C）
        """
        total_sequences = len(sequences)
        min_count = int(min_support * total_sequences)
        
        # 统计所有项的出现次数
        item_counts = Counter()
        for seq in sequences:
            unique_items = set(seq["events"])
            for item in unique_items:
                item_counts[item] += 1
        
        # 统计事件对和三元组的出现次数
        pair_counts = Counter()  # (A, B) 表示A后面有B
        triple_counts = Counter()  # (A, B, C) 表示A后面有B，B后面有C
        
        for seq in sequences:
            events = seq["events"]
            unique_events = list(dict.fromkeys(events))  # 去重但保持顺序
            n = len(unique_events)
            
            # 统计事件对
            for i in range(n):
                for j in range(i + 1, n):
                    pair_counts[(unique_events[i], unique_events[j])] += 1
            
            # 统计三元组（A->B->C）
            for i in range(n):
                for j in range(i + 1, n):
                    for k in range(j + 1, n):
                        triple_counts[(unique_events[i], unique_events[j], unique_events[k])] += 1
        
        rules = []
        
        # 1. 生成单前项规则 A -> B
        for (a, b), count in pair_counts.items():
            if count >= min_count:
                support = count / total_sequences
                confidence = count / item_counts[a] if item_counts[a] > 0 else 0
                
                if confidence >= min_confidence:
                    lift = confidence / (item_counts[b] / total_sequences) if total_sequences > 0 else 0
                    
                    rules.append({
                        "antecedent": [a],
                        "consequent": b,
                        "antecedent_str": a,
                        "rule_str": f"{a} → {b}",
                        "support": round(support, 4),
                        "confidence": round(confidence, 4),
                        "lift": round(lift, 4),
                        "count": count,
                        "rule_type": "单前项"
                    })
        
        # 2. 生成多前项规则 A+B -> C（如果max_antecedent_len >= 2）
        if max_antecedent_len >= 2:
            for (a, b, c), count in triple_counts.items():
                if count >= min_count:
                    support = count / total_sequences
                    # 置信度 = P(C|A,B) = count(A,B,C) / count(A,B)
                    ab_count = pair_counts.get((a, b), 0)
                    confidence = count / ab_count if ab_count > 0 else 0
                    
                    if confidence >= min_confidence:
                        lift = confidence / (item_counts[c] / total_sequences) if total_sequences > 0 else 0
                        
                        rules.append({
                            "antecedent": [a, b],
                            "consequent": c,
                            "antecedent_str": f"{a} + {b}",
                            "rule_str": f"{a} + {b} → {c}",
                            "support": round(support, 4),
                            "confidence": round(confidence, 4),
                            "lift": round(lift, 4),
                            "count": count,
                            "rule_type": "多前项"
                        })
        
        # 按置信度和提升度排序
        rules.sort(key=lambda x: (x["confidence"], x["lift"]), reverse=True)
        
        return rules[:40]  # 返回Top 40
    
    @staticmethod
    def _find_high_conversion_patterns(sequences, frequent_patterns, min_confidence):
        """找出高转化率的序列模式"""
        high_conversion = []
        
        for pattern in frequent_patterns:
            if "conversion_rate" in pattern and pattern["conversion_rate"] >= min_confidence:
                high_conversion.append(pattern)
        
        # 按转化率排序
        high_conversion.sort(key=lambda x: x["conversion_rate"], reverse=True)
        
        return high_conversion[:20]
    
    @staticmethod
    def _calculate_sequence_stats(sequences):
        """计算序列统计信息"""
        if not sequences:
            return {}
        
        lengths = [s["length"] for s in sequences]
        
        # 事件频率
        event_freq = Counter()
        for seq in sequences:
            for event in seq["events"]:
                event_freq[event] += 1
        
        # 转化统计
        converted_count = sum(1 for s in sequences if s["converted"])
        
        return {
            "total_sequences": len(sequences),
            "avg_length": round(sum(lengths) / len(lengths), 2),
            "max_length": max(lengths) if lengths else 0,
            "min_length": min(lengths) if lengths else 0,
            "unique_events": len(event_freq),
            "most_common_events": [
                {"event": event, "count": count, "percentage": round(count/len(sequences)*100, 2)}
                for event, count in event_freq.most_common(10)
            ],
            "conversion_rate": round(converted_count / len(sequences) * 100, 2) if sequences else 0
        }
    
    @staticmethod
    def sequence_classification(
        df: pd.DataFrame,
        user_id_col: str,
        event_col: str,
        timestamp_col: str,
        target_col: str
    ) -> Dict[str, Any]:
        """
        基于序列特征的分类分析
        识别导致特定结果（如转化、流失）的行为模式
        """
        # 构建序列
        df = df.copy()
        df[timestamp_col] = pd.to_datetime(df[timestamp_col])
        
        sequences = SequenceMiningService._build_sequences(
            df, user_id_col, event_col, target_col
        )
        
        if not sequences:
            return {"message": "数据不足"}
        
        # 分离正负样本
        positive_sequences = [s for s in sequences if s["converted"]]
        negative_sequences = [s for s in sequences if not s["converted"]]
        
        if not positive_sequences or not negative_sequences:
            return {"message": "需要同时存在正负样本"}
        
        # 找出区分性特征
        positive_patterns = SequenceMiningService._prefixspan_mining(
            positive_sequences, min_support=0.1, max_length=3
        )
        negative_patterns = SequenceMiningService._prefixspan_mining(
            negative_sequences, min_support=0.1, max_length=3
        )
        
        # 找出只在正样本中出现的模式
        positive_pattern_set = {tuple(p["pattern"]) for p in positive_patterns}
        negative_pattern_set = {tuple(p["pattern"]) for p in negative_patterns}
        
        distinctive_positive = [
            p for p in positive_patterns 
            if tuple(p["pattern"]) not in negative_pattern_set
        ]
        
        distinctive_negative = [
            p for p in negative_patterns 
            if tuple(p["pattern"]) not in positive_pattern_set
        ]
        
        return {
            "total_samples": len(sequences),
            "positive_samples": len(positive_sequences),
            "negative_samples": len(negative_sequences),
            "distinctive_positive_patterns": distinctive_positive[:10],
            "distinctive_negative_patterns": distinctive_negative[:10],
            "avg_length_positive": round(
                sum(len(s["events"]) for s in positive_sequences) / len(positive_sequences), 2
            ) if positive_sequences else 0,
            "avg_length_negative": round(
                sum(len(s["events"]) for s in negative_sequences) / len(negative_sequences), 2
            ) if negative_sequences else 0
        }
