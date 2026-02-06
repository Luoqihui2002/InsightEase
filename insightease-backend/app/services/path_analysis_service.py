"""
路径分析服务
支持：用户行为路径分析、漏斗分析、关键路径分析
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple, Set
from collections import defaultdict, Counter
import json


class PathAnalysisService:
    """路径分析服务"""
    
    @staticmethod
    def funnel_analysis(
        df: pd.DataFrame,
        user_id_col: str,
        event_col: str,
        timestamp_col: str,
        funnel_steps: List[str],
        time_window: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        漏斗分析
        
        Args:
            df: 数据DataFrame
            user_id_col: 用户ID列名
            event_col: 事件/页面列名  
            timestamp_col: 时间戳列名
            funnel_steps: 漏斗步骤列表（按顺序）
            time_window: 时间窗口（小时），None表示不限制
            
        Returns:
            漏斗分析结果
        """
        # 数据预处理
        df = df.copy()
        df[timestamp_col] = pd.to_datetime(df[timestamp_col])
        df = df.sort_values([user_id_col, timestamp_col])
        
        results = {
            "funnel_steps": [],
            "total_users": df[user_id_col].nunique(),
            "conversion_rates": [],
            "drop_off_rates": [],
            "avg_time_between_steps": [],
            "user_paths": []
        }
        
        # 获取每个用户的完整路径
        user_paths = df.groupby(user_id_col)[event_col].apply(list).to_dict()
        user_timestamps = df.groupby(user_id_col)[timestamp_col].apply(list).to_dict()
        
        # 计算漏斗每一步的转化
        step_users = {}  # 每个步骤的用户集合
        step_times = {}  # 每个步骤的平均时间
        
        for i, step in enumerate(funnel_steps):
            step_users[i] = set()
            step_times[i] = []
            
            for user_id, events in user_paths.items():
                # 检查用户是否完成了当前步骤
                if step in events:
                    event_idx = events.index(step)
                    
                    # 检查时间窗口约束
                    if time_window and i > 0:
                        # 检查是否在前一步之后的时间窗口内
                        prev_step = funnel_steps[i-1]
                        if prev_step in events:
                            prev_idx = events.index(prev_step)
                            if event_idx > prev_idx:
                                time_diff = (user_timestamps[user_id][event_idx] - 
                                           user_timestamps[user_id][prev_idx]).total_seconds() / 3600
                                if time_diff <= time_window:
                                    step_users[i].add(user_id)
                                    step_times[i].append(time_diff)
                    else:
                        step_users[i].add(user_id)
                        if i > 0 and funnel_steps[i-1] in events:
                            prev_step = funnel_steps[i-1]
                            prev_idx = events.index(prev_step)
                            event_idx = events.index(step)
                            if event_idx > prev_idx:
                                time_diff = (user_timestamps[user_id][event_idx] - 
                                           user_timestamps[user_id][prev_idx]).total_seconds() / 3600
                                step_times[i].append(time_diff)
        
        # 计算转化率和流失率
        for i, step in enumerate(funnel_steps):
            users = len(step_users.get(i, set()))
            
            if i == 0:
                conversion_rate = 100.0
                drop_off_rate = 0.0
            else:
                prev_users = len(step_users.get(i-1, set()))
                if prev_users > 0:
                    conversion_rate = (users / prev_users) * 100
                    drop_off_rate = 100 - conversion_rate
                else:
                    conversion_rate = 0.0
                    drop_off_rate = 100.0
            
            avg_time = np.mean(step_times.get(i, [0])) if step_times.get(i) else 0
            
            results["funnel_steps"].append({
                "step": i + 1,
                "name": step,
                "users": users,
                "conversion_rate": round(conversion_rate, 2),
                "drop_off_rate": round(drop_off_rate, 2),
                "avg_time_from_prev": round(avg_time, 2)  # 小时
            })
        
        # 计算总体转化率
        if results["funnel_steps"]:
            first_step_users = results["funnel_steps"][0]["users"]
            last_step_users = results["funnel_steps"][-1]["users"]
            results["overall_conversion_rate"] = round(
                (last_step_users / first_step_users) * 100, 2
            ) if first_step_users > 0 else 0.0
        
        return results
    
    @staticmethod
    def path_analysis(
        df: pd.DataFrame,
        user_id_col: str,
        event_col: str,
        timestamp_col: str,
        max_path_length: int = 10,
        min_user_count: int = 5
    ) -> Dict[str, Any]:
        """
        用户行为路径分析
        
        Args:
            df: 数据DataFrame
            user_id_col: 用户ID列名
            event_col: 事件/页面列名
            timestamp_col: 时间戳列名
            max_path_length: 最大路径长度
            min_user_count: 最小用户数量阈值（过滤稀有路径）
            
        Returns:
            路径分析结果
        """
        # 数据预处理
        df = df.copy()
        df[timestamp_col] = pd.to_datetime(df[timestamp_col])
        df = df.sort_values([user_id_col, timestamp_col])
        
        # 获取每个用户的路径
        user_paths = df.groupby(user_id_col)[event_col].apply(list).to_dict()
        
        # 统计路径模式
        path_counter = Counter()
        path_users = defaultdict(set)
        
        for user_id, events in user_paths.items():
            # 限制路径长度
            events = events[:max_path_length]
            path_tuple = tuple(events)
            path_counter[path_tuple] += 1
            path_users[path_tuple].add(user_id)
        
        # 检测循环
        cycles_detected = []
        for path, count in path_counter.items():
            path_list = list(path)
            seen = set()
            cycle_nodes = set()
            for node in path_list:
                if node in seen:
                    cycle_nodes.add(node)
                seen.add(node)
            if cycle_nodes:
                cycles_detected.append({
                    "path": list(path),
                    "user_count": count,
                    "cycle_nodes": list(cycle_nodes)
                })
        
        # 构建节点映射
        node_map = {}
        nodes = []
        
        for path, count in path_counter.items():
            if count >= min_user_count:
                for event in path:
                    if event not in node_map:
                        node_map[event] = len(nodes)
                        nodes.append({"name": event, "value": 0})
        
        # 构建桑基图数据（去循环）
        sankey_links = []
        link_counter = Counter()
        
        for path, count in path_counter.items():
            if count >= min_user_count:
                seen_in_path = set()
                for i in range(len(path) - 1):
                    source_node = path[i]
                    target_node = path[i + 1]
                    
                    # 检测循环：如果目标节点已经在当前路径的前面出现过，跳过
                    if target_node in seen_in_path:
                        continue
                    
                    source = node_map.get(source_node)
                    target = node_map.get(target_node)
                    
                    if source is not None and target is not None and source != target:
                        link_counter[(source, target)] += count
                    
                    seen_in_path.add(source_node)
        
        for (source, target), value in link_counter.items():
            sankey_links.append({
                "source": source,
                "target": target,
                "value": value
            })
        
        # 构建力导向图数据（保留循环）
        graph_nodes = []
        graph_links = []
        graph_node_map = {}
        
        for path, count in path_counter.items():
            if count >= min_user_count:
                for event in path:
                    if event not in graph_node_map:
                        graph_node_map[event] = len(graph_nodes)
                        graph_nodes.append({
                            "id": event,
                            "name": event,
                            "value": 0,
                            "symbolSize": 30
                        })
                
                for i in range(len(path) - 1):
                    source = path[i]
                    target = path[i + 1]
                    if source != target:
                        graph_links.append({
                            "source": source,
                            "target": target,
                            "value": count
                        })
        
        # 统计最常见的路径
        top_paths = []
        for path, count in path_counter.most_common(20):
            if count >= min_user_count:
                top_paths.append({
                    "path": list(path),
                    "user_count": count,
                    "percentage": round(count / len(user_paths) * 100, 2)
                })
        
        # 计算每个节点的进入和离开次数
        node_stats = defaultdict(lambda: {"in": 0, "out": 0, "users": set()})
        for user_id, events in user_paths.items():
            for i, event in enumerate(events):
                if event in node_map:
                    node_stats[event]["users"].add(user_id)
                    if i < len(events) - 1:
                        node_stats[event]["out"] += 1
                    if i > 0:
                        node_stats[event]["in"] += 1
        
        node_details = []
        for node_name, stats in node_stats.items():
            node_details.append({
                "name": node_name,
                "in_degree": stats["in"],
                "out_degree": stats["out"],
                "unique_users": len(stats["users"])
            })
        
        # 更新节点大小（基于访问量）
        for node in graph_nodes:
            node["value"] = node_stats.get(node["name"], {}).get("unique_users", 0)
            node["symbolSize"] = max(20, min(60, node["value"] / 5))
        
        has_cycle = len(cycles_detected) > 0
        
        return {
            "total_users": len(user_paths),
            "total_paths": len(path_counter),
            "has_cycle_in_data": has_cycle,
            "cycle_details": cycles_detected[:10] if has_cycle else [],  # 只返回前10个循环
            "top_paths": top_paths,
            "sankey_data": {
                "nodes": nodes,
                "links": sankey_links
            },
            "graph_data": {
                "nodes": graph_nodes,
                "links": graph_links
            },
            "node_details": sorted(node_details, key=lambda x: x["unique_users"], reverse=True),
            "max_path_length": max_path_length
        }
    
    @staticmethod
    def path_clustering(
        df: pd.DataFrame,
        user_id_col: str,
        event_col: str,
        timestamp_col: str,
        n_clusters: int = 3,
        max_path_length: int = 10,
        mode: str = "smart",  # "smart" 或 "custom"
        custom_columns: Optional[List[str]] = None,
        additional_event_cols: Optional[List[str]] = None,  # 用于联合分析的额外事件列列表
        selected_features: Optional[List[str]] = None  # 智能模式下选择的特征列表
    ) -> Dict[str, Any]:
        """
        用户行为聚类分析 - 支持智能特征提取和自由维度选择
        
        Args:
            df: 数据DataFrame
            user_id_col: 用户ID列名
            event_col: 事件/页面列名
            timestamp_col: 时间戳列名
            n_clusters: 聚类数量
            max_path_length: 最大路径长度
            mode: 聚类模式 - "smart"(智能行为特征) 或 "custom"(自由维度选择)
            custom_columns: 自定义维度列表（mode="custom"时使用）
            additional_event_cols: 额外的行为列列表（如 [block_type, action]），将与 event_col 联合分析
            selected_features: 智能模式下要提取的特征列表，None表示全部
            
        Returns:
            聚类结果，包含用户群体映射
        """
        from sklearn.preprocessing import StandardScaler
        from sklearn.cluster import KMeans
        from sklearn.decomposition import PCA
        
        df = df.copy()
        df[timestamp_col] = pd.to_datetime(df[timestamp_col])
        df = df.sort_values([user_id_col, timestamp_col])
        
        # 处理多列联合
        if additional_event_cols:
            # 过滤掉None或不存在的列
            valid_cols = [col for col in additional_event_cols if col and col in df.columns]
            if valid_cols:
                # 联合所有列：event_col + additional_event_cols
                all_cols = [event_col] + valid_cols
                df[event_col] = df[all_cols].astype(str).agg('_'.join, axis=1)
        
        # 获取用户列表
        user_ids = df[user_id_col].unique().tolist()
        
        if len(user_ids) < n_clusters:
            n_clusters = max(1, len(user_ids) // 2)
        
        if n_clusters < 2:
            return {
                "message": "用户数量不足，无法进行聚类分析",
                "total_users": len(user_ids)
            }
        
        if mode == "custom" and custom_columns:
            # 模式1：自由维度选择 - 基于用户指定的数值列
            feature_df = PathAnalysisService._extract_custom_features(df, user_id_col, custom_columns)
            feature_columns = custom_columns
        else:
            # 模式2：智能行为特征提取
            feature_df = PathAnalysisService._extract_smart_features(
                df, user_id_col, event_col, timestamp_col, max_path_length, selected_features,
                additional_event_cols
            )
            feature_columns = feature_df.columns.tolist()
        
        if feature_df.empty or len(feature_df) < n_clusters:
            return {
                "message": "有效特征数据不足，无法进行聚类分析",
                "total_users": len(user_ids)
            }
        
        # 标准化特征
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(feature_df.values)
        
        # K-means聚类
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X_scaled)
        
        # 处理空簇
        unique_labels = np.unique(labels)
        actual_n_clusters = len(unique_labels)
        
        if actual_n_clusters < n_clusters:
            # 重新映射标签
            label_map = {old: new for new, old in enumerate(unique_labels)}
            labels = np.array([label_map[l] for l in labels])
            n_clusters = actual_n_clusters
        
        # 分析每个聚类的特征
        clusters = []
        for i in range(n_clusters):
            cluster_mask = labels == i
            cluster_users = [user_ids[j] for j in range(len(user_ids)) if cluster_mask[j]]
            cluster_features = feature_df[cluster_mask]
            
            # 计算该群体的特征统计
            cluster_stats = {
                "cluster_id": i,
                "user_count": len(cluster_users),
                "percentage": round(len(cluster_users) / len(user_ids) * 100, 2),
                "feature_stats": {}
            }
            
            # 每个特征的均值（用于描述群体特点）
            for col in feature_columns:
                cluster_stats["feature_stats"][col] = {
                    "mean": round(float(cluster_features[col].mean()), 2),
                    "std": round(float(cluster_features[col].std()), 2),
                    "min": round(float(cluster_features[col].min()), 2),
                    "max": round(float(cluster_features[col].max()), 2)
                }
            
            clusters.append(cluster_stats)
        
        # 生成群体描述
        for cluster in clusters:
            cluster["description"] = PathAnalysisService._generate_cluster_description(
                cluster, feature_columns, mode
            )
        
        return {
            "total_users": len(user_ids),
            "n_clusters": n_clusters,
            "mode": mode,
            "feature_columns": feature_columns,
            "clusters": sorted(clusters, key=lambda x: x["user_count"], reverse=True),
            "user_cluster_mapping": [
                {"user_id": user_ids[i], "cluster": int(labels[i])}
                for i in range(len(user_ids))
            ],
            "feature_importance": PathAnalysisService._calculate_feature_importance(
                feature_df.values, labels, feature_columns
            )
        }
    
    # 可用的智能特征列表
    AVAILABLE_SMART_FEATURES = {
        "total_events": {"name": "总事件数", "category": "活跃度"},
        "unique_events": {"name": "唯一事件数", "category": "多样性"},
        "combined_unique": {"name": "联合唯一事件数", "category": "多样性"},
        "avg_time_between": {"name": "平均间隔时间", "category": "时间"},
        "total_duration": {"name": "总时长", "category": "时间"},
        "morning_activity": {"name": "上午活跃度", "category": "时段"},
        "afternoon_activity": {"name": "下午活跃度", "category": "时段"},
        "evening_activity": {"name": "晚上活跃度", "category": "时段"},
        "night_activity": {"name": "夜间活跃度", "category": "时段"},
        "n_sessions": {"name": "会话数", "category": "会话"},
        "avg_session_length": {"name": "平均会话长度", "category": "会话"},
        "path_depth": {"name": "路径深度", "category": "深度"},
        "behavior_entropy": {"name": "行为熵", "category": "多样性"},
        "combined_entropy": {"name": "联合事件熵", "category": "多样性"},
        "has_repetition": {"name": "是否有重复", "category": "重复"},
        "repetition_rate": {"name": "重复率", "category": "重复"}
    }
    
    @staticmethod
    def _extract_smart_features(
        df: pd.DataFrame,
        user_id_col: str,
        event_col: str,
        timestamp_col: str,
        max_path_length: int = 10,
        selected_features: Optional[List[str]] = None,
        additional_event_cols: Optional[List[str]] = None
    ) -> pd.DataFrame:
        """
        智能提取用户行为特征
        
        Args:
            selected_features: 指定要提取的特征列表，None表示提取全部
            additional_event_cols: 额外的行为列列表
        """
        # 默认提取全部特征
        if selected_features is None:
            selected_features = list(PathAnalysisService.AVAILABLE_SMART_FEATURES.keys())
        
        features = []
        
        for user_id, user_df in df.groupby(user_id_col):
            user_df = user_df.sort_values(timestamp_col)
            
            feature_dict = {}
            
            # 基础统计
            if any(f in selected_features for f in ["total_events", "avg_session_length"]):
                total_events = len(user_df)
                if "total_events" in selected_features:
                    feature_dict["total_events"] = total_events
            
            if any(f in selected_features for f in ["unique_events", "behavior_entropy"]):
                unique_events = user_df[event_col].nunique()
                if "unique_events" in selected_features:
                    feature_dict["unique_events"] = unique_events
            
            # 时间特征
            if any(f in selected_features for f in ["avg_time_between", "total_duration", "n_sessions", "avg_session_length"] + 
                   ["morning_activity", "afternoon_activity", "evening_activity", "night_activity"]):
                timestamps = pd.to_datetime(user_df[timestamp_col])
                time_diffs = timestamps.diff().dropna()
                
                if "avg_time_between" in selected_features:
                    feature_dict["avg_time_between"] = time_diffs.mean().total_seconds() if len(time_diffs) > 0 else 0
                
                if "total_duration" in selected_features:
                    feature_dict["total_duration"] = (timestamps.max() - timestamps.min()).total_seconds() if len(timestamps) > 1 else 0
                
                # 活跃时段
                if any(f in selected_features for f in ["morning_activity", "afternoon_activity", "evening_activity", "night_activity"]):
                    hours = timestamps.dt.hour
                    if "morning_activity" in selected_features:
                        feature_dict["morning_activity"] = ((hours >= 6) & (hours < 12)).sum()
                    if "afternoon_activity" in selected_features:
                        feature_dict["afternoon_activity"] = ((hours >= 12) & (hours < 18)).sum()
                    if "evening_activity" in selected_features:
                        feature_dict["evening_activity"] = ((hours >= 18) & (hours < 24)).sum()
                    if "night_activity" in selected_features:
                        feature_dict["night_activity"] = ((hours >= 0) & (hours < 6)).sum()
                
                # 会话分析
                if any(f in selected_features for f in ["n_sessions", "avg_session_length"]):
                    session_gaps = time_diffs > pd.Timedelta(minutes=30)
                    n_sessions = session_gaps.sum() + 1 if len(user_df) > 0 else 0
                    if "n_sessions" in selected_features:
                        feature_dict["n_sessions"] = n_sessions
                    if "avg_session_length" in selected_features:
                        feature_dict["avg_session_length"] = total_events / n_sessions if n_sessions > 0 else 0
            
            # 路径深度
            if "path_depth" in selected_features:
                feature_dict["path_depth"] = min(len(user_df), max_path_length)
            
            # 行为多样性
            if "behavior_entropy" in selected_features:
                event_counts = user_df[event_col].value_counts(normalize=True)
                feature_dict["behavior_entropy"] = -sum(p * np.log2(p) for p in event_counts if p > 0)
            
            # 重复行为
            if any(f in selected_features for f in ["has_repetition", "repetition_rate"]):
                events = user_df[event_col].tolist()[:max_path_length]
                has_repetition = len(events) != len(set(events))
                if "has_repetition" in selected_features:
                    feature_dict["has_repetition"] = int(has_repetition)
                if "repetition_rate" in selected_features:
                    feature_dict["repetition_rate"] = (len(events) - len(set(events))) / len(events) if len(events) > 0 else 0
            
            # 联合事件分析
            if any(f in selected_features for f in ["combined_unique", "combined_entropy"]):
                if additional_event_cols:
                    valid_cols = [col for col in additional_event_cols if col and col in user_df.columns]
                    if valid_cols:
                        all_cols = [event_col] + valid_cols
                        combined_events = user_df[all_cols].astype(str).agg('_'.join, axis=1).tolist()
                        if "combined_unique" in selected_features:
                            feature_dict["combined_unique"] = len(set(combined_events))
                        if "combined_entropy" in selected_features:
                            feature_dict["combined_entropy"] = -sum(
                                p * np.log2(p) for p in Counter(combined_events).values() 
                                for count in [sum(Counter(combined_events).values())]
                                for p in [count / sum(Counter(combined_events).values())]
                            ) if combined_events else 0
                    else:
                        if "combined_unique" in selected_features:
                            feature_dict["combined_unique"] = unique_events if 'unique_events' in dir() else user_df[event_col].nunique()
                        if "combined_entropy" in selected_features:
                            feature_dict["combined_entropy"] = feature_dict.get("behavior_entropy", 0)
                else:
                    if "combined_unique" in selected_features:
                        feature_dict["combined_unique"] = unique_events if 'unique_events' in dir() else user_df[event_col].nunique()
                    if "combined_entropy" in selected_features:
                        feature_dict["combined_entropy"] = feature_dict.get("behavior_entropy", 0)
            
            features.append(feature_dict)
        
        return pd.DataFrame(features)
    
    @staticmethod
    def _extract_custom_features(
        df: pd.DataFrame,
        user_id_col: str,
        custom_columns: List[str]
    ) -> pd.DataFrame:
        """
        提取用户指定的自定义特征
        """
        # 按用户聚合（取均值）
        agg_dict = {col: 'mean' for col in custom_columns}
        feature_df = df.groupby(user_id_col)[custom_columns].agg(agg_dict).reset_index(drop=True)
        return feature_df
    
    @staticmethod
    def _generate_cluster_description(
        cluster: Dict,
        feature_columns: List[str],
        mode: str
    ) -> str:
        """
        生成群体描述
        """
        stats = cluster["feature_stats"]
        
        if mode == "smart":
            # 智能模式：基于行为特征生成描述
            parts = []
            
            # 活跃度
            if "total_events" in stats:
                total = stats["total_events"]["mean"]
                if total > 50:
                    parts.append("高活跃用户")
                elif total > 20:
                    parts.append("中等活跃用户")
                else:
                    parts.append("低活跃用户")
            
            # 行为多样性
            if "behavior_entropy" in stats:
                entropy = stats["behavior_entropy"]["mean"]
                if entropy > 3:
                    parts.append("行为多样")
                elif entropy < 1.5:
                    parts.append("行为单一")
            
            # 会话特征
            if "n_sessions" in stats:
                sessions = stats["n_sessions"]["mean"]
                if sessions > 5:
                    parts.append("多次回访")
                elif sessions == 1:
                    parts.append("单次访问")
            
            # 活跃时段
            time_cols = ["morning_activity", "afternoon_activity", "evening_activity", "night_activity"]
            if all(c in stats for c in time_cols):
                time_values = {c: stats[c]["mean"] for c in time_cols}
                peak_time = max(time_values, key=time_values.get)
                time_names = {
                    "morning_activity": "上午活跃",
                    "afternoon_activity": "下午活跃",
                    "evening_activity": "晚上活跃",
                    "night_activity": "夜间活跃"
                }
                parts.append(time_names.get(peak_time, ""))
            
            # 路径特征
            if "path_depth" in stats:
                depth = stats["path_depth"]["mean"]
                if depth > 8:
                    parts.append("深度浏览")
                elif depth < 3:
                    parts.append("浅层浏览")
            
            return "，".join([p for p in parts if p]) or "普通用户群体"
        
        else:
            # 自定义模式：基于数值特征生成描述
            parts = []
            for col in feature_columns[:3]:  # 只取前3个特征
                mean_val = stats[col]["mean"]
                parts.append(f"{col}均值{mean_val:.1f}")
            return "，".join(parts)
    
    @staticmethod
    def _calculate_feature_importance(
        X: np.ndarray,
        labels: np.ndarray,
        feature_names: List[str]
    ) -> List[Dict]:
        """
        计算特征重要性（使用方差分析）
        """
        from scipy import stats
        
        importance = []
        for i, name in enumerate(feature_names):
            # 对每个特征进行单因素方差分析
            groups = [X[labels == j, i] for j in np.unique(labels)]
            if len(groups) > 1 and all(len(g) > 1 for g in groups):
                f_stat, p_value = stats.f_oneway(*groups)
                importance.append({
                    "feature": name,
                    "f_statistic": round(float(f_stat), 2) if not np.isnan(f_stat) else 0,
                    "p_value": round(float(p_value), 4) if not np.isnan(p_value) else 1
                })
        
        # 按 F 统计量排序
        importance.sort(key=lambda x: x["f_statistic"], reverse=True)
        return importance[:5]  # 返回前5个重要特征
    
    @staticmethod
    def key_path_analysis(
        df: pd.DataFrame,
        user_id_col: str,
        event_col: str,
        timestamp_col: str,
        start_event: str,
        end_event: str,
        max_steps: int = 10
    ) -> Dict[str, Any]:
        """
        关键路径分析 - 分析从起点到终点的最优路径
        
        Args:
            df: 数据DataFrame
            user_id_col: 用户ID列名
            event_col: 事件/页面列名
            timestamp_col: 时间戳列名
            start_event: 起点事件
            end_event: 终点事件
            max_steps: 最大步数
            
        Returns:
            关键路径分析结果
        """
        # 数据预处理
        df = df.copy()
        df[timestamp_col] = pd.to_datetime(df[timestamp_col])
        df = df.sort_values([user_id_col, timestamp_col])
        
        # 获取每个用户的路径
        user_paths = df.groupby(user_id_col)[event_col].apply(list).to_dict()
        user_times = df.groupby(user_id_col)[timestamp_col].apply(list).to_dict()
        
        # 找到从起点到终点的完整路径
        complete_paths = []
        
        for user_id, events in user_paths.items():
            if start_event in events and end_event in events:
                start_idx = events.index(start_event)
                end_idx = events.index(end_event)
                
                if start_idx < end_idx and (end_idx - start_idx) <= max_steps:
                    path_segment = events[start_idx:end_idx+1]
                    time_segment = user_times[user_id][start_idx:end_idx+1]
                    
                    duration = (time_segment[-1] - time_segment[0]).total_seconds()
                    
                    complete_paths.append({
                        "user_id": user_id,
                        "path": path_segment,
                        "steps": len(path_segment) - 1,
                        "duration_seconds": duration
                    })
        
        if not complete_paths:
            return {
                "message": f"未找到从 '{start_event}' 到 '{end_event}' 的完整路径",
                "complete_path_count": 0
            }
        
        # 统计路径模式
        path_counter = Counter(tuple(p["path"]) for p in complete_paths)
        
        # 计算平均耗时
        avg_duration = np.mean([p["duration_seconds"] for p in complete_paths])
        avg_steps = np.mean([p["steps"] for p in complete_paths])
        
        # 找出最优路径（最短步骤或最短耗时）
        min_steps_path = min(complete_paths, key=lambda x: x["steps"])
        min_duration_path = min(complete_paths, key=lambda x: x["duration_seconds"])
        
        return {
            "start_event": start_event,
            "end_event": end_event,
            "complete_path_count": len(complete_paths),
            "avg_duration_seconds": round(avg_duration, 2),
            "avg_steps": round(avg_steps, 2),
            "optimal_paths": {
                "min_steps": {
                    "path": min_steps_path["path"],
                    "steps": min_steps_path["steps"],
                    "duration_seconds": min_steps_path["duration_seconds"]
                },
                "min_duration": {
                    "path": min_duration_path["path"],
                    "steps": min_duration_path["steps"],
                    "duration_seconds": min_duration_path["duration_seconds"]
                }
            },
            "top_paths": [
                {
                    "path": list(path),
                    "count": count,
                    "percentage": round(count / len(complete_paths) * 100, 2)
                }
                for path, count in path_counter.most_common(10)
            ]
        }
