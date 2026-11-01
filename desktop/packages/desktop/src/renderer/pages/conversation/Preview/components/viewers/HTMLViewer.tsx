/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Message } from '@/renderer/ui/toast';
import MonacoEditor from '@monaco-editor/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface HTMLPreviewProps {
  content: string;
  file_path?: string;
  hideToolbar?: boolean;
}

interface SelectedElement {
  path: string; // DOM 路径，如 "html > body > div:nth-child(2) > p:nth-child(1)"
  html: string; // 元素的 outerHTML
  startLine?: number; // 代码起始行（估算）
  endLine?: number; // 代码结束行（估算）
}

/**
 * HTML 预览组件
 * - 支持实时预览和代码编辑
 * - 支持元素选择器（类似 DevTools）
 * - 支持双向定位：预览 ↔ 代码
 */
const isSelectedElement = (value: unknown): value is SelectedElement => {
  if (!value || typeof value !== 'object') return false;
  const element = value as Record<string, unknown>;
  return (
    typeof element.path === 'string' &&
    typeof element.html === 'string' &&
    (element.startLine === undefined || typeof element.startLine === 'number') &&
    (element.endLine === undefined || typeof element.endLine === 'number')
  );
};

const escapeHtmlAttribute = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

const INSPECTOR_SCRIPT = `
      (function() {
        let hoveredElement = null;
        let overlay = null;

        function createOverlay() {
          overlay = document.createElement('div');
          overlay.style.position = 'absolute';
          overlay.style.border = '2px solid #2196F3';
          overlay.style.backgroundColor = 'rgba(33, 150, 243, 0.1)';
          overlay.style.pointerEvents = 'none';
          overlay.style.zIndex = '999999';
          overlay.style.boxSizing = 'border-box';
          document.body.appendChild(overlay);
        }

        function updateOverlay(element) {
          if (!overlay) createOverlay();
          const rect = element.getBoundingClientRect();
          overlay.style.top = rect.top + window.scrollY + 'px';
          overlay.style.left = rect.left + window.scrollX + 'px';
          overlay.style.width = rect.width + 'px';
          overlay.style.height = rect.height + 'px';
          overlay.style.display = 'block';
        }

        function hideOverlay() {
          if (overlay) overlay.style.display = 'none';
        }

        function getElementPath(element) {
          const path = [];
          while (element && element.nodeType === Node.ELEMENT_NODE) {
            let selector = element.nodeName.toLowerCase();
            if (element.id) {
              selector += '#' + element.id;
              path.unshift(selector);
              break;
            }
            let sibling = element;
            let nth = 1;
            while (sibling.previousElementSibling) {
              sibling = sibling.previousElementSibling;
              if (sibling.nodeName.toLowerCase() === selector) nth++;
            }
            if (nth > 1) selector += ':nth-child(' + nth + ')';
            path.unshift(selector);
            element = element.parentElement;
          }
          return path.join(' > ');
        }

        document.addEventListener('mousemove', function(e) {
          hoveredElement = e.target;
          if (hoveredElement && hoveredElement !== document.body && hoveredElement !== document.documentElement) {
            updateOverlay(hoveredElement);
          } else {
            hideOverlay();
          }
        });

        document.addEventListener('mouseleave', hideOverlay);
        document.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (hoveredElement && hoveredElement !== document.body && hoveredElement !== document.documentElement) {
            window.parent.postMessage({
              type: 'element-selected',
              data: { path: getElementPath(hoveredElement), html: hoveredElement.outerHTML }
            }, '*');
          }
        });

        document.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          if (hoveredElement && hoveredElement !== document.body && hoveredElement !== document.documentElement) {
            window.parent.postMessage({
              type: 'element-contextmenu',
              data: {
                element: { path: getElementPath(hoveredElement), html: hoveredElement.outerHTML },
                x: e.clientX,
                y: e.clientY
              }
            }, '*');
          }
        });
      })();
`;

const buildPreviewDocument = (html: string, filePath: string | undefined, inspectorMode: boolean): string => {
  let documentHtml = html;
  if (filePath) {
    const fileDir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
    const baseUrl = escapeHtmlAttribute(`file://${fileDir}`);
    if (!documentHtml.match(/<base\s+href=/i)) {
      if (documentHtml.match(/<head>/i)) {
        documentHtml = documentHtml.replace(/<head>/i, `<head><base href="${baseUrl}">`);
      } else if (documentHtml.match(/<html>/i)) {
        documentHtml = documentHtml.replace(/<html>/i, `<html><head><base href="${baseUrl}"></head>`);
      } else {
        documentHtml = `<head><base href="${baseUrl}"></head>${documentHtml}`;
      }
    }
  }

  if (!inspectorMode) return documentHtml;
  const inspector = `<script>${INSPECTOR_SCRIPT}</script>`;
  return /<\/body\s*>/i.test(documentHtml)
    ? documentHtml.replace(/<\/body\s*>/i, `${inspector}</body>`)
    : `${documentHtml}${inspector}`;
};

