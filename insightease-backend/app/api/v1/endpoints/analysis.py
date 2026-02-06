"""分析模块 API"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import uuid
from datetime import datetime
import pandas as pd
import numpy as np

from app.core.database import get_db
from app.models import Analysis, Dataset, User
from app.schemas.base import ResponseModel
from app.schemas.analysis import AnalysisCreate, AnalysisResponse
from app.services.analysis_service import AnalysisService
from app.services.visualization_service import VisualizationService
from app.services.prediction_service import PredictionService
from app.services.path_analysis_service import PathAnalysisService
from app.services.attribution_service import AttributionService
from app.services.sequence_mining_service import SequenceMiningService
from app.services.ai_service import ai_service
from app.api.v1.endpoints.auth import get_current_active_user
from app.api.v1.endpoints.datasets import read_csv_with_auto_header

router = APIRouter()


def clean_json_data(obj):
    """
    清理数据中的特殊值，使其可以被 JSON 序列化并存储到 MySQL
    处理：NaN, Infinity, -Infinity, numpy 类型等
    """
    if isinstance(obj, dict):
        return {k: clean_json_data(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_json_data(item) for item in obj]
    elif isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return clean_json_data(obj.tolist())
    elif pd.isna(obj):
        return None
    else:
        return obj


async def execute_analysis_task(analysis_id: str, dataset_id: str, 
                                analysis_type: str, params: dict, user_id: str):
    """
    后台执行分析任务
    注意：后台任务需要自己创建数据库会话
    """
    import logging
    logger = logging.getLogger(__name__)
    
    from app.core.database import AsyncSessionLocal
    
    logger.info(f"Starting analysis task: {analysis_id}, type: {analysis_type}")
    
    async with AsyncSessionLocal() as db:
        try:
            # 获取数据集
            result = await db.execute(
                select(Dataset).where(Dataset.id == dataset_id, Dataset.is_deleted == False)
            )
            dataset = result.scalar_one_or_none()
            
            if not dataset:
                logger.error(f"Dataset not found: {dataset_id}")
                await update_analysis_status(db, analysis_id, "failed", error_msg="数据集不存在")
                return
            
            logger.info(f"Dataset found: {dataset.filename}, path: {dataset.storage_path}")
            
            # 读取数据文件
            file_path = dataset.storage_path
            logger.info(f"Reading file: {file_path}")
            try:
                if file_path.endswith('.csv'):
                    df = read_csv_with_auto_header(file_path)
                elif file_path.endswith(('.xlsx', '.xls')):
                    df = pd.read_excel(file_path)
                else:
                    logger.error(f"Unsupported file format: {file_path}")
                    await update_analysis_status(db, analysis_id, "failed", 
                                               error_msg="不支持的文件格式")
                    return
                logger.info(f"File loaded successfully, shape: {df.shape}")
            except Exception as e:
                logger.error(f"Failed to read file: {e}")
                await update_analysis_status(db, analysis_id, "failed", 
                                           error_msg=f"读取文件失败: {str(e)}")
                return
            
            # 执行不同类型的分析
            result_data = {}
            logger.info(f"Executing analysis type: {analysis_type}")
            
            if analysis_type == "descriptive":
                # 描述性统计
                logger.info("Running descriptive analysis...")
                result_data = AnalysisService.descriptive_analysis(df)
                logger.info(f"Descriptive analysis completed, columns: {len(result_data.get('column_stats', []))}")
                
            elif analysis_type == "correlation":
                # 相关性分析
                result_data = AnalysisService.correlation_analysis(df)
                
            elif analysis_type == "distribution":
                # 分布分析
                column = params.get("column")
                if not column:
                    # 自动选择第一个数值列
                    numeric_cols = df.select_dtypes(include=['number']).columns
                    column = numeric_cols[0] if len(numeric_cols) > 0 else df.columns[0]
                result_data = AnalysisService.distribution_analysis(df, column)
                
            elif analysis_type == "outlier":
                # 异常值检测
                column = params.get("column")
                result_data = AnalysisService.outlier_detection(df, column)
                
            elif analysis_type == "visualization":
                # 可视化分析
                chart_type = params.get("chart_type", "auto")
                
                if chart_type == "auto":
                    # 自动生成图表
                    result_data = {
                        "charts": VisualizationService.auto_generate_charts(df)
                    }
                elif chart_type == "histogram":
                    column = params.get("column", df.select_dtypes(include=['number']).columns[0])
                    result_data = VisualizationService.generate_histogram(df, column)
                elif chart_type == "scatter":
                    x_col = params.get("x_column")
                    y_col = params.get("y_column")
                    if not x_col or not y_col:
                        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
                        if len(numeric_cols) >= 2:
                            x_col, y_col = numeric_cols[0], numeric_cols[1]
                    result_data = VisualizationService.generate_scatter_plot(df, x_col, y_col)
                elif chart_type == "heatmap":
                    result_data = VisualizationService.generate_correlation_heatmap(df)
                elif chart_type == "boxplot":
                    column = params.get("column", df.select_dtypes(include=['number']).columns[0])
                    result_data = VisualizationService.generate_box_plot(df, column)
                else:
                    result_data = {"error": f"不支持的图表类型: {chart_type}"}
                    
            elif analysis_type == "forecast":
                # 时间序列预测（电商增强版）
                value_col = params.get("value_column")
                if not value_col:
                    # 自动选择数值列
                    numeric_cols = df.select_dtypes(include=['number']).columns
                    if len(numeric_cols) == 0:
                        await update_analysis_status(db, analysis_id, "failed",
                                                   error_msg="没有数值型列可供预测")
                        return
                    value_col = numeric_cols[0]
                
                periods = params.get("periods", 30)
                model = params.get("model", "prophet")
                promotions = params.get("promotions", [])
                auxiliary_vars = params.get("auxiliary_variables", [])
                
                # 获取日期列
                date_col = params.get("date_column")
                if not date_col:
                    date_col = PredictionService.detect_datetime_column(df)
                
                if model == "prophet":
                    result_data = PredictionService.prophet_forecast(
                        df, date_col, value_col, periods,
                        promotions=promotions,
                        auxiliary_vars=auxiliary_vars
                    )
                elif model == "lightgbm":
                    result_data = PredictionService.lightgbm_forecast(
                        df, date_col, value_col, periods,
                        promotions=promotions,
                        auxiliary_vars=auxiliary_vars
                    )
                else:
                    # 默认使用 Prophet
                    result_data = PredictionService.prophet_forecast(
                        df, date_col, value_col, periods,
                        promotions=promotions,
                        auxiliary_vars=auxiliary_vars
                    )
            
            elif analysis_type == "what_if":
                # What-if 分析：基于基准预测和变量调整
                base_forecast = params.get("base_forecast")
                adjustments = params.get("adjustments", [])
                
                if not base_forecast:
                    result_data = {"error": "缺少基准预测数据"}
                else:
                    result_data = PredictionService.what_if_analysis(
                        base_forecast, adjustments
                    )
            
            elif analysis_type == "auto_model_select":
                # 自动模型选择
                logger.info("Starting auto model selection...")
                
                date_col = params.get("date_column") or PredictionService.detect_datetime_column(df)
                value_col = params.get("value_column")
                
                if not value_col:
                    numeric_cols = df.select_dtypes(include=['number']).columns
                    if len(numeric_cols) == 0:
                        result_data = {"error": "没有数值型列可供预测"}
                    else:
                        value_col = numeric_cols[0]
                
                if date_col and value_col:
                    result_data = PredictionService.auto_select_model(
                        df, date_col, value_col, periods=params.get("periods", 30)
                    )
                else:
                    result_data = {"error": "无法自动检测日期列或数值列"}
            
            elif analysis_type == "batch_forecast":
                # 批量预测
                logger.info("Starting batch forecast...")
                
                date_col = params.get("date_column") or PredictionService.detect_datetime_column(df)
                value_cols = params.get("value_columns", [])
                
                # 如果没有指定列，使用所有数值列
                if not value_cols:
                    value_cols = df.select_dtypes(include=['number']).columns.tolist()
                    # 排除可能的ID列
                    value_cols = [c for c in value_cols if not any(x in c.lower() for x in ['id', 'code', 'index'])]
                
                if len(value_cols) == 0:
                    result_data = {"error": "没有可用的数值列进行预测"}
                elif len(value_cols) > 20:
                    result_data = {"error": "批量预测最多支持20个SKU/品类"}
                else:
                    result_data = PredictionService.batch_forecast(
                        df, date_col, value_cols,
                        periods=params.get("periods", 30),
                        model=params.get("model", "prophet"),
                        promotions=params.get("promotions", [])
                    )
                
            elif analysis_type == "comprehensive":
                # 综合分析（包含描述性统计、相关性、可视化）
                result_data = {
                    "descriptive": AnalysisService.descriptive_analysis(df),
                    "correlation": AnalysisService.correlation_analysis(df),
                    "visualizations": VisualizationService.auto_generate_charts(df, max_charts=4)
                }

            elif analysis_type == "smart_process":
                # 智能数据处理
                logger.info("Starting smart data processing...")
                
                # 获取处理配置
                missing_strategy = params.get("missingValueStrategy", "mean")
                missing_fill_value = params.get("missingValueFill", "0")
                duplicate_strategy = params.get("duplicateStrategy", "drop")
                outlier_strategy = params.get("outlierStrategy", "none")
                outlier_method = params.get("outlierMethod", "iqr")
                outlier_threshold = params.get("outlierThreshold", 1.5)
                standardization = params.get("standardization", "none")
                type_conversion = params.get("typeConversion", True)
                
                # 记录原始数据状态
                original_rows = len(df)
                original_nulls = df.isnull().sum().sum()
                
                # 1. 处理缺失值
                if missing_strategy != "none":
                    if missing_strategy == "drop":
                        df = df.dropna()
                    elif missing_strategy == "mean":
                        for col in df.select_dtypes(include=['number']).columns:
                            df[col].fillna(df[col].mean(), inplace=True)
                    elif missing_strategy == "median":
                        for col in df.select_dtypes(include=['number']).columns:
                            df[col].fillna(df[col].median(), inplace=True)
                    elif missing_strategy == "mode":
                        for col in df.columns:
                            if not df[col].mode().empty:
                                df[col].fillna(df[col].mode()[0], inplace=True)
                    elif missing_strategy == "fill":
                        df.fillna(missing_fill_value, inplace=True)
                
                # 2. 处理重复值
                duplicates_removed = 0
                if duplicate_strategy != "none":
                    before_dedup = len(df)
                    if duplicate_strategy == "drop":
                        df = df.drop_duplicates()
                    elif duplicate_strategy == "keep_first":
                        df = df.drop_duplicates(keep="first")
                    elif duplicate_strategy == "keep_last":
                        df = df.drop_duplicates(keep="last")
                    duplicates_removed = before_dedup - len(df)
                
                # 3. 处理异常值
                outliers_removed = 0
                if outlier_strategy != "none" and outlier_strategy != "mark":
                    numeric_cols = df.select_dtypes(include=['number']).columns
                    for col in numeric_cols:
                        if outlier_method == "iqr":
                            Q1 = df[col].quantile(0.25)
                            Q3 = df[col].quantile(0.75)
                            IQR = Q3 - Q1
                            lower = Q1 - outlier_threshold * IQR
                            upper = Q3 + outlier_threshold * IQR
                            
                            if outlier_strategy == "drop":
                                before_filter = len(df)
                                df = df[(df[col] >= lower) & (df[col] <= upper)]
                                outliers_removed += before_filter - len(df)
                            elif outlier_strategy == "clip":
                                df[col] = df[col].clip(lower, upper)
                        elif outlier_method == "zscore":
                            z_scores = (df[col] - df[col].mean()) / df[col].std()
                            if outlier_strategy == "drop":
                                before_filter = len(df)
                                df = df[abs(z_scores) < outlier_threshold]
                                outliers_removed += before_filter - len(df)
                            elif outlier_strategy == "clip":
                                mean = df[col].mean()
                                std = df[col].std()
                                lower = mean - outlier_threshold * std
                                upper = mean + outlier_threshold * std
                                df[col] = df[col].clip(lower, upper)
                
                # 4. 数据标准化
                if standardization != "none":
                    from sklearn.preprocessing import StandardScaler, MinMaxScaler
                    numeric_cols = df.select_dtypes(include=['number']).columns
                    
                    if standardization == "zscore":
                        scaler = StandardScaler()
                        df[numeric_cols] = scaler.fit_transform(df[numeric_cols])
                    elif standardization == "minmax":
                        scaler = MinMaxScaler()
                        df[numeric_cols] = scaler.fit_transform(df[numeric_cols])
                    elif standardization == "log":
                        for col in numeric_cols:
                            if (df[col] > 0).all():
                                df[col] = np.log1p(df[col])
                
                # 5. 自动类型转换
                if type_conversion:
                    for col in df.columns:
                        if df[col].dtype == "object":
                            try:
                                df[col] = pd.to_numeric(df[col], errors="ignore")
                            except:
                                pass
                            try:
                                df[col] = pd.to_datetime(df[col], errors="ignore")
                            except:
                                pass
                
                # 计算处理后的状态
                processed_rows = len(df)
                processed_nulls = df.isnull().sum().sum()
                removed_rows = original_rows - processed_rows
                fixed_nulls = original_nulls - processed_nulls
                
                # 生成新数据集文件
                import os
                import re
                from datetime import datetime
                
                # 创建输出文件名：原数据名称_处理日期_第几次处理.原格式
                # 获取原始文件名（不含uuid前缀）
                original_filename = os.path.basename(file_path)
                # 去掉可能的uuid前缀 (8-4-4-4-12 格式)
                base_name = re.sub(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_', '', 
                                  os.path.splitext(original_filename)[0])
                original_ext = os.path.splitext(original_filename)[1]  # 获取原格式
                date_str = datetime.now().strftime("%Y%m%d")
                
                # 查找已有的处理次数
                result_existing = await db.execute(
                    select(Dataset).where(
                        Dataset.user_id == user_id,
                        Dataset.filename.like(f"{base_name}_%")
                    )
                )
                existing_datasets = result_existing.scalars().all()
                
                # 计算处理次数
                process_count = 1
                for ds in existing_datasets:
                    match = re.search(rf'{re.escape(base_name)}_\d{{8}}_(\d+)\.', ds.filename)
                    if match:
                        process_count = max(process_count, int(match.group(1)) + 1)
                
                output_filename = f"{base_name}_{date_str}_{process_count}{original_ext}"
                output_path = os.path.join(os.path.dirname(file_path), output_filename)
                
                # 保存处理后的数据 - 保持与原文件相同的格式
                if original_ext.lower() in ['.xlsx', '.xls']:
                    df.to_excel(output_path, index=False, engine='openpyxl')
                else:
                    # CSV 格式，确保数据完整性
                    df.to_csv(output_path, index=False, encoding='utf-8-sig')
                logger.info(f"Processed data saved to: {output_path}")
                
                # 计算文件大小
                file_size = os.path.getsize(output_path)
                
                # 生成数据集ID
                output_dataset_id = str(uuid.uuid4())
                
                # 计算质量评分
                quality_score = calculate_quality_score(df)
                logger.info(f"Calculated quality score: {quality_score}")
                
                # 生成 schema
                schema = []
                for col in df.columns:
                    dtype = str(df[col].dtype)
                    unique_count = int(df[col].nunique())
                    sample_values = df[col].dropna().head(5).tolist()
                    
                    # 确定列类型
                    col_type = 'other'
                    if df[col].dtype in ['int64', 'float64', 'int32', 'float32']:
                        col_type = 'numeric'
                    elif df[col].dtype == 'object':
                        col_type = 'categorical'
                    elif 'datetime' in str(df[col].dtype):
                        col_type = 'datetime'
                    
                    schema.append({
                        "name": col,
                        "dtype": dtype,
                        "type": col_type,
                        "unique_count": unique_count,
                        "sample_values": sample_values
                    })
                
                # 创建数据集记录
                new_dataset = Dataset(
                    id=output_dataset_id,
                    user_id=user_id,
                    filename=output_filename,
                    storage_path=output_path,
                    file_size=file_size,
                    row_count=len(df),
                    col_count=len(df.columns),
                    status="ready",
                    is_deleted=False,
                    quality_score=quality_score,
                    schema=clean_json_data(schema)
                )
                db.add(new_dataset)
                await db.commit()
                
                logger.info(f"New dataset created: {output_dataset_id}")
                
                # 构建结果
                result_data = {
                    "original_rows": original_rows,
                    "processed_rows": processed_rows,
                    "removed_rows": removed_rows,
                    "original_nulls": int(original_nulls),
                    "processed_nulls": int(processed_nulls),
                    "fixed_nulls": int(fixed_nulls),
                    "duplicates_removed": duplicates_removed,
                    "outliers_removed": outliers_removed,
                    "output_dataset_id": output_dataset_id,
                    "output_dataset_name": output_filename,
                    "processing_config": {
                        "missing_strategy": missing_strategy,
                        "duplicate_strategy": duplicate_strategy,
                        "outlier_strategy": outlier_strategy,
                        "standardization": standardization
                    }
                }
                
                logger.info(f"Smart processing completed: {result_data}")
            
            elif analysis_type == "path":
                # 路径分析
                logger.info("Starting path analysis...")
                path_type = params.get("path_type", "funnel")  # funnel, path, clustering, key_path
                user_id_col = params.get("user_id_col")
                event_col = params.get("event_col")
                timestamp_col = params.get("timestamp_col")
                
                if not all([user_id_col, event_col, timestamp_col]):
                    raise ValueError("路径分析需要指定用户ID列、事件列和时间戳列")
                
                if path_type == "funnel":
                    funnel_steps = params.get("funnel_steps", [])
                    time_window = params.get("time_window")
                    if not funnel_steps:
                        raise ValueError("漏斗分析需要指定漏斗步骤")
                    result_data = PathAnalysisService.funnel_analysis(
                        df, user_id_col, event_col, timestamp_col, 
                        funnel_steps, time_window
                    )
                    
                elif path_type == "path":
                    max_path_length = params.get("max_path_length", 10)
                    min_user_count = params.get("min_user_count", 5)
                    result_data = PathAnalysisService.path_analysis(
                        df, user_id_col, event_col, timestamp_col,
                        max_path_length, min_user_count
                    )
                    
                elif path_type == "clustering":
                    n_clusters = params.get("n_clusters", 3)
                    max_path_length = params.get("max_path_length", 10)
                    result_data = PathAnalysisService.path_clustering(
                        df, user_id_col, event_col, timestamp_col,
                        n_clusters, max_path_length
                    )
                    
                elif path_type == "key_path":
                    start_event = params.get("start_event")
                    end_event = params.get("end_event")
                    max_steps = params.get("max_steps", 10)
                    if not start_event or not end_event:
                        raise ValueError("关键路径分析需要指定起点和终点事件")
                    result_data = PathAnalysisService.key_path_analysis(
                        df, user_id_col, event_col, timestamp_col,
                        start_event, end_event, max_steps
                    )
                    
                else:
                    raise ValueError(f"未知的路径分析类型: {path_type}")
                    
                logger.info(f"Path analysis completed: {path_type}")
            
            elif analysis_type == "attribution":
                # 归因分析
                logger.info("Starting attribution analysis...")
                user_id_col = params.get("user_id_col")
                touchpoint_col = params.get("touchpoint_col")
                timestamp_col = params.get("timestamp_col")
                conversion_col = params.get("conversion_col")
                conversion_value_col = params.get("conversion_value_col")
                additional_touchpoint_cols = params.get("additional_touchpoint_cols")
                models = params.get("models", ["first_touch", "last_touch", "linear"])
                
                if not all([user_id_col, touchpoint_col, timestamp_col]):
                    raise ValueError("归因分析需要指定用户ID列、触点列和时间戳列")
                
                result_data = AttributionService.attribution_analysis(
                    df, user_id_col, touchpoint_col, timestamp_col,
                    conversion_col, conversion_value_col, models,
                    additional_touchpoint_cols=additional_touchpoint_cols
                )
                logger.info(f"Attribution analysis completed with models: {models}")
                
            elif analysis_type == "sequence_mining":
                # 序列模式挖掘
                logger.info("Starting sequence pattern mining...")
                user_id_col = params.get("user_id_col")
                event_col = params.get("event_col")
                timestamp_col = params.get("timestamp_col")
                conversion_col = params.get("conversion_col")
                additional_event_cols = params.get("additional_event_cols")
                min_support = params.get("min_support", 0.1)
                max_pattern_length = params.get("max_pattern_length", 5)
                min_confidence = params.get("min_confidence", 0.5)
                
                if not all([user_id_col, event_col, timestamp_col]):
                    raise ValueError("序列模式挖掘需要指定用户ID列、事件列和时间戳列")
                
                result_data = SequenceMiningService.sequence_pattern_mining(
                    df, user_id_col, event_col, timestamp_col,
                    min_support=min_support,
                    max_pattern_length=max_pattern_length,
                    conversion_col=conversion_col,
                    min_confidence=min_confidence,
                    additional_event_cols=additional_event_cols
                )
                logger.info("Sequence pattern mining completed")
                
            else:
                result_data = {"error": f"未知的分析类型: {analysis_type}"}
            
            # 如果数据量不大，生成AI摘要
            if len(df) <= 1000 and analysis_type in ["descriptive", "comprehensive"]:
                try:
                    ai_result = await ai_service.interpret_data(df, "general")
                    result_data["ai_summary"] = ai_result["interpretation"]
                    
                    # 更新数据集的AI摘要
                    result_dataset = await db.execute(
                        select(Dataset).where(Dataset.id == dataset_id)
                    )
                    dataset_obj = result_dataset.scalar_one_or_none()
                    if dataset_obj:
                        dataset_obj.ai_summary = ai_result["interpretation"][:500]  # 限制长度
                        await db.commit()
                except Exception as e:
                    # AI摘要生成失败不影响主分析
                    pass
            
            # 更新分析结果
            logger.info(f"Updating analysis status to completed, result_data keys: {result_data.keys() if result_data else 'None'}")
            await update_analysis_status(db, analysis_id, "completed", result_data=result_data)
            logger.info(f"Analysis {analysis_id} completed successfully")
            
        except Exception as e:
            import traceback
            error_msg = f"分析执行失败: {str(e)}\n{traceback.format_exc()}"
            logger.error(f"Analysis {analysis_id} failed: {error_msg}")
            await update_analysis_status(db, analysis_id, "failed", error_msg=error_msg)


def calculate_quality_score(df: pd.DataFrame) -> int:
    """
    计算数据集质量评分
    基于以下维度：
    - 完整性（40分）：缺失值比例
    - 一致性（30分）：重复值比例
    - 有效性（30分）：异常值比例
    """
    total_rows = len(df)
    if total_rows == 0:
        return 0
    
    score = 0
    
    # 1. 完整性评分（40分）- 基于缺失值
    null_count = df.isnull().sum().sum()
    total_cells = total_rows * len(df.columns)
    if total_cells > 0:
        completeness = 1 - (null_count / total_cells)
        score += int(completeness * 40)
    else:
        score += 40
    
    # 2. 一致性评分（30分）- 基于重复值
    unique_rows = len(df.drop_duplicates())
    if total_rows > 0:
        consistency = unique_rows / total_rows
        score += int(consistency * 30)
    else:
        score += 30
    
    # 3. 有效性评分（30分）- 基于数值型列的异常值
    numeric_cols = df.select_dtypes(include=['number']).columns
    if len(numeric_cols) > 0:
        outlier_ratios = []
        for col in numeric_cols:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)].shape[0]
            outlier_ratios.append(outliers / total_rows)
        
        avg_outlier_ratio = sum(outlier_ratios) / len(outlier_ratios)
        validity = 1 - min(avg_outlier_ratio * 2, 1.0)  # 异常值比例翻倍惩罚
        score += int(validity * 30)
    else:
        score += 30  # 没有数值列，默认给满分
    
    return min(max(score, 0), 100)


async def update_analysis_status(db: AsyncSession, analysis_id: str, status: str,
                                  result_data: dict = None, error_msg: str = None):
    """更新分析任务状态"""
    import logging
    logger = logging.getLogger(__name__)
    
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    
    if analysis:
        analysis.status = status
        analysis.completed_at = datetime.now() if status in ["completed", "failed"] else None
        if result_data is not None:
            # 清理数据中的特殊值，使其可以被 JSON 序列化
            analysis.result_data = clean_json_data(result_data)
        if error_msg is not None:
            analysis.error_msg = error_msg
        await db.commit()
        logger.info(f"Analysis {analysis_id} status updated to: {status}")
    else:
        logger.error(f"Analysis {analysis_id} not found when updating status")


@router.post("/", response_model=ResponseModel[AnalysisResponse], status_code=202)
async def create_analysis(
    payload: AnalysisCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    创建分析任务
    
    分析类型:
    - descriptive: 描述性统计分析
    - correlation: 相关性分析
    - distribution: 分布分析 (params: {column: "列名"})
    - outlier: 异常值检测 (params: {column: "列名"})
    - visualization: 可视化分析 (params: {chart_type: "auto|histogram|scatter|heatmap|boxplot", ...})
    - forecast: 时间序列预测 (params: {value_column: "列名", periods: 30})
    - comprehensive: 综合分析
    """
    # 检查数据集是否存在且属于当前用户
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == payload.dataset_id, 
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, detail="数据集不存在")
    
    # 创建分析任务
    analysis = Analysis(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        dataset_id=payload.dataset_id,
        type=payload.analysis_type,
        status="pending",
        params=payload.params
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    
    # 后台执行分析任务（不传递db，后台任务自己创建会话）
    background_tasks.add_task(
        execute_analysis_task,
        analysis.id,
        payload.dataset_id,
        payload.analysis_type,
        payload.params,
        current_user.id
    )
    
    # 立即更新为运行中状态
    analysis.status = "running"
    await db.commit()
    
    return ResponseModel(code=202, message="分析任务已创建并开始执行", data=analysis)


@router.get("", response_model=ResponseModel[dict])
async def list_analyses(
    dataset_id: str = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取分析任务列表"""
    from sqlalchemy import func
    
    # 构建查询（只能查看自己的分析任务）
    query = select(Analysis).where(Analysis.user_id == current_user.id)
    if dataset_id:
        query = query.where(Analysis.dataset_id == dataset_id)
    
    # 获取总数
    count_query = select(func.count(Analysis.id)).where(Analysis.user_id == current_user.id)
    if dataset_id:
        count_query = count_query.where(Analysis.dataset_id == dataset_id)
    count_result = await db.execute(count_query)
    total = count_result.scalar()
    
    # 获取分页数据
    result = await db.execute(
        query.order_by(desc(Analysis.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    
    # 将模型对象转换为字典
    analyses = result.scalars().all()
    items = []
    for analysis in analyses:
        items.append({
            "id": analysis.id,
            "user_id": analysis.user_id,
            "dataset_id": analysis.dataset_id,
            "type": analysis.type,
            "status": analysis.status,
            "params": analysis.params,
            "result_data": analysis.result_data,
            "error_msg": analysis.error_msg,
            "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
            "completed_at": analysis.completed_at.isoformat() if analysis.completed_at else None
        })
    
    return ResponseModel(data={
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items
    })


@router.get("/{analysis_id}", response_model=ResponseModel[AnalysisResponse])
async def get_analysis(
    analysis_id: str, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取单个分析任务详情"""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(404, detail="分析任务不存在")
    return ResponseModel(data=analysis)


@router.get("/{analysis_id}/result")
async def get_analysis_result(
    analysis_id: str, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    获取分析结果
    如果分析未完成，会返回当前状态
    """
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(404, detail="分析任务不存在")
    
    return ResponseModel(data={
        "analysis_id": analysis.id,
        "status": analysis.status,
        "type": analysis.type,
        "params": analysis.params,
        "result_data": analysis.result_data,
        "error_msg": analysis.error_msg,
        "created_at": analysis.created_at,
        "completed_at": analysis.completed_at
    })


@router.delete("/{analysis_id}")
async def delete_analysis(
    analysis_id: str, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """删除分析任务"""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(404, detail="分析任务不存在")
    
    await db.delete(analysis)
    await db.commit()
    return ResponseModel(message="分析任务已删除")


# ========== 路径分析专用端点 ==========

from pydantic import BaseModel

class QuickPathAnalysisRequest(BaseModel):
    """快速路径分析请求"""
    dataset_id: str
    path_type: str  # funnel, path, clustering, key_path
    user_id_col: str
    event_col: str
    timestamp_col: str
    # 漏斗分析参数
    funnel_steps: Optional[List[str]] = None
    time_window: Optional[int] = None
    # 路径分析参数
    max_path_length: int = 10
    min_user_count: int = 5
    # 聚类参数
    n_clusters: int = 3
    cluster_mode: str = "smart"  # "smart" 或 "custom"
    cluster_custom_columns: Optional[List[str]] = None  # 自定义聚类维度
    additional_event_cols: Optional[List[str]] = None  # 联合分析的事件列列表（可多选）
    selected_features: Optional[List[str]] = None  # 智能模式下选择的特征列表
    # 关键路径参数
    start_event: Optional[str] = None
    end_event: Optional[str] = None
    max_steps: int = 10


@router.post("/path/quick", response_model=ResponseModel[dict])
async def quick_path_analysis(
    request: QuickPathAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    快速路径分析（同步执行，适用于小数据集）
    
    - path_type=funnel: 漏斗分析，需要 funnel_steps
    - path_type=path: 路径分析
    - path_type=clustering: 路径聚类
    - path_type=key_path: 关键路径分析，需要 start_event 和 end_event
    """
    dataset_id = request.dataset_id
    path_type = request.path_type
    user_id_col = request.user_id_col
    event_col = request.event_col
    timestamp_col = request.timestamp_col
    funnel_steps = request.funnel_steps
    time_window = request.time_window
    max_path_length = request.max_path_length
    min_user_count = request.min_user_count
    n_clusters = request.n_clusters
    cluster_mode = request.cluster_mode
    cluster_custom_columns = request.cluster_custom_columns
    additional_event_cols = request.additional_event_cols
    selected_features = request.selected_features
    start_event = request.start_event
    end_event = request.end_event
    max_steps = request.max_steps
    # 检查数据集
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    try:
        # 读取数据
        file_path = dataset.storage_path
        if file_path.endswith('.csv'):
            df = read_csv_with_auto_header(file_path)
        elif file_path.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file_path)
        else:
            raise HTTPException(400, detail="不支持的文件格式")
        
        # 检查必要列是否存在
        for col in [user_id_col, event_col, timestamp_col]:
            if col not in df.columns:
                raise HTTPException(400, detail=f"列 '{col}' 不存在于数据集中")
        
        # 执行分析
        if path_type == "funnel":
            if not funnel_steps:
                raise HTTPException(400, detail="漏斗分析需要提供 funnel_steps")
            result_data = PathAnalysisService.funnel_analysis(
                df, user_id_col, event_col, timestamp_col, funnel_steps, time_window
            )
        elif path_type == "path":
            result_data = PathAnalysisService.path_analysis(
                df, user_id_col, event_col, timestamp_col, max_path_length, min_user_count
            )
        elif path_type == "clustering":
            result_data = PathAnalysisService.path_clustering(
                df, user_id_col, event_col, timestamp_col, 
                n_clusters=n_clusters, 
                max_path_length=max_path_length,
                mode=cluster_mode, 
                custom_columns=cluster_custom_columns, 
                additional_event_cols=additional_event_cols,
                selected_features=selected_features
            )
        elif path_type == "key_path":
            if not start_event or not end_event:
                raise HTTPException(400, detail="关键路径分析需要提供 start_event 和 end_event")
            result_data = PathAnalysisService.key_path_analysis(
                df, user_id_col, event_col, timestamp_col, start_event, end_event, max_steps
            )
        else:
            raise HTTPException(400, detail=f"未知的路径分析类型: {path_type}")
        
        return ResponseModel(data=result_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"分析失败: {str(e)}")


@router.get("/path/columns/{dataset_id}", response_model=ResponseModel[dict])
async def get_path_columns(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取数据集中适合路径分析的列"""
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    try:
        # 读取样本数据
        file_path = dataset.storage_path
        if file_path.endswith('.csv'):
            df = read_csv_with_auto_header(file_path, nrows=100)
        elif file_path.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file_path, nrows=100)
        else:
            raise HTTPException(400, detail="不支持的文件格式")
        
        # 分析每列的类型
        columns = []
        for col in df.columns:
            dtype = str(df[col].dtype)
            sample_values = df[col].dropna().head(5).tolist()
            
            col_lower = col.lower()
            
            # 判断列类型
            if dtype.startswith('int') or dtype.startswith('float'):
                col_type = 'numeric'
            elif dtype.startswith('datetime') or 'time' in col_lower:
                col_type = 'datetime'
            else:
                col_type = 'categorical'
            
            # 判断可能的用途（根据列名关键词 + 数据特征）
            suggestions = []
            
            # user_id: 列名包含 id/user/uuid/uid 且为数值或字符串类型
            if any(kw in col_lower for kw in ['id', 'user', 'uuid', 'uid', '用户']):
                suggestions.append('user_id')
            # 额外判断：数值型且有一定唯一性的也可能是user_id
            elif col_type == 'numeric' and df[col].nunique() > min(10, len(df) * 0.1):
                if df[col].nunique() < len(df) * 0.9:  # 但不应每行都不同（排除自增ID）
                    suggestions.append('user_id')
            
            # event: 列名包含 event/page/action/type/block/click 或分类型
            if any(kw in col_lower for kw in ['event', 'page', 'action', 'type', 'block', 'click', '事件', '页面', '模块']):
                suggestions.append('event')
            elif col_type == 'categorical' and df[col].nunique() < 50:
                suggestions.append('event')
            
            # timestamp: 列名包含 time/date/timestamp 或时间类型
            if any(kw in col_lower for kw in ['time', 'date', 'timestamp', '时间']):
                suggestions.append('timestamp')
            elif col_type == 'datetime':
                suggestions.append('timestamp')
            
            columns.append({
                "name": col,
                "type": col_type,
                "dtype": dtype,
                "unique_count": int(df[col].nunique()),
                "sample_values": [str(v) for v in sample_values],
                "suggestions": suggestions
            })
        
        return ResponseModel(data={
            "columns": columns,
            "suggested_user_id": next((c["name"] for c in columns if "user_id" in c["suggestions"]), None),
            "suggested_event": next((c["name"] for c in columns if "event" in c["suggestions"]), None),
            "suggested_timestamp": next((c["name"] for c in columns if "timestamp" in c["suggestions"]), None)
        })
        
    except Exception as e:
        raise HTTPException(500, detail=f"获取列信息失败: {str(e)}")


class QuickSequenceMiningRequest(BaseModel):
    """快速序列模式挖掘请求"""
    dataset_id: str
    user_id_col: str
    event_col: str
    timestamp_col: str
    conversion_col: Optional[str] = None
    additional_event_cols: Optional[List[str]] = None  # 联合事件列列表
    min_support: float = 0.1
    max_pattern_length: int = 5
    min_confidence: float = 0.5


@router.post("/sequence/quick", response_model=ResponseModel[dict])
async def quick_sequence_mining(
    request: QuickSequenceMiningRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    快速序列模式挖掘（同步执行，适用于中小数据集）
    
    发现频繁的行为序列模式、关联规则和高转化路径
    """
    dataset_id = request.dataset_id
    
    # 检查数据集
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    try:
        # 读取数据
        file_path = dataset.storage_path
        if file_path.endswith('.csv'):
            df = read_csv_with_auto_header(file_path)
        elif file_path.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file_path)
        else:
            raise HTTPException(400, detail="不支持的文件格式")
        
        # 检查必要列是否存在
        for col in [request.user_id_col, request.event_col, request.timestamp_col]:
            if col not in df.columns:
                raise HTTPException(400, detail=f"列 '{col}' 不存在于数据集中")
        
        # 执行序列模式挖掘
        result_data = SequenceMiningService.sequence_pattern_mining(
            df, 
            request.user_id_col, 
            request.event_col, 
            request.timestamp_col,
            min_support=request.min_support,
            max_pattern_length=request.max_pattern_length,
            conversion_col=request.conversion_col,
            min_confidence=request.min_confidence,
            additional_event_cols=request.additional_event_cols
        )
        
        return ResponseModel(data=result_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"序列模式挖掘失败: {str(e)}")


# ========== 聚类分析 API ==========

class ClusteringRequest(BaseModel):
    """聚类分析请求"""
    dataset_id: str
    columns: List[str]
    n_clusters: int = 3
    data: Optional[List[List[float]]] = None  # 可选：前端直接提供数据


@router.post("/clustering", response_model=ResponseModel[dict])
async def run_clustering(
    request: ClusteringRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    运行K-Means聚类分析
    用于可视化散点图的聚类着色
    """
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score
    import numpy as np
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Clustering request: dataset_id={request.dataset_id}, columns={request.columns}, n_clusters={request.n_clusters}")
        
        # 如果前端提供了数据，直接使用
        if request.data and len(request.data) > 0:
            data = np.array(request.data)
            logger.info(f"Using frontend data: shape={data.shape}")
        else:
            # 否则从数据集读取
            result = await db.execute(
                select(Dataset).where(
                    Dataset.id == request.dataset_id,
                    Dataset.is_deleted == False,
                    Dataset.user_id == current_user.id
                )
            )
            dataset = result.scalar_one_or_none()
            if not dataset:
                raise HTTPException(404, detail="数据集不存在")
            
            # 读取数据
            file_path = dataset.storage_path
            if file_path.endswith('.csv'):
                df = read_csv_with_auto_header(file_path)
            elif file_path.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(file_path)
            else:
                raise HTTPException(400, detail="不支持的文件格式")
            
            # 检查列是否存在
            for col in request.columns:
                if col not in df.columns:
                    raise HTTPException(400, detail=f"列 '{col}' 不存在")
            
            # 提取数据
            selected_df = df[request.columns].dropna()
            
            # 检查是否还有数据
            if len(selected_df) == 0:
                raise HTTPException(400, detail="所选列的数据全部为空值，请检查数据质量")
            
            # 尝试转换为数值类型
            try:
                data = selected_df.astype(float).values
            except (ValueError, TypeError):
                raise HTTPException(400, detail="所选列包含非数值数据，聚类分析需要数值型数据")
        
        if len(data) < request.n_clusters:
            raise HTTPException(400, detail="数据点数量必须大于聚类数量")
        
        # 限制数据量以提高性能
        if len(data) > 5000:
            indices = np.random.choice(len(data), 5000, replace=False)
            data = data[indices]
        
        # 执行K-Means聚类
        n_clusters = min(request.n_clusters, len(data))
        
        # 处理只有一个样本的情况
        if len(data) == 1:
            return ResponseModel(data={
                "n_clusters": 1,
                "labels": [0],
                "centers": [data[0].tolist()],
                "silhouette_score": None,
                "cluster_sizes": [1],
                "columns": request.columns
            })
        
        # 尝试使用最新的 sklearn 参数
        try:
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        except TypeError:
            # 旧版本 sklearn 不支持 n_init 参数
            kmeans = KMeans(n_clusters=n_clusters, random_state=42)
            
        labels = kmeans.fit_predict(data)
        
        logger.info(f"Clustering completed: n_clusters={n_clusters}, labels unique={len(np.unique(labels))}")
        
        # 计算轮廓系数（聚类质量指标，-1到1，越接近1越好）
        silhouette = None
        unique_labels = np.unique(labels)
        if len(unique_labels) > 1 and len(data) > len(unique_labels):
            try:
                silhouette = float(silhouette_score(data, labels))
                logger.info(f"Silhouette score: {silhouette}")
            except Exception as e:
                logger.warning(f"Failed to calculate silhouette score: {e}")
                pass
        
        # 统计每个聚类的大小
        unique, counts = np.unique(labels, return_counts=True)
        cluster_sizes = [0] * n_clusters
        for idx, count in zip(unique, counts):
            cluster_sizes[int(idx)] = int(count)
        
        # 处理空簇：找出非空簇并重新映射标签
        non_empty_indices = [i for i, size in enumerate(cluster_sizes) if size > 0]
        actual_n_clusters = len(non_empty_indices)
        
        if actual_n_clusters < n_clusters:
            # 创建标签映射：旧标签 -> 新标签（连续的）
            label_map = {old_idx: new_idx for new_idx, old_idx in enumerate(non_empty_indices)}
            # 重新映射标签
            remapped_labels = [label_map[label] for label in labels]
            # 只保留非空簇的中心点和大小
            filtered_centers = [kmeans.cluster_centers_[i].tolist() for i in non_empty_indices]
            filtered_sizes = [cluster_sizes[i] for i in non_empty_indices]
        else:
            remapped_labels = labels.tolist()
            filtered_centers = kmeans.cluster_centers_.tolist()
            filtered_sizes = cluster_sizes
        
        logger.info(f"Returning clustering result: actual_n_clusters={actual_n_clusters}, sizes={filtered_sizes}")
        
        return ResponseModel(data={
            "n_clusters": actual_n_clusters,
            "labels": remapped_labels,
            "centers": filtered_centers,
            "silhouette_score": silhouette,
            "cluster_sizes": filtered_sizes,
            "columns": request.columns
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Clustering failed: {str(e)}", exc_info=True)
        raise HTTPException(500, detail=f"聚类分析失败: {str(e)}")


class SaveClusterResultRequest(BaseModel):
    """保存聚类结果请求"""
    source_dataset_id: str
    user_cluster_mapping: List[Dict[str, Any]]  # [{"user_id": "xxx", "cluster": 0}]
    cluster_descriptions: Optional[List[str]] = None  # 每个群体的描述
    user_id_col: str  # 用户ID列名，用于合并


def calculate_quality_score(df: pd.DataFrame) -> int:
    """
    计算数据集质量评分
    基于以下维度：
    - 完整性（40分）：缺失值比例
    - 一致性（30分）：重复值比例
    - 有效性（30分）：异常值比例
    """
    total_rows = len(df)
    if total_rows == 0:
        return 0
    
    score = 0
    
    # 1. 完整性评分（40分）- 基于缺失值
    null_count = df.isnull().sum().sum()
    total_cells = total_rows * len(df.columns)
    if total_cells > 0:
        completeness = 1 - (null_count / total_cells)
        score += int(completeness * 40)
    else:
        score += 40
    
    # 2. 一致性评分（30分）- 基于重复值
    unique_rows = len(df.drop_duplicates())
    if total_rows > 0:
        consistency = unique_rows / total_rows
        score += int(consistency * 30)
    else:
        score += 30
    
    # 3. 有效性评分（30分）- 基于数值型列的异常值
    numeric_cols = df.select_dtypes(include=['number']).columns
    if len(numeric_cols) > 0:
        outlier_ratios = []
        for col in numeric_cols:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)].shape[0]
            outlier_ratios.append(outliers / total_rows)
        
        avg_outlier_ratio = sum(outlier_ratios) / len(outlier_ratios)
        validity = 1 - min(avg_outlier_ratio * 2, 1.0)  # 异常值比例翻倍惩罚
        score += int(validity * 30)
    else:
        score += 30  # 没有数值列，默认给满分
    
    return min(max(score, 0), 100)


@router.post("/clustering/save", response_model=ResponseModel[dict])
async def save_cluster_result(
    request: SaveClusterResultRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    将聚类结果保存为新数据集
    在原数据集基础上增加一列 'cluster_label' 表示用户所属的群体
    """
    import os
    from app.core.config import settings
    
    try:
        # 获取源数据集
        result = await db.execute(
            select(Dataset).where(
                Dataset.id == request.source_dataset_id,
                Dataset.is_deleted == False,
                Dataset.user_id == current_user.id
            )
        )
        source_dataset = result.scalar_one_or_none()
        if not source_dataset:
            raise HTTPException(404, detail="源数据集不存在")
        
        # 读取源数据
        file_path = source_dataset.storage_path
        if file_path.endswith('.csv'):
            df = read_csv_with_auto_header(file_path)
        elif file_path.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file_path)
        else:
            raise HTTPException(400, detail="不支持的文件格式")
        
        # 检查用户ID列
        if request.user_id_col not in df.columns:
            raise HTTPException(400, detail=f"列 '{request.user_id_col}' 不存在")
        
        # 创建用户到群体的映射
        user_cluster_map = {
            str(item["user_id"]): item["cluster"] 
            for item in request.user_cluster_mapping
        }
        
        # 新增 cluster_label 列
        df['cluster_label'] = df[request.user_id_col].astype(str).map(user_cluster_map)
        
        # 对于未匹配到的用户，标记为 -1（未知群体）
        df['cluster_label'] = df['cluster_label'].fillna(-1).astype(int)
        
        # 生成新文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        new_filename = f"{source_dataset.filename.rsplit('.', 1)[0]}_聚类结果_{timestamp}.csv"
        
        # 保存到新文件
        new_id = str(uuid.uuid4())
        storage_dir = os.path.dirname(file_path)
        new_storage_path = os.path.join(storage_dir, f"{new_id}_{new_filename}")
        
        df.to_csv(new_storage_path, index=False, encoding='utf-8-sig')
        
        # 生成 schema
        schema = []
        for col in df.columns:
            dtype = str(df[col].dtype)
            unique_count = int(df[col].nunique())
            sample_values = df[col].dropna().head(5).tolist()
            
            schema.append({
                "name": col,
                "dtype": dtype,
                "unique_count": unique_count,
                "sample": sample_values
            })
        
        # 计算质量评分
        quality_score = calculate_quality_score(df)
        
        # 创建新数据集记录
        new_dataset = Dataset(
            id=new_id,
            user_id=current_user.id,
            filename=new_filename,
            storage_path=new_storage_path,
            file_size=os.path.getsize(new_storage_path),
            row_count=len(df),
            col_count=len(df.columns),
            schema=clean_json_data(schema),
            quality_score=quality_score,
            status="processed"
        )
        
        db.add(new_dataset)
        await db.commit()
        
        return ResponseModel(data={
            "dataset_id": new_id,
            "filename": new_filename,
            "row_count": len(df),
            "col_count": len(df.columns),
            "new_column": "cluster_label",
            "cluster_count": len(df['cluster_label'].unique())
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"保存聚类结果失败: {str(e)}")
