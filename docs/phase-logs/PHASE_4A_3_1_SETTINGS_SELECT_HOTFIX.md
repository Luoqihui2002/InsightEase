# Phase 4A-3-1 Hotfix Report

**日期**: 2026-04-28  
**Commit**: `90d7bf5`  
**标签**: `fix: replace empty select item values in settings`

---

## 1. 错误原因

在 Phase 4A-3-1 中，Settings 页面的"自动清理数据"选择器从原生 `<select>` 替换为 shadcn `Select`。原实现中有一项：

```tsx
<SelectItem value="">永不清理</SelectItem>
```

Radix UI 的 `SelectItem` 组件不接受空字符串作为 `value`，会在运行时抛出断言错误：

```
A <Select.Item /> must have a value prop that is not an empty string.
```

这导致 Settings 页面在打开时直接崩溃（被错误边界捕获或白屏）。

---

## 2. 定位到的文件和具体 SelectItem

| 文件 | 行号 | 问题代码 |
|---|---|---|
| `app/src/pages/Settings.tsx` | 114 | `const autoDeleteOptions = [{ value: '', label: '永不清理' }, ...]` |
| `app/src/pages/Settings.tsx` | 377 | `<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>` |

**排查范围**: 仅 Settings.tsx 使用了 shadcn SelectItem。其余页面（AIWorkspace, DataWorkshop, Visualization 等）使用的是原生 `<option value="">`，不受此限制。

---

## 3. 修复方式

### 3.1 修改选项数据

将 `autoDeleteOptions` 中的空字符串替换为语义化标识：

```tsx
// Before
const autoDeleteOptions = [
  { value: '', label: '永不清理' },
  ...
];

// After
const autoDeleteOptions = [
  { value: 'never', label: '永不清理' },
  ...
];
```

### 3.2 修改 value 绑定和回调映射

```tsx
// Before
value={String(settings.privacy.autoDeleteAfterDays ?? '')}
onValueChange={(value) => updateSettings('privacy.autoDeleteAfterDays', value ? parseInt(value) : null)}

// After
value={settings.privacy.autoDeleteAfterDays == null ? 'never' : String(settings.privacy.autoDeleteAfterDays)}
onValueChange={(value) => updateSettings('privacy.autoDeleteAfterDays', value === 'never' ? null : parseInt(value))}
```

- 当 `autoDeleteAfterDays` 为 `null` 时，UI 显示 `never`
- 用户选择 "永不清理" 时，`onValueChange` 收到 `"never"`，映射回 `null`
- 其他选项保持原有逻辑：`parseInt(value)` 转为数字

---

## 4. 验证结果

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 errors ✅ |
| `npm run build` | built in 12.77s ✅ |
| `npm run dev` | 正常启动于 localhost:5175 ✅ |

> 浏览器端人工验证：请在本地打开 `http://localhost:5175/settings`，确认：
> - 页面不再显示错误边界
> - "自动清理数据" Select 默认显示 "永不清理"
> - 切换选项后值正确更新
> - Console 无 `SelectItem` 相关报错

---

## 5. 是否影响 Settings 业务逻辑

**否。**

- `settings.privacy.autoDeleteAfterDays` 的存储值仍然是 `number | null`
- `defaultSettings` 未改变
- `localStorage` 中序列化后的数据结构未改变
- 仅 UI 层的 Select value 字符串表示从 `""` 改为 `"never"`

---

## 6. 后续预防

在后续页面接入 shadcn Select 时，应遵守以下规则：

1. `SelectItem` 的 `value` 禁止传入空字符串
2. 需要表示"未选择"或"无"时，使用语义化字符串（如 `"none"`, `"never"`, `"default"`）
3. 在 `onValueChange` 中将语义化字符串映射回业务需要的类型（`null`, `undefined`, `0` 等）
