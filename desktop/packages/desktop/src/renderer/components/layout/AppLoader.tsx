import { Spin } from '@/renderer/ui/spinner';
import React from 'react';

const AppLoader: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Spin dot />
    </div>
  );
};

export default AppLoader;
