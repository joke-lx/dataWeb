/**
 * Compare —— 自由对比工作区（参考图形态）。
 *
 * 布局：
 *  - 左侧 `CompareRail`：Add Data / Clear All / Save Session / Synchronize
 *    All Charts + 数据集列表 + 案例库入口；
 *  - 右侧面板区：每个已添加样本渲染一个 `ComparePanel`（Hi-C + 刻度 +
 *    TAD + PC1 + Loop + Refseq 一体化视图），Grid 并排、超出自动换行。
 *
 * 会话持久化：
 *  - 数据集列表写入 URL `?samples=a,b,c`（replace，不污染历史栈）；
 *  - 首次访问（无 ?samples=）在目录加载后自动预置前两个样本，形成
 *    "两面板并排"初始态；用户点 Clear All 后 URL 保留空参数，刷新不会
 *    重新预置；
 *  - Save Session = 复制当前链接（会话状态已在 URL 里）。
 *
 * 同步语义：`sync` 开关控制面板共享全局视口（开）还是每面板独立视口（关），
 * 由 `ComparePanel` 内部决定是否挂 `PanelViewportProvider`。
 *
 * 保留路由：/compare/cases 与 /compare/case/:id 不动；旧 A/B 下拉跳转页
 * 被本工作区取代（差异视图仍在 /sample?vs= 提供）。
 */

import { useEffect, useRef, useState, type JSX } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { useAppIntl } from '../../i18n';
import { ComparePanel } from './ComparePanel';
import { CompareRail } from './CompareRail';
import './compare.css';

/**
 * Compare 工作区路由组件。
 */
export function Compare(): JSX.Element {
  const { t } = useAppIntl();
  const { samples, isLoading } = useSampleCatalog();
  const [searchParams, setSearchParams] = useSearchParams();

  // 初始数据集：从 URL ?samples= 恢复；无参数时先置空，等目录加载后自动预置。
  const [added, setAdded] = useState<string[]>(() => {
    const param = searchParams.get('samples');
    if (param === null) return [];
    return param.split(',').filter(Boolean);
  });
  const [sync, setSync] = useState(true);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<number | null>(null);
  // 只允许"首次访问自动预置"一次，避免清空后又被填回。
  const autoFilledRef = useRef(false);
  // 用户是否显式清空过（清空后即使 URL 无参数也不重新预置）。
  const clearedRef = useRef(false);
  // 进入页面时 URL 是否已带 samples 参数（决定"清空后是否保留空参数"）。
  const hadSamplesParamRef = useRef(searchParams.get('samples') !== null);

  // 首次访问（URL 从未带过 ?samples=）且目录加载完 → 预置前两个样本，两面板并排起步。
  useEffect(() => {
    if (autoFilledRef.current || clearedRef.current) return;
    if (searchParams.get('samples') !== null) {
      autoFilledRef.current = true;
      return;
    }
    if (!samples || samples.length < 2) return;
    autoFilledRef.current = true;
    setAdded([samples[0].id, samples[1].id]);
  }, [samples, searchParams]);

  // 目录加载后清洗 URL 中已不存在的样本 id（旧书签/过期链接）。
  useEffect(() => {
    if (!samples) return;
    setAdded((prev) => {
      const next = prev.filter((id) => samples.some((s) => s.id === id));
      return next.length === prev.length ? prev : next;
    });
  }, [samples]);

  // added 变化 → 写回 URL（replace）。首次空会话不写（等自动预置/用户操作）；
  // 用户清空后保留空参数，防止刷新重新自动预置。
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (added.length === 0) {
          if (!hadSamplesParamRef.current) return prev;
          next.set('samples', '');
        } else {
          next.set('samples', added.join(','));
        }
        return next;
      },
      { replace: true },
    );
  }, [added, setSearchParams]);

  // 卸载时清理复制反馈计时器。
  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const handleAdd = (id: string): void => {
    setAdded((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleRemove = (id: string): void => {
    setAdded((prev) => prev.filter((item) => item !== id));
  };

  const handleClear = (): void => {
    clearedRef.current = true;
    setAdded([]);
  };

  const handleSaveSession = async (): Promise<void> => {
    if (added.length === 0) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setSaved(true);
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
      savedTimerRef.current = window.setTimeout(() => setSaved(false), 2000);
    } catch {
      // 剪贴板不可用（非安全上下文等）时静默——会话本身已在地址栏 URL 中。
    }
  };

  const handleToggleSync = (): void => setSync((prev) => !prev);

  return (
    <main className="route-page compare-page">
      <div className="compare-workspace">
        <CompareRail
          samples={samples}
          isLoading={isLoading}
          added={added}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onClear={handleClear}
          onSaveSession={handleSaveSession}
          saved={saved}
          sync={sync}
          onToggleSync={handleToggleSync}
        />

        <div className="compare-workspace__panels">
          {added.length === 0 ? (
            <div className="compare-workspace__empty">
              {t('compare.workspace.empty')}
            </div>
          ) : (
            added.map((id) => {
              const sample = samples?.find((s) => s.id === id);
              if (!sample) return null;
              return (
                <ComparePanel
                  key={id}
                  sample={sample}
                  sync={sync}
                  onRemove={() => handleRemove(id)}
                />
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}

export default Compare;
