ALTER TABLE datasets
  ADD COLUMN source_dataset_ids JSON NULL COMMENT '派生数据集的全部源数据集ID',
  ADD COLUMN derivation_type VARCHAR(32) NULL COMMENT '派生类型，例如 join',
  ADD COLUMN derivation_plan JSON NULL COMMENT '经确认的结构化派生计划',
  ADD COLUMN derivation_risk_summary JSON NULL COMMENT '创建时的风险摘要',
  ADD INDEX ix_datasets_derivation_type (derivation_type);