const HTMLPreview: React.FC<HTMLPreviewProps> = ({ content, file_path, hideToolbar = false }) => {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [htmlCode, setHtmlCode] = useState(content);
  const [inspectorMode, setInspectorMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; element: SelectedElement } | null>(null);
  const [messageApi, messageContextHolder] = Message.useMessage();
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  // 监听主题变化
  useEffect(() => {
    const updateTheme = () => {
      const theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setCurrentTheme(theme);
    };

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  const previewDocument = useMemo(
    () => buildPreviewDocument(htmlCode, file_path, inspectorMode),
    [file_path, htmlCode, inspectorMode]
  );

  /**
   * 监听 iframe 消息
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const payload = event.data as { type?: unknown; data?: unknown } | null;
      if (!payload || typeof payload !== 'object') return;

      if (payload.type === 'element-selected' && isSelectedElement(payload.data)) {
        const elementInfo = payload.data;
        setSelectedElement(elementInfo);
        messageApi.info(t('preview.html.elementSelected', { path: elementInfo.path }));
      } else if (payload.type === 'element-contextmenu') {
        const data = payload.data as { element?: unknown; x?: unknown; y?: unknown } | null;
        if (!data || !isSelectedElement(data.element)) return;
        if (typeof data.x !== 'number' || typeof data.y !== 'number') return;

        // 计算上下文菜单位置（相对于父窗口）
        const iframe = iframeRef.current;
        if (iframe) {
          const iframeRect = iframe.getBoundingClientRect();
          setContextMenu({
            x: iframeRect.left + data.x,
            y: iframeRect.top + data.y,
            element: data.element,
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [messageApi]);

  /**
   * 关闭右键菜单
   */
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  /**
   * 复制元素 HTML
   */
  const handleCopyHTML = useCallback(
    (html: string) => {
      void navigator.clipboard.writeText(html);
      messageApi.success(t('preview.html.copySuccess'));
      setContextMenu(null);
    },
    [messageApi, t]
  );

  /**
   * 下载 HTML
   */
  const handleDownload = () => {
    const blob = new Blob([htmlCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${file_path?.split('/').pop() || 'document'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * 切换编辑模式
   */
  const handleToggleEdit = () => {
    if (editMode) {
      // 保存编辑
      setHtmlCode(htmlCode);
    }
    setEditMode(!editMode);
  };

  /**
   * 切换检查器模式
   */
  const handleToggleInspector = () => {
    setInspectorMode(!inspectorMode);
    if (!inspectorMode) {
      messageApi.info(t('preview.html.inspectorEnabled'));
    }
  };

  return (
    <div className='h-full w-full flex flex-col bg-bg-1'>
      {messageContextHolder}

      {/* 工具栏 */}
      {!hideToolbar && (
        <div className='flex items-center justify-between h-40px px-12px bg-bg-2 border-b border-border-base flex-shrink-0'>
          <div className='flex items-center gap-8px'>
            {/* 编辑按钮 */}
            <button
              onClick={handleToggleEdit}
              className={`px-12px py-4px rd-4px text-12px transition-colors ${editMode ? 'bg-primary text-white' : 'bg-bg-3 text-t-primary hover:bg-bg-4'}`}
            >
              {editMode ? `💾 ${t('common.save')}` : `✏️ ${t('common.edit')}`}
            </button>

            {/* 元素选择器按钮 */}
            <button
              onClick={handleToggleInspector}
              className={`px-12px py-4px rd-4px text-12px transition-colors ${inspectorMode ? 'bg-primary text-white' : 'bg-bg-3 text-t-primary hover:bg-bg-4'}`}
              title={t('preview.html.inspectorTooltip')}
            >
              🔍 {inspectorMode ? t('preview.html.inspecting') : t('preview.html.inspectorButton')}
            </button>

            {/* 选中的元素路径 */}
            {selectedElement && (
              <div className='text-12px text-t-secondary ms-8px'>
                {t('preview.html.selectedLabel')} <code className='bg-bg-3 px-4px rd-2px'>{selectedElement.path}</code>
              </div>
            )}
          </div>

          <div className='flex items-center gap-8px'>
            {/* 下载按钮 */}
            <button
              onClick={handleDownload}
              className='flex items-center gap-4px px-8px py-4px rd-4px cursor-pointer hover:bg-bg-3 transition-colors'
              title={t('preview.html.downloadHtml')}
            >
              <svg
                width='14'
                height='14'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                className='text-t-secondary'
              >
                <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
                <polyline points='7 10 12 15 17 10' />
                <line x1='12' y1='15' x2='12' y2='3' />
              </svg>
              <span className='text-12px text-t-secondary'>{t('common.download')}</span>
            </button>
          </div>
        </div>
      )}

      {/* 内容区域 */}
      <div className='flex-1 flex overflow-hidden'>
        {/* 左侧：代码编辑器（编辑模式时显示） */}
        {editMode && (
          <div className='flex-1 overflow-hidden border-e border-border-base'>
            <MonacoEditor
              height='100%'
              language='html'
              theme={currentTheme === 'dark' ? 'vs-dark' : 'vs'}
              value={htmlCode}
              onChange={(value) => setHtmlCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                formatOnPaste: true,
                formatOnType: true,
              }}
            />
          </div>
        )}

        {/* 右侧：HTML 预览 */}
        <div className={`${editMode ? 'flex-1' : 'w-full'} overflow-auto bg-white`}>
          <iframe
            ref={iframeRef}
            srcDoc={previewDocument}
            className='w-full h-full border-0'
            sandbox='allow-scripts allow-forms allow-popups allow-modals'
            title={t('preview.html.frameTitle')}
          />
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className='fixed bg-bg-1 border border-border-base rd-6px shadow-lg py-4px z-9999'
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className='px-12px py-6px text-13px text-t-primary hover:bg-bg-2 cursor-pointer transition-colors'
            onClick={() => handleCopyHTML(contextMenu.element.html)}
          >
            📋 {t('preview.html.copyElementHtml')}
          </div>
          <div
            className='px-12px py-6px text-13px text-t-primary hover:bg-bg-2 cursor-pointer transition-colors'
            onClick={() => {
              console.log('[HTMLPreview] Element info:', contextMenu.element);
              messageApi.info(t('preview.html.printedToConsole'));
              setContextMenu(null);
            }}
          >
            🔍 {t('preview.html.viewElementInfo')}
          </div>
        </div>
      )}
    </div>
  );
};

export default HTMLPreview;
