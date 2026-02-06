import type { ChatMessage } from '@/types/api';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const aiApi = {
  // SSE 流式对话
  chatStream: (
    message: string,
    onChunk: (chunk: string, fullText: string) => void,
    options?: {
      context?: string;
      history?: ChatMessage[];
      onError?: (error: string) => void;
      onFinish?: () => void;
    }
  ) => {
    const { context, history = [], onError, onFinish } = options || {};
    
    const url = `${baseURL}/ai/chat`;
    
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context, history }),
    }).then(async (response) => {
      const reader = response.body?.getReader();
      if (!reader) return;
      
      const decoder = new TextDecoder();
      let fullText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                onError?.(data.error);
                return;
              }
              fullText += data.chunk || '';
              onChunk(data.chunk || '', data.full_text || fullText);
              
              if (data.finished) {
                onFinish?.();
                return;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }).catch(err => {
      onError?.(err.message);
    });
  },
};