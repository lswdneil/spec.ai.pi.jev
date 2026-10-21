import React, { useCallback, useEffect } from 'react';
import { kyrnBrowserBridge } from '@/common/kyrn/browserBridge';
import { MU_BROWSER_PARTITION } from '@/common/kyrn/browserRun';
import BrowserViewer, { type BrowserViewerProps } from '../BrowserViewer';
import { useBrowserRun } from './runsStore';
import StepBar from './StepBar';
import { forgetWebview, registerWebview } from './webviews';

/**
 * A browser tab that spec.jev opened: the same viewer as every other browser tab, in the agent's own session partition,
 * with the step bar above the page. Its webContents is reported to spec.jev's bridge, not to the single-target one.
 */
const MuBrowserTab: React.FC<Omit<BrowserViewerProps, 'partition' | 'onWebContentsReady' | 'pristine'>> = (props) => {
  const { tabId } = props;
  const run = useBrowserRun(tabId);

  const handleReady = useCallback(
    (webContentsId: number, webview: Electron.WebviewTag) => {
      registerWebview(tabId, webview);
      void kyrnBrowserBridge.ready.invoke({ tabId, webContentsId });
    },
    [tabId]
  );
  useEffect(() => () => forgetWebview(tabId), [tabId]);

  return (
    <div className='flex flex-col h-full w-full min-h-0'>
      {run && <StepBar run={run} />}
      <div className='flex-1 min-h-0'>
        {/* Pristine: spec.jev fills in forms and submits them, so the page keeps its own links and forms. */}
        <BrowserViewer {...props} partition={MU_BROWSER_PARTITION} onWebContentsReady={handleReady} pristine />
      </div>
    </div>
  );
};

export default MuBrowserTab;
