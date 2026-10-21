import React from 'react';
import classNames from 'classnames';
import logo from '@/renderer/assets/logos/brand/app.png';
import styles from './Brand.module.css';

export type MuMarkProps = {
  /** Edge length in px. */
  size?: number;
  /** Kept for callers that ask for the bare mark; the logo is one image either way. */
  variant?: 'tile' | 'glyph';
  /** A soft halo behind the mark, for hero placements (empty state, startup gate). */
  halo?: boolean;
  /** Accessible name. Without it the mark is decorative and hidden from assistive technology. */
  title?: string;
  className?: string;
};

/**
 * The spec.jev brand mark: the loop, built by scripts/kyrn/icon/build-icon.py from the brand source and
 * bundled as one PNG, so it looks the same at every size and in every theme.
 */
const MuMark: React.FC<MuMarkProps> = ({ size = 32, halo = false, title, className }) => (
  <span
    className={classNames(styles.mark, halo && styles.halo, className)}
    style={{ width: size, height: size }}
    data-testid='mu-mark'
  >
    <img
      src={logo}
      width={size}
      height={size}
      alt={title ?? ''}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      draggable={false}
    />
  </span>
);

export default MuMark;
