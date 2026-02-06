"""数据分析服务"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List
from scipy import stats

class AnalysisService:
    """数据分析服务类"""
    
    @staticmethod
    def descriptive_analysis(df: pd.DataFrame) -> Dict[str, Any]:
        """
        描述性统计分析
        """
        result = {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "column_stats": []
        }
        
        for col in df.columns:
            col_data = df[col]
            col_info = {
                "name": str(col),
                "dtype": str(col_data.dtype),
                "non_null_count": int(col_data.notna().sum()),
                "null_count": int(col_data.isna().sum()),
                "null_percentage": round(col_data.isna().sum() / len(df) * 100, 2)
            }
            
            # 数值型列统计
            if pd.api.types.is_numeric_dtype(col_data):
                col_info.update({
                    "type": "numeric",
                    "mean": round(float(col_data.mean()), 4) if not col_data.empty else None,
                    "median": round(float(col_data.median()), 4) if not col_data.empty else None,
                    "std": round(float(col_data.std()), 4) if not col_data.empty else None,
                    "min": round(float(col_data.min()), 4) if not col_data.empty else None,
                    "max": round(float(col_data.max()), 4) if not col_data.empty else None,
                    "q1": round(float(col_data.quantile(0.25)), 4) if not col_data.empty else None,
                    "q3": round(float(col_data.quantile(0.75)), 4) if not col_data.empty else None,
                    "skewness": round(float(col_data.skew()), 4) if not col_data.empty else None,
                    "kurtosis": round(float(col_data.kurtosis()), 4) if not col_data.empty else None
                })
            # 分类型/字符串列统计
            elif pd.api.types.is_string_dtype(col_data) or pd.api.types.is_categorical_dtype(col_data):
                value_counts = col_data.value_counts().head(10).to_dict()
                col_info.update({
                    "type": "categorical",
                    "unique_count": int(col_data.nunique()),
                    "most_common": str(col_data.mode().iloc[0]) if not col_data.mode().empty else None,
                    "top_values": {str(k): int(v) for k, v in value_counts.items()}
                })
            # 日期型列统计
            elif pd.api.types.is_datetime64_any_dtype(col_data):
                col_info.update({
                    "type": "datetime",
                    "min_date": str(col_data.min()),
                    "max_date": str(col_data.max()),
                    "unique_count": int(col_data.nunique())
                })
            
            result["column_stats"].append(col_info)
        
        return result
    
    @staticmethod
    def correlation_analysis(df: pd.DataFrame) -> Dict[str, Any]:
        """
        相关性分析（仅对数值型列）
        """
        numeric_df = df.select_dtypes(include=[np.number])
        
        if numeric_df.empty or len(numeric_df.columns) < 2:
            return {
                "message": "数据中没有足够的数值型列进行相关性分析",
                "correlation_matrix": {},
                "strong_correlations": []
            }
        
        # 计算相关系数矩阵
        corr_matrix = numeric_df.corr().round(4)
        
        # 找出强相关性（绝对值 > 0.7）
        strong_correlations = []
        for i in range(len(corr_matrix.columns)):
            for j in range(i + 1, len(corr_matrix.columns)):
                col1 = corr_matrix.columns[i]
                col2 = corr_matrix.columns[j]
                corr_value = corr_matrix.iloc[i, j]
                if abs(corr_value) > 0.7:
                    strong_correlations.append({
                        "column1": str(col1),
                        "column2": str(col2),
                        "correlation": float(corr_value),
                        "strength": "强正相关" if corr_value > 0 else "强负相关"
                    })
        
        # 转换为字典格式
        corr_dict = {}
        for col in corr_matrix.columns:
            corr_dict[str(col)] = {
                str(k): float(v) for k, v in corr_matrix[col].items()
            }
        
        return {
            "columns": list(corr_matrix.columns),
            "correlation_matrix": corr_dict,
            "strong_correlations": sorted(strong_correlations, key=lambda x: abs(x["correlation"]), reverse=True)
        }
    
    @staticmethod
    def distribution_analysis(df: pd.DataFrame, column: str) -> Dict[str, Any]:
        """
        单变量分布分析
        """
        if column not in df.columns:
            return {"error": f"列 '{column}' 不存在"}
        
        data = df[column].dropna()
        
        if data.empty:
            return {"error": f"列 '{column}' 没有有效数据"}
        
        result = {
            "column": column,
            "dtype": str(data.dtype),
            "total_count": len(data)
        }
        
        if pd.api.types.is_numeric_dtype(data):
            # 正态性检验
            if len(data) >= 3:
                try:
                    statistic, p_value = stats.shapiro(data.sample(min(5000, len(data))))
                    result["normality_test"] = {
                        "test": "Shapiro-Wilk",
                        "statistic": round(float(statistic), 4),
                        "p_value": round(float(p_value), 4),
                        "is_normal": p_value > 0.05
                    }
                except:
                    result["normality_test"] = {"message": "无法进行正态性检验"}
            
            # 直方图数据（用于前端展示）
            hist, bins = np.histogram(data, bins=20)
            result["histogram"] = {
                "bins": [round(float(b), 4) for b in bins.tolist()],
                "counts": hist.tolist()
            }
        
        elif pd.api.types.is_string_dtype(data) or pd.api.types.is_categorical_dtype(data):
            value_counts = data.value_counts().head(20)
            result["value_distribution"] = {
                str(k): int(v) for k, v in value_counts.items()
            }
        
        return result
    
    @staticmethod
    def outlier_detection(df: pd.DataFrame, column: str = None) -> Dict[str, Any]:
        """
        异常值检测（使用 IQR 方法）
        """
        numeric_df = df.select_dtypes(include=[np.number])
        
        if numeric_df.empty:
            return {"message": "没有数值型列可供分析"}
        
        if column and column in numeric_df.columns:
            columns_to_check = [column]
        else:
            columns_to_check = numeric_df.columns.tolist()
        
        outliers_result = []
        
        for col in columns_to_check:
            data = numeric_df[col].dropna()
            if len(data) < 4:
                continue
                
            Q1 = data.quantile(0.25)
            Q3 = data.quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            outliers = data[(data < lower_bound) | (data > upper_bound)]
            
            outliers_result.append({
                "column": str(col),
                "outlier_count": len(outliers),
                "outlier_percentage": round(len(outliers) / len(data) * 100, 2),
                "lower_bound": round(float(lower_bound), 4),
                "upper_bound": round(float(upper_bound), 4),
                "outlier_values": outliers.head(10).tolist() if len(outliers) > 0 else []
            })
        
        return {
            "total_columns_checked": len(columns_to_check),
            "columns_with_outliers": len([x for x in outliers_result if x["outlier_count"] > 0]),
            "details": outliers_result
        }
