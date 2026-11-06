import React from 'react';
import { LockKeyhole } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/renderer/ui';
import AccountPanel from './AccountPanel';

type AccountManagementModalProps = {
  open: boolean;
  onClose: () => void;
};

const AccountManagementModal: React.FC<AccountManagementModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  return (
    <Modal
      visible={open}
      onCancel={onClose}
      footer={null}
      width={520}
      title={
        <span className='inline-flex items-center gap-2'>
          <LockKeyhole className='h-4 w-4 text-sv-muted' />
          {t('login.account.manageTitle')}
        </span>
      }
      data-testid='account-management-modal'
    >
      <div className='max-h-[min(72vh,620px)] overflow-y-auto pr-1'>
        <AccountPanel variant='modal' />
      </div>
    </Modal>
  );
};

export default AccountManagementModal;
