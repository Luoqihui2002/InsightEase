/**
 * Mock AnalysisResult payloads for development and testing.
 * Aligned with docs/design/RESULT_TABLE_DESIGN.md §9.
 */

import type { AnalysisResult } from "@/types/result";

export const mockDescriptiveResult: AnalysisResult = {
  id: "desc-2026-04-28-001",
  analysisType: "descriptive",
  title: "订单金额描述统计",
  status: "success",
  generatedAt: "2026-04-28T10:30:00Z",
  dataset: {
    id: "ds-42",
    name: "orders_2026_q1.csv",
    rowCount: 12500,
    columnCount: 8,
  },
  blocks: [
    {
      type: "summary",
      content:
        "订单金额呈右偏分布，平均订单金额为 ¥342.50，中位数为 ¥280.00。存在少量高价值异常订单（最大值 ¥12,800）。",
      tone: "neutral",
      bulletPoints: [
        "75% 的订单金额低于 ¥450",
        "标准差较大，建议分组分析",
      ],
    },
    {
      type: "metric",
      metrics: [
        {
          key: "mean",
          label: "平均值",
          value: 342.5,
          unit: "¥",
          formattedValue: "¥342.50",
        },
        {
          key: "median",
          label: "中位数",
          value: 280.0,
          unit: "¥",
          formattedValue: "¥280.00",
        },
        {
          key: "std",
          label: "标准差",
          value: 410.2,
          unit: "¥",
          formattedValue: "¥410.20",
        },
        {
          key: "count",
          label: "样本量",
          value: 12500,
          formattedValue: "12,500",
        },
      ],
    },
    {
      type: "table",
      title: "分位数统计",
      columns: [
        {
          key: "quantile",
          label: "分位数",
          dataType: "string",
          semanticRole: "category",
        },
        {
          key: "value",
          label: "金额",
          dataType: "currency",
          unit: "¥",
          align: "right",
        },
      ],
      rows: [
        { quantile: "最小值", value: 12.0 },
        { quantile: "25%", value: 150.0 },
        { quantile: "中位数", value: 280.0 },
        { quantile: "75%", value: 450.0 },
        { quantile: "最大值", value: 12800.0 },
      ],
    },
  ],
};

export const mockAbTestResult: AnalysisResult = {
  id: "ab-2026-04-28-002",
  analysisType: "ab_test",
  title: "首页改版 A/B 测试：转化率",
  status: "warning",
  generatedAt: "2026-04-28T11:00:00Z",
  dataset: {
    id: "ds-43",
    name: "ab_test_homepage.csv",
    rowCount: 5000,
    columnCount: 5,
  },
  blocks: [
    {
      type: "warning",
      severity: "caution",
      message: "实验组样本量偏小（n=1,200），检验力可能不足。",
      suggestion: "建议将实验继续运行至每组至少 2,000 样本。",
    },
    {
      type: "metric",
      metrics: [
        {
          key: "conversion_delta",
          label: "转化率提升",
          value: 0.023,
          formattedValue: "+2.3%",
          unit: "%",
          delta: { value: 0.023, direction: "up" },
          isSignificant: true,
          tone: "positive",
        },
        {
          key: "p_value",
          label: "P 值",
          value: 0.032,
          formattedValue: "0.032",
          isSignificant: true,
        },
      ],
    },
    {
      type: "table",
      title: "组间对比",
      columns: [
        {
          key: "group",
          label: "分组",
          dataType: "string",
          semanticRole: "dimension",
        },
        {
          key: "users",
          label: "用户数",
          dataType: "integer",
          align: "right",
        },
        {
          key: "conversions",
          label: "转化数",
          dataType: "integer",
          align: "right",
        },
        {
          key: "rate",
          label: "转化率",
          dataType: "percent",
          precision: 2,
          align: "right",
        },
        {
          key: "ci",
          label: "95% 置信区间",
          dataType: "string",
          semanticRole: "confidence_interval",
          align: "center",
        },
      ],
      rows: [
        {
          group: "对照组 (A)",
          users: 3800,
          conversions: 456,
          rate: 0.12,
          ci: "[10.9%, 13.1%]",
        },
        {
          group: "实验组 (B)",
          users: 1200,
          conversions: 168,
          rate: 0.14,
          ci: "[12.1%, 15.9%]",
        },
      ],
    },
  ],
};

export const mockRegressionResult: AnalysisResult = {
  id: "reg-2026-04-28-003",
  analysisType: "regression",
  title: "线性回归：销售额预测模型",
  status: "success",
  generatedAt: "2026-04-28T11:30:00Z",
  dataset: {
    id: "ds-44",
    name: "sales_features.csv",
    rowCount: 360,
    columnCount: 6,
  },
  blocks: [
    {
      type: "summary",
      content:
        "模型解释了销售额变异的 78.5%（R² = 0.785）。广告投入和促销力度是最显著的预测因子。",
      tone: "positive",
    },
    {
      type: "metric",
      metrics: [
        {
          key: "r_squared",
          label: "R²",
          value: 0.785,
          formattedValue: "0.785",
        },
        {
          key: "adj_r_squared",
          label: "调整 R²",
          value: 0.78,
          formattedValue: "0.780",
        },
        {
          key: "rmse",
          label: "RMSE",
          value: 1250.5,
          unit: "¥",
          formattedValue: "¥1,250.50",
        },
      ],
    },
    {
      type: "table",
      title: "回归系数",
      columns: [
        {
          key: "variable",
          label: "变量",
          dataType: "string",
          semanticRole: "dimension",
        },
        {
          key: "coefficient",
          label: "系数",
          dataType: "number",
          precision: 3,
          align: "right",
        },
        {
          key: "std_error",
          label: "标准误",
          dataType: "number",
          precision: 3,
          align: "right",
        },
        {
          key: "t_stat",
          label: "t 统计量",
          dataType: "number",
          precision: 2,
          align: "right",
        },
        {
          key: "p_value",
          label: "P 值",
          dataType: "number",
          precision: 3,
          semanticRole: "p_value",
          align: "right",
        },
      ],
      rows: [
        {
          variable: "截距",
          coefficient: 5000.0,
          std_error: 320.5,
          t_stat: 15.6,
          p_value: 0.0,
        },
        {
          variable: "广告投入",
          coefficient: 2.45,
          std_error: 0.32,
          t_stat: 7.66,
          p_value: 0.001,
        },
        {
          variable: "促销力度",
          coefficient: 150.2,
          std_error: 45.3,
          t_stat: 3.32,
          p_value: 0.032,
        },
        {
          variable: "季节性指数",
          coefficient: 80.5,
          std_error: 60.1,
          t_stat: 1.34,
          p_value: 0.182,
        },
      ],
    },
    {
      type: "warning",
      severity: "info",
      message:
        "季节性指数的 p 值为 0.182，未达到常规显著性水平（α = 0.05）。",
      relatedField: "季节性指数",
    },
  ],
  diagnostics: {
    modelName: "Ordinary Least Squares",
    sampleSize: 360,
    assumptions: [
      { name: "线性关系", passed: true },
      { name: "残差正态性", passed: true },
      {
        name: "同方差性",
        passed: false,
        message: "Breusch-Pagan 检验 p = 0.028，存在轻微异方差",
      },
    ],
  },
};

export const mockAnalysisResults: AnalysisResult[] = [
  mockDescriptiveResult,
  mockAbTestResult,
  mockRegressionResult,
];
