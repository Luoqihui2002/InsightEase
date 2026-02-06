"""数据可视化服务"""
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # 非交互式后端
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, Any, List, Optional
import base64
from io import BytesIO
import json

class VisualizationService:
    """可视化服务类"""
    
    @staticmethod
    def _fig_to_base64(fig) -> str:
        """将图表转换为 base64 字符串"""
        buf = BytesIO()
        fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)
        return img_base64
    
    @staticmethod
    def generate_histogram(df: pd.DataFrame, column: str, bins: int = 20) -> Dict[str, Any]:
        """生成直方图"""
        if column not in df.columns:
            return {"error": f"列 '{column}' 不存在"}
        
        data = df[column].dropna()
        if not pd.api.types.is_numeric_dtype(data):
            return {"error": f"列 '{column}' 不是数值型数据"}
        
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.hist(data, bins=bins, edgecolor='black', alpha=0.7, color='#3b82f6')
        ax.set_xlabel(column, fontsize=12)
        ax.set_ylabel('频数', fontsize=12)
        ax.set_title(f'{column} 分布直方图', fontsize=14)
        ax.grid(True, alpha=0.3)
        
        return {
            "type": "histogram",
            "column": column,
            "image_base64": VisualizationService._fig_to_base64(fig),
            "statistics": {
                "mean": round(float(data.mean()), 4),
                "median": round(float(data.median()), 4),
                "std": round(float(data.std()), 4)
            }
        }
    
    @staticmethod
    def generate_bar_chart(df: pd.DataFrame, column: str, top_n: int = 10) -> Dict[str, Any]:
        """生成柱状图（用于分类数据）"""
        if column not in df.columns:
            return {"error": f"列 '{column}' 不存在"}
        
        data = df[column].dropna()
        value_counts = data.value_counts().head(top_n)
        
        fig, ax = plt.subplots(figsize=(12, 6))
        bars = ax.bar(range(len(value_counts)), value_counts.values, color='#3b82f6', edgecolor='black')
        ax.set_xticks(range(len(value_counts)))
        ax.set_xticklabels([str(x) for x in value_counts.index], rotation=45, ha='right')
        ax.set_xlabel(column, fontsize=12)
        ax.set_ylabel('频数', fontsize=12)
        ax.set_title(f'{column} 频次分布 (Top {top_n})', fontsize=14)
        ax.grid(True, alpha=0.3, axis='y')
        
        # 在柱子上添加数值标签
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{int(height)}',
                   ha='center', va='bottom', fontsize=9)
        
        return {
            "type": "bar_chart",
            "column": column,
            "image_base64": VisualizationService._fig_to_base64(fig),
            "data": {str(k): int(v) for k, v in value_counts.items()}
        }
    
    @staticmethod
    def generate_scatter_plot(df: pd.DataFrame, x_column: str, y_column: str) -> Dict[str, Any]:
        """生成散点图"""
        if x_column not in df.columns or y_column not in df.columns:
            return {"error": f"列不存在"}
        
        x_data = df[x_column].dropna()
        y_data = df[y_column].dropna()
        
        # 对齐数据
        common_index = x_data.index.intersection(y_data.index)
        x_data = x_data.loc[common_index]
        y_data = y_data.loc[common_index]
        
        if len(x_data) == 0:
            return {"error": "没有有效的数据点"}
        
        # 采样，避免点太多
        if len(x_data) > 5000:
            sample_idx = np.random.choice(len(x_data), 5000, replace=False)
            x_data = x_data.iloc[sample_idx]
            y_data = y_data.iloc[sample_idx]
        
        fig, ax = plt.subplots(figsize=(10, 8))
        ax.scatter(x_data, y_data, alpha=0.5, s=20, color='#3b82f6', edgecolor='none')
        ax.set_xlabel(x_column, fontsize=12)
        ax.set_ylabel(y_column, fontsize=12)
        ax.set_title(f'{x_column} vs {y_column} 散点图', fontsize=14)
        ax.grid(True, alpha=0.3)
        
        # 计算相关系数
        corr = x_data.corr(y_data)
        ax.text(0.05, 0.95, f'相关系数: {corr:.4f}',
                transform=ax.transAxes, fontsize=11,
                verticalalignment='top',
                bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        
        return {
            "type": "scatter_plot",
            "x_column": x_column,
            "y_column": y_column,
            "image_base64": VisualizationService._fig_to_base64(fig),
            "correlation": round(float(corr), 4)
        }
    
    @staticmethod
    def generate_line_chart(df: pd.DataFrame, x_column: str, y_column: str) -> Dict[str, Any]:
        """生成折线图（适用于时间序列数据）"""
        if x_column not in df.columns or y_column not in df.columns:
            return {"error": f"列不存在"}
        
        # 复制数据避免修改原数据
        plot_df = df[[x_column, y_column]].copy()
        plot_df = plot_df.dropna()
        
        # 如果 x 是日期类型，转换
        if pd.api.types.is_datetime64_any_dtype(plot_df[x_column]):
            plot_df = plot_df.sort_values(by=x_column)
        
        # 采样，避免点太多
        if len(plot_df) > 1000:
            plot_df = plot_df.sample(1000).sort_values(by=x_column)
        
        fig, ax = plt.subplots(figsize=(12, 6))
        ax.plot(plot_df[x_column], plot_df[y_column], linewidth=1.5, color='#3b82f6')
        ax.set_xlabel(x_column, fontsize=12)
        ax.set_ylabel(y_column, fontsize=12)
        ax.set_title(f'{y_column} 趋势图', fontsize=14)
        ax.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        
        return {
            "type": "line_chart",
            "x_column": x_column,
            "y_column": y_column,
            "image_base64": VisualizationService._fig_to_base64(fig),
            "data_points": len(plot_df)
        }
    
    @staticmethod
    def generate_correlation_heatmap(df: pd.DataFrame) -> Dict[str, Any]:
        """生成相关性热力图"""
        numeric_df = df.select_dtypes(include=[np.number])
        
        if len(numeric_df.columns) < 2:
            return {"error": "需要至少2个数值型列"}
        
        corr_matrix = numeric_df.corr()
        
        fig, ax = plt.subplots(figsize=(max(8, len(corr_matrix.columns)), max(6, len(corr_matrix.columns) * 0.6)))
        sns.heatmap(corr_matrix, annot=True, cmap='RdBu_r', center=0, 
                   square=True, fmt='.2f', cbar_kws={'shrink': 0.8}, ax=ax)
        ax.set_title('数值型特征相关性热力图', fontsize=14)
        
        return {
            "type": "correlation_heatmap",
            "columns": list(corr_matrix.columns),
            "image_base64": VisualizationService._fig_to_base64(fig),
            "correlation_matrix": {str(col): {str(k): float(v) for k, v in corr_matrix[col].items()} 
                                   for col in corr_matrix.columns}
        }
    
    @staticmethod
    def generate_box_plot(df: pd.DataFrame, column: str) -> Dict[str, Any]:
        """生成箱线图"""
        if column not in df.columns:
            return {"error": f"列 '{column}' 不存在"}
        
        data = df[column].dropna()
        if not pd.api.types.is_numeric_dtype(data):
            return {"error": f"列 '{column}' 不是数值型数据"}
        
        fig, ax = plt.subplots(figsize=(10, 6))
        bp = ax.boxplot(data, vert=True, patch_artist=True,
                        labels=[column],
                        boxprops=dict(facecolor='#3b82f6', alpha=0.7),
                        medianprops=dict(color='red', linewidth=2))
        ax.set_ylabel('值', fontsize=12)
        ax.set_title(f'{column} 箱线图', fontsize=14)
        ax.grid(True, alpha=0.3, axis='y')
        
        # 计算统计值
        q1 = data.quantile(0.25)
        q3 = data.quantile(0.75)
        iqr = q3 - q1
        
        return {
            "type": "box_plot",
            "column": column,
            "image_base64": VisualizationService._fig_to_base64(fig),
            "statistics": {
                "min": round(float(data.min()), 4),
                "q1": round(float(q1), 4),
                "median": round(float(data.median()), 4),
                "q3": round(float(q3), 4),
                "max": round(float(data.max()), 4),
                "iqr": round(float(iqr), 4),
                "outlier_count": len(data[(data < q1 - 1.5*iqr) | (data > q3 + 1.5*iqr)])
            }
        }
    
    @staticmethod
    def auto_generate_charts(df: pd.DataFrame, max_charts: int = 6) -> List[Dict[str, Any]]:
        """
        自动根据数据类型生成合适的图表
        """
        charts = []
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        datetime_cols = df.select_dtypes(include=['datetime64']).columns.tolist()
        
        chart_count = 0
        
        # 1. 相关性热力图（如果有多个数值列）
        if len(numeric_cols) >= 2 and chart_count < max_charts:
            try:
                result = VisualizationService.generate_correlation_heatmap(df)
                if "error" not in result:
                    charts.append(result)
                    chart_count += 1
            except:
                pass
        
        # 2. 数值型列的直方图
        for col in numeric_cols[:3]:
            if chart_count >= max_charts:
                break
            try:
                result = VisualizationService.generate_histogram(df, col)
                if "error" not in result:
                    charts.append(result)
                    chart_count += 1
            except:
                pass
        
        # 3. 分类列的柱状图
        for col in categorical_cols[:2]:
            if chart_count >= max_charts:
                break
            try:
                result = VisualizationService.generate_bar_chart(df, col)
                if "error" not in result:
                    charts.append(result)
                    chart_count += 1
            except:
                pass
        
        return charts
