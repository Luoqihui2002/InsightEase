-- Migration: Add transform-related fields to datasets table
-- Phase 3C: DataWorkshop Backendization
-- Date: 2026-04-27
--
-- Prerequisites:
--   - MySQL 8.0+
--   - Database: insightease
--   - Table: datasets
--
-- Rollback:
--   ALTER TABLE datasets DROP COLUMN transform_chain;
--   ALTER TABLE datasets DROP FOREIGN KEY fk_datasets_parent_dataset_id;
--   ALTER TABLE datasets DROP INDEX ix_datasets_parent_dataset_id;
--   ALTER TABLE datasets DROP COLUMN parent_dataset_id;

USE insightease;

ALTER TABLE datasets
  ADD COLUMN parent_dataset_id VARCHAR(36) NULL AFTER status,
  ADD COLUMN transform_chain JSON NULL AFTER parent_dataset_id;

ALTER TABLE datasets
  ADD INDEX ix_datasets_parent_dataset_id (parent_dataset_id);

ALTER TABLE datasets
  ADD CONSTRAINT fk_datasets_parent_dataset_id
    FOREIGN KEY (parent_dataset_id) REFERENCES datasets(id)
    ON DELETE SET NULL;

-- Verify
DESCRIBE datasets;
