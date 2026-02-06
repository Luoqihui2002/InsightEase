"""AI智能分析服务"""
import json
import pandas as pd
from typing import Dict, Any, List, Optional, AsyncGenerator
from openai import AsyncOpenAI
from app.core.config import settings


class AIService:
    """AI智能分析服务类"""
    
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.KIMI_API_KEY,
            base_url=settings.KIMI_BASE_URL
        )
        self.model = settings.KIMI_MODEL
    
    def _is_available(self) -> bool:
        """检查AI服务是否可用"""
        return bool(settings.KIMI_API_KEY)
    
    async def _call_kimi(self, messages: List[Dict[str, str]], 
                         temperature: float = 0.7) -> str:
        """调用Kimi API"""
        if not self._is_available():
            return "[AI服务未配置，请在.env中设置KIMI_API_KEY]"
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                stream=False
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"[AI调用失败: {str(e)}]"
    
    async def _call_kimi_stream(self, messages: List[Dict[str, str]], 
                                 temperature: float = 0.7) -> AsyncGenerator[str, None]:
        """流式调用Kimi API"""
        if not self._is_available():
            yield "[AI服务未配置，请在.env中设置KIMI_API_KEY]"
            return
        
        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                stream=True
            )
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            yield f"[AI调用失败: {str(e)}]"
    
    async def interpret_data(self, df: pd.DataFrame, 
                            analysis_type: str = "general") -> Dict[str, Any]:
        """
        AI解读数据，生成数据洞察
        """
        # 准备数据摘要
        data_summary = self._prepare_data_summary(df)
        
        prompts = {
            "general": f"""你是一位专业的数据分析师。请对以下数据进行深入解读，提供3-5个关键洞察：

数据概览：
{data_summary}

请从以下角度分析：
1. 数据的整体特征和分布
2. 潜在的数据质量问题
3. 有趣的发现或异常
4. 业务含义解读

请用中文回答，使用Markdown格式，条理清晰。""",

            "business": f"""你是一位资深的商业分析师。请从商业角度解读以下数据：

数据概览：
{data_summary}

请分析：
1. 关键业务指标表现
2. 潜在的商业机会
3. 需要关注的风险点
4. 可行的业务建议

请用中文回答，使用Markdown格式。""",

            "technical": f"""你是一位数据科学家。请从技术角度分析以下数据：

数据概览：
{data_summary}

请分析：
1. 数据质量和完整性
2. 特征分布和关联性
3. 适合的数据处理方法
4. 可能的建模方向

请用中文回答，使用Markdown格式。"""
        }
        
        prompt = prompts.get(analysis_type, prompts["general"])
        
        messages = [
            {"role": "system", "content": "你是一位专业的数据分析师，擅长从数据中发现价值并提供洞察。"},
            {"role": "user", "content": prompt}
        ]
        
        interpretation = await self._call_kimi(messages, temperature=0.7)
        
        return {
            "analysis_type": analysis_type,
            "interpretation": interpretation,
            "summary": data_summary
        }
    
    async def generate_suggestions(self, df: pd.DataFrame,
                                   context: str = None) -> List[Dict[str, Any]]:
        """
        生成智能分析建议
        """
        data_summary = self._prepare_data_summary(df)
        
        context_info = f"\n用户背景：{context}" if context else ""
        
        prompt = f"""你是一位数据分析专家。基于以下数据特征，请推荐3-5个适合的分析方法：

数据概览：
{data_summary}{context_info}

请以JSON格式返回建议列表，每个建议包含：
- type: 分析类型
- title: 建议标题
- description: 详细说明
- reason: 推荐理由
- priority: 优先级（high/medium/low）

示例格式：
[
  {{
    "type": "correlation",
    "title": "相关性分析",
    "description": "分析各数值型变量之间的相关性",
    "reason": "数据包含多个数值型列，可能存在关联关系",
    "priority": "high"
  }}
]"""
        
        messages = [
            {"role": "system", "content": "你是一位数据分析专家，擅长推荐合适的分析方法。请只返回JSON格式，不要添加其他说明文字。"},
            {"role": "user", "content": prompt}
        ]
        
        response = await self._call_kimi(messages, temperature=0.5)
        
        # 解析JSON
        try:
            # 尝试提取JSON部分
            import re
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                suggestions = json.loads(json_match.group())
            else:
                suggestions = json.loads(response)
        except:
            # 如果解析失败，返回默认建议
            suggestions = self._get_default_suggestions(df)
        
        return suggestions
    
    async def answer_question(self, df: pd.DataFrame, 
                             question: str,
                             chat_history: List[Dict] = None) -> Dict[str, Any]:
        """
        回答关于数据的问题
        """
        data_summary = self._prepare_data_summary(df)
        
        # 先计算一些可能需要的统计数据
        stats_context = self._compute_relevant_stats(df, question)
        
        prompt = f"""你是一位数据分析师。请基于以下数据回答用户的问题。

数据概览：
{data_summary}

相关统计信息：
{stats_context}

用户问题：{question}

请用中文回答，直接给出答案和分析过程。如果问题无法从数据中回答，请明确说明。"""
        
        messages = [
            {"role": "system", "content": "你是一位 helpful 的数据分析师，擅长回答关于数据的各种问题。请用中文回答，简洁明了。"}
        ]
        
        # 添加历史对话
        if chat_history:
            for msg in chat_history[-5:]:  # 只保留最近5轮
                messages.append({"role": msg["role"], "content": msg["content"]})
        
        messages.append({"role": "user", "content": prompt})
        
        answer = await self._call_kimi(messages, temperature=0.7)
        
        return {
            "question": question,
            "answer": answer,
            "data_summary": data_summary
        }
    
    async def chat_stream(self, message: str, 
                         chat_history: List[Dict] = None) -> AsyncGenerator[str, None]:
        """
        通用聊天对话（流式）
        """
        messages = [
            {"role": "system", "content": "你是InsightEase AI助手，一位专业的数据分析师。你可以帮助用户理解数据、提供分析建议、回答数据相关问题。请用中文回答。"}
        ]
        
        if chat_history:
            for msg in chat_history[-5:]:
                messages.append({"role": msg["role"], "content": msg["content"]})
        
        messages.append({"role": "user", "content": message})
        
        async for chunk in self._call_kimi_stream(messages):
            yield chunk
    
    def _prepare_data_summary(self, df: pd.DataFrame) -> str:
        """准备数据摘要"""
        summary = []
        summary.append(f"- 数据集规模：{len(df)} 行 × {len(df.columns)} 列")
        summary.append(f"- 列名：{', '.join(str(col) for col in df.columns)}")
        
        # 数值型列统计
        numeric_cols = df.select_dtypes(include=['number']).columns
        if len(numeric_cols) > 0:
            summary.append(f"\n数值型列（{len(numeric_cols)}个）：")
            for col in numeric_cols[:5]:  # 最多显示5个
                stats = df[col].describe()
                summary.append(f"  - {col}: 均值={stats['mean']:.2f}, 标准差={stats['std']:.2f}, 范围=[{stats['min']:.2f}, {stats['max']:.2f}]")
        
        # 分类型列统计
        categorical_cols = df.select_dtypes(include=['object']).columns
        if len(categorical_cols) > 0:
            summary.append(f"\n分类型列（{len(categorical_cols)}个）：")
            for col in categorical_cols[:3]:
                unique_count = df[col].nunique()
                top_value = df[col].mode().iloc[0] if not df[col].mode().empty else "N/A"
                summary.append(f"  - {col}: {unique_count}个唯一值，最常见='{top_value}'")
        
        # 缺失值情况
        missing = df.isnull().sum()
        if missing.sum() > 0:
            summary.append(f"\n缺失值情况：")
            for col in missing[missing > 0].index[:3]:
                summary.append(f"  - {col}: {missing[col]}个 ({missing[col]/len(df)*100:.1f}%)")
        else:
            summary.append(f"\n数据完整性：无缺失值")
        
        return "\n".join(summary)
    
    def _compute_relevant_stats(self, df: pd.DataFrame, question: str) -> str:
        """根据问题计算相关统计数据"""
        stats = []
        
        # 检查问题中是否提到最大值、最小值等
        question_lower = question.lower()
        
        numeric_cols = df.select_dtypes(include=['number']).columns
        
        if any(kw in question_lower for kw in ["最大", "最高", "最多", "max"]):
            for col in numeric_cols[:3]:
                max_idx = df[col].idxmax()
                max_row = df.loc[max_idx]
                stats.append(f"{col}最大值: {df[col].max()} (行索引: {max_idx})")
        
        if any(kw in question_lower for kw in ["最小", "最低", "最少", "min"]):
            for col in numeric_cols[:3]:
                min_idx = df[col].idxmin()
                stats.append(f"{col}最小值: {df[col].min()} (行索引: {min_idx})")
        
        if any(kw in question_lower for kw in ["平均", "均值", "mean", "average"]):
            for col in numeric_cols[:3]:
                stats.append(f"{col}平均值: {df[col].mean():.2f}")
        
        if any(kw in question_lower for kw in ["总和", "总计", "sum", "total"]):
            for col in numeric_cols[:3]:
                stats.append(f"{col}总和: {df[col].sum():.2f}")
        
        return "\n".join(stats) if stats else "根据问题未计算额外统计"
    
    def _get_default_suggestions(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """获取默认建议"""
        suggestions = []
        
        numeric_cols = df.select_dtypes(include=['number']).columns
        categorical_cols = df.select_dtypes(include=['object']).columns
        datetime_cols = df.select_dtypes(include=['datetime64']).columns
        
        if len(numeric_cols) >= 2:
            suggestions.append({
                "type": "correlation",
                "title": "相关性分析",
                "description": "分析数值型变量之间的相关性，发现变量间的关联关系",
                "reason": f"数据包含{len(numeric_cols)}个数值型列，适合进行相关性分析",
                "priority": "high"
            })
        
        if len(numeric_cols) > 0:
            suggestions.append({
                "type": "descriptive",
                "title": "描述性统计分析",
                "description": "计算各数值型变量的均值、中位数、标准差等统计指标",
                "reason": "了解数据的基本分布特征",
                "priority": "high"
            })
            
            suggestions.append({
                "type": "visualization",
                "title": "数据可视化",
                "description": "生成直方图、箱线图等图表，直观展示数据分布",
                "reason": "可视化有助于发现数据特征和异常值",
                "priority": "medium"
            })
        
        if len(datetime_cols) > 0 and len(numeric_cols) > 0:
            suggestions.append({
                "type": "forecast",
                "title": "时间序列预测",
                "description": "基于历史数据进行趋势分析和未来预测",
                "reason": "数据包含时间序列特征，适合进行预测分析",
                "priority": "medium"
            })
        
        if len(categorical_cols) > 0:
            suggestions.append({
                "type": "distribution",
                "title": "分类分布分析",
                "description": "分析分类变量的分布情况和占比",
                "reason": f"数据包含{len(categorical_cols)}个分类型列",
                "priority": "low"
            })
        
        return suggestions


# 单例实例
ai_service = AIService()
