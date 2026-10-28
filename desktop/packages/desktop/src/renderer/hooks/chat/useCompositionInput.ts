import { useRef, useState } from 'react';

/**
 * 共享的输入法合成事件处理hook
 * 消除SendBox组件和GUID页面中的IME处理重复代码
 */
export const useCompositionInput = () => {
  const isComposing = useRef(false);
  const compositionStartValue = useRef('');
  const compositionData = useRef('');
  const [isComposingState, setIsComposingState] = useState(false);

  const compositionHandlers = {
    onCompositionStartCapture: (event: React.CompositionEvent<HTMLTextAreaElement>) => {
      isComposing.current = true;
      compositionStartValue.current = event.currentTarget.value;
      compositionData.current = '';
      setIsComposingState(true);
    },
    onCompositionEndCapture: (event: React.CompositionEvent<HTMLTextAreaElement>) => {
      isComposing.current = false;
      compositionData.current = event.data ?? '';
      setIsComposingState(false);
    },
  };

  /**
   * Reads the text an IME actually committed. Some Windows IMEs leave the
   * textarea value empty and put the committed text only in `event.data`.
   */
  const commitComposition = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    const committedValue = event.currentTarget.value || event.data || compositionData.current;
    const previousValue = compositionStartValue.current;
    isComposing.current = false;
    compositionStartValue.current = '';
    compositionData.current = '';
    setIsComposingState(false);
    return { committedValue, previousValue };
  };

  const createKeyDownHandler = (onEnterPress: () => void, onKeyDownIntercept?: (e: React.KeyboardEvent) => boolean) => {
    return (e: React.KeyboardEvent) => {
      // The native flag is the truth for this event. Our ref can outlive an interrupted composition (focus moving to
      // the model menu, an input method that never delivers compositionend); trusting it would swallow Enter forever
      // and let the textarea insert a newline instead of sending.
      if (e.nativeEvent.isComposing) return;
      isComposing.current = false;
      setIsComposingState(false);
      if (onKeyDownIntercept?.(e)) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onEnterPress();
      }
    };
  };

  return {
    isComposing,
    isComposingState,
    compositionHandlers,
    commitComposition,
    createKeyDownHandler,
  };
};
