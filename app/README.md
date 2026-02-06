# InsightEase 前端应用

基于 React + TypeScript + Vite 的数据分析平台前端，专注于电商数据分析场景。

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS + shadcn/ui
- **动画**: GSAP
- **图表**: ECharts
- **状态管理**: React Hooks

## 核心功能模块

### 📈 趋势预测 (Forecast)

提供时间序列预测分析，支持电商场景的多种预测需求。

#### 单SKU预测
- **模型选择**: Prophet / LightGBM / SARIMA
- **大促日历**: 内置10个电商大促节点（双11、618等）
- **辅助变量**: UV、转化率、广告投入等What-if分析
- **预测分解**: 趋势/季节性/促销效应/残差分解

#### 批量预测 (Batch Forecasting)
同时预测多个SKU/品类的销售趋势，适合商品组合分析。

**使用方式:**
1. 选择数据集后，开启"批量预测模式"
2. 勾选需要预测的数值列（最多20个SKU）
3. 选择预测模型和周期
4. 可选：添加大促日历提升准确度
5. 点击"批量预测 (N个SKU)"

**输出结果:**
```typescript
{
  summary: {
    total_sku: 5,          // 总SKU数
    success_count: 5,      // 成功预测数
    avg_growth: 15.2,      // 平均增长率(%)
    top_growing: "SKU_002", // 增长最快SKU
    top_growth_rate: 25.5  // 最高增长率
  },
  forecasts: [
    {
      column: "SKU_001",
      forecast: { /* 预测结果 */ },
      growth_rate: 12.5    // 该SKU增长率
    }
  ]
}
```

#### 文件位置
- `src/pages/Forecast.tsx` - 预测页面主组件
- `src/api/analysis.ts` - 分析API封装

### 🔗 路径分析 (PathAnalysis)

用户行为路径分析，包含漏斗分析、路径挖掘、序列模式挖掘等。

### 📊 其他模块

- **归因分析** - 多渠道归因模型
- **聚类分析** - 用户/商品聚类
- **智能处理** - 数据清洗和预处理

## 开发

```bash
# 安装依赖
npm install

# 开发服务器
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint
```

## 项目结构

```
src/
├── api/           # API接口封装
├── components/    # 通用组件
│   ├── ui/        # shadcn/ui 组件
│   ├── DatasetSelector.tsx
│   └── DataTypeValidation.tsx
├── pages/         # 页面组件
│   ├── Forecast.tsx      # 趋势预测
│   ├── PathAnalysis.tsx  # 路径分析
│   ├── Attribution.tsx   # 归因分析
│   └── ...
├── types/         # TypeScript类型定义
└── lib/           # 工具函数
```
