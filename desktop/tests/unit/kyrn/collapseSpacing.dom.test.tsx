import { cleanup, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Collapse } from '@/renderer/ui/collapse';
import hiveStyles from '@/renderer/pages/conversation/KyrnPanel/Hive/Hive.module.css';
import judgeStyles from '@/renderer/pages/conversation/KyrnPanel/Judge/Judge.module.css';
import { cssRules, readRendererCss } from '../../helpers/cssRules';

afterEach(cleanup);

describe.each([
  {
    name: 'judge',
    path: 'pages/conversation/KyrnPanel/Judge/Judge.module.css',
    styles: judgeStyles,
    padding: 'padding: 8px;',
  },
  {
    name: 'hive',
    path: 'pages/conversation/KyrnPanel/Hive/Hive.module.css',
    styles: hiveStyles,
    padding: 'padding: 10px;',
  },
])('$name collapse spacing', ({ path, styles, padding }) => {
  it('targets the custom Collapse structure without changing its open/close behavior', () => {
    const { container } = render(
      <Collapse bordered={false} className={styles.collapse}>
        <Collapse.Item name='details' header='Details'>
          Content
        </Collapse.Item>
      </Collapse>
    );

    const root = container.firstElementChild as HTMLElement;
    const item = root.firstElementChild as HTMLElement;
    const button = item.firstElementChild as HTMLButtonElement;
    const content = button.nextElementSibling as HTMLElement;

    expect(root).toHaveClass(styles.collapse);
    expect(item.tagName).toBe('DIV');
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(content).toBeNull();

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button.nextElementSibling).toHaveTextContent('Content');

    const css = readRendererCss(path);
    expect(cssRules(css, '.collapse > div > button').some((rule) => rule.includes(padding))).toBe(true);
    expect(css).not.toContain('arco-collapse');
  });
});
