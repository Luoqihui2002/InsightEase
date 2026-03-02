/**
 * useCompanion Hook
 * 
 * 在React组件中使用AI陪伴服务
 */

import { useState, useEffect, useCallback } from 'react';
import { companionService, type CompanionState, type UserContext } from '@/services/companion-service';

export function useCompanion() {
  const [state, setState] = useState<CompanionState>(companionService.getState());

  useEffect(() => {
    const unsubscribe = companionService.subscribe(newState => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  const dismiss = useCallback(() => {
    companionService.dismiss();
  }, []);

  const executeAction = useCallback(async (action: string) => {
    await companionService.executeAction(action);
  }, []);

  const updateContext = useCallback((update: Partial<UserContext>) => {
    companionService.updateContext(update);
  }, []);

  const setPage = useCallback((page: string) => {
    companionService.setPage(page);
  }, []);

  const recordAction = useCallback((action: string, dataInfo?: UserContext['dataInfo']) => {
    companionService.recordAction(action, dataInfo);
  }, []);

  const show = useCallback((templateId: 'first-visit' | 'upload-complete' | 'idle-with-data' | 'large-file' | 'security-mode-enabled' | 'error-help') => {
    companionService.show(templateId);
  }, []);

  return {
    state,
    dismiss,
    executeAction,
    updateContext,
    setPage,
    recordAction,
    show,
    isVisible: state.visible,
    mood: state.mood,
    message: state.message,
    suggestions: state.suggestions,
  };
}

export default useCompanion;
