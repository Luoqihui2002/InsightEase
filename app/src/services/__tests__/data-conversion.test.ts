/**
 * 数据转换测试
 * 验证后端数据格式转换为前端图表格式
 */

// 模拟 AnalysisExecutionService 中的转换方法
function convertCorrelationMatrix(matrix: Record<string, Record<string, number>>): any[] {
  if (!matrix || typeof matrix !== 'object') {
    return [];
  }

  const columns = Object.keys(matrix);
  
  return columns.map(col => {
    const row: Record<string, any> = { column: col };
    columns.forEach(otherCol => {
      row[otherCol] = matrix[col]?.[otherCol] ?? 0;
    });
    return row;
  });
}

function convertDictToArray(dict: Record<string, number>, keyName: string, valueName: string): any[] {
  if (!dict || typeof dict !== 'object') {
    return [];
  }
  
  return Object.entries(dict).map(([key, value]) => ({
    [keyName]: key,
    [valueName]: value
  }));
}

// 测试用例
describe('数据转换测试', () => {
  
  test('convertCorrelationMatrix - 正常情况', () => {
    const input = {
      'age': { 'age': 1.0, 'salary': 0.8, 'years': 0.5 },
      'salary': { 'age': 0.8, 'salary': 1.0, 'years': 0.3 },
      'years': { 'age': 0.5, 'salary': 0.3, 'years': 1.0 }
    };
    
    const result = convertCorrelationMatrix(input);
    
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty('column', 'age');
    expect(result[0]).toHaveProperty('salary', 0.8);
    expect(result[1]).toHaveProperty('column', 'salary');
  });

  test('convertDictToArray - 柱状图数据', () => {
    const input = { 'A': 10, 'B': 20, 'C': 30 };
    
    const result = convertDictToArray(input, 'name', 'value');
    
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: 'A', value: 10 });
    expect(result[1]).toEqual({ name: 'B', value: 20 });
  });
  
  test('convertCorrelationMatrix - 空数据', () => {
    expect(convertCorrelationMatrix({})).toEqual([]);
    expect(convertCorrelationMatrix(null as any)).toEqual([]);
    expect(convertCorrelationMatrix(undefined as any)).toEqual([]);
  });

});

console.log('测试文件已创建');
