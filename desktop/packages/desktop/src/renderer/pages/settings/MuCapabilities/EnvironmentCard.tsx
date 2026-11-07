import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ipcBridge } from '@/common';
import type { EnvironmentDependency, EnvironmentReport } from '@/common/types/environment';
import { Badge } from '@/renderer/ui/badge';
import { Button } from '@/renderer/ui/button';
import OneLine from '@/renderer/components/settings/OneLine';
import { Card } from '../KyrnSettings/sections/SectionShell';
import styles from '../KyrnSettings/sections/sections.module.css';

const ORDER: EnvironmentDependency['id'][] = ['python', 'pythonDocx', 'chromium'];

function byId(report: EnvironmentReport, id: EnvironmentDependency['id']): EnvironmentDependency | undefined {
  return report.dependencies.find((dependency) => dependency.id === id);
}

/**
 * What the built-in skills need from the machine. Python ships with the app; Chromium comes from
 * the Edge or Chrome a Windows machine already has. A missing component only disables the skills
 * that use it, so this sits above the skill list as a status card, not a blocking gate.
 */
export default function EnvironmentCard() {
  const { t } = useTranslation();
  const [report, setReport] = useState<EnvironmentReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      setReport(await ipcBridge.environment.check.invoke());
    } catch {
      setReport(null);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card
      testId='mu-dependencies'
      title={t('mu.capabilities.dependencies.title')}
      summary={t('mu.capabilities.dependencies.lead')}
      extra={
        <Button size='small' type='text' loading={busy} onClick={() => void load()}>
          {t('mu.capabilities.dependencies.check')}
        </Button>
      }
      dim={busy && !report}
    >
      {failed ? <div className={styles.empty}>{t('mu.capabilities.dependencies.failed')}</div> : null}
      {!failed && !report ? <div className={styles.empty}>{t('mu.capabilities.dependencies.checking')}</div> : null}
      {report
        ? ORDER.map((id) => {
            const dependency = byId(report, id);
            if (!dependency) return null;
            const available = t(`mu.capabilities.dependencies.${id}.ok`);
            const missing = t(`mu.capabilities.dependencies.${id}.missing`);
            const source = dependency.source
              ? t(`mu.capabilities.dependencies.source.${dependency.source}`)
              : undefined;
            return (
              <div key={id} className={styles.plainRow} data-testid={`mu-dependency-${id}`}>
                <div className={styles.plainMain}>
                  <div className={styles.plainText}>
                    <div className={styles.plainTitle}>
                      <span>{t(`mu.capabilities.dependencies.${id}.name`)}</span>
                      {source ? <span className={styles.choiceTag}>{source}</span> : null}
                    </div>
                    <OneLine text={dependency.ok ? available : missing} />
                    {dependency.detail && dependency.ok ? (
                      <OneLine text={dependency.detail} className={styles.meta} />
                    ) : null}
                  </div>
                  <Badge
                    status={dependency.ok ? 'success' : 'error'}
                    text={
                      dependency.ok
                        ? t('mu.capabilities.dependencies.available')
                        : t('mu.capabilities.dependencies.missing')
                    }
                  />
                </div>
              </div>
            );
          })
        : null}
    </Card>
  );
}
