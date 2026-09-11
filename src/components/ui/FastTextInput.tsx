import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';

export interface FastTextInputProps {
  value: string;
  fontFamily?: string;
  placeholder?: string;
  onCommit: (value: string) => void;
  onPressEnter?: () => void;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
}

export const FastTextInput: React.FC<FastTextInputProps> = ({
  value,
  fontFamily,
  placeholder,
  onCommit,
  onPressEnter,
  className,
  style,
  autoFocus = true,
}) => {
  const [localVal, setLocalVal] = useState<string>(value || '');
  const valRef = useRef<string>(localVal);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // Keep localVal in sync if the external prop changes from outside (e.g. document reset)
  useEffect(() => {
    if (value !== valRef.current) {
      setLocalVal(value || '');
      valRef.current = value || '';
    }
  }, [value]);

  const commitImmediate = (valToCommit: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    onCommitRef.current(valToCommit);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setLocalVal(nextVal);
    valRef.current = nextVal;

    // Debounce the parent store & storage serialization by 150ms
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onCommitRef.current(nextVal);
    }, 150);
  };

  const handleBlur = () => {
    commitImmediate(valRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitImmediate(valRef.current);
      if (onPressEnter) {
        onPressEnter();
      }
    }
  };

  useLayoutEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
      // If default placeholder 'Text' is there, select it so typing replaces it immediately
      if (inputRef.current.value === 'Text') {
        inputRef.current.select();
      }
    }
  }, [autoFocus]);

  // Clean up timer on unmount and commit any pending value
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        onCommitRef.current(valRef.current);
      }
    };
  }, []);

  const fontStyle = fontFamily
    ? `"${fontFamily}", cursive, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    : 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  return (
    <input
      ref={inputRef}
      type="text"
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      placeholder={placeholder}
      style={{
        fontFamily: fontStyle,
        ...style,
      }}
      className={className}
      autoComplete="off"
      spellCheck={false}
    />
  );
};
