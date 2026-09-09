import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption<T = string | number> {
  value: T;
  label: string;
  sublabel?: string;
  fontFamily?: string;
  group?: string;
  icon?: React.ReactNode;
}

interface DropdownProps<T = string | number> {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  label?: string;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  direction?: 'down' | 'up';
  align?: 'left' | 'right';
}

export function Dropdown<T = string | number>({
  value,
  onChange,
  options,
  label,
  placeholder = 'Select an option…',
  className = '',
  buttonClassName = '',
  menuClassName = '',
  direction = 'down',
  align = 'left',
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Group options if any have a group property
  const groupedOptions = options.reduce<Record<string, DropdownOption<T>[]>>((acc, option) => {
    const groupName = option.group || '';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(option);
    return acc;
  }, {});

  const hasGroups = Object.keys(groupedOptions).some((g) => g !== '');

  return (
    <div className={`${isOpen ? 'relative z-50' : 'relative z-10'} ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--fg-muted)' }}>
          {label}
        </label>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 outline-none select-none text-left ${buttonClassName}`}
          style={{
            background: 'rgba(255, 255, 255, 0.65)',
            border: isOpen ? '1.5px solid var(--moss)' : '1.5px solid var(--border)',
            color: 'var(--fg)',
            boxShadow: isOpen
              ? '0 0 0 3px rgba(93, 112, 82, 0.15)'
              : '0 2px 8px rgba(44, 44, 36, 0.04)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0 truncate">
            {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
            <span
              className="truncate text-sm"
              style={{
                fontFamily: selectedOption?.fontFamily || 'inherit',
                fontSize: selectedOption?.fontFamily ? 15 : 13,
              }}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            {selectedOption?.sublabel && (
              <span
                className="text-[11px] font-normal px-2 py-0.5 rounded-full shrink-0"
                style={{ background: 'var(--moss-dim)', color: 'var(--moss)' }}
              >
                {selectedOption.sublabel}
              </span>
            )}
          </div>

          <ChevronDown
            style={{
              height: 15,
              width: 15,
              color: 'var(--fg-muted)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
            className="shrink-0 ml-1"
          />
        </button>

        {/* Popover Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: direction === 'up' ? 6 : -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: direction === 'up' ? 4 : -4, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} w-full z-[100] max-h-72 overflow-y-auto p-1.5 rounded-[1.75rem] shadow-2xl ${
                direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
              } ${menuClassName}`}
              style={{
                background: 'var(--surface)',
                border: '1.5px solid var(--border)',
                boxShadow: '0 16px 40px -6px rgba(44, 44, 36, 0.25), 0 4px 16px -2px rgba(93, 112, 82, 0.12)',
              }}
              role="listbox"
            >
              {hasGroups ? (
                Object.entries(groupedOptions).map(([group, groupItems], groupIdx) => (
                  <div key={group || groupIdx} className="mb-2 last:mb-0">
                    {group && (
                      <div
                        className="px-3.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider select-none"
                        style={{ color: 'var(--fg-muted)' }}
                      >
                        {group}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {groupItems.map((option) => (
                        <DropdownItem
                          key={String(option.value)}
                          option={option}
                          isSelected={option.value === value}
                          onSelect={() => {
                            onChange(option.value);
                            setIsOpen(false);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-0.5">
                  {options.map((option) => (
                    <DropdownItem
                      key={String(option.value)}
                      option={option}
                      isSelected={option.value === value}
                      onSelect={() => {
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DropdownItem<T>({
  option,
  isSelected,
  onSelect,
}: {
  option: DropdownOption<T>;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl text-left transition-all duration-150 group cursor-pointer"
      style={{
        background: isSelected ? 'var(--moss-dim)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(93, 112, 82, 0.08)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {option.icon && <span className="shrink-0">{option.icon}</span>}
        <div className="min-w-0 flex-1">
          <div
            className="truncate font-semibold text-sm"
            style={{
              fontFamily: option.fontFamily || 'inherit',
              fontSize: option.fontFamily ? 17 : 13,
              color: isSelected ? 'var(--moss)' : 'var(--fg)',
            }}
          >
            {option.label}
          </div>
          {option.sublabel && (
            <div className="text-[11px] font-normal truncate" style={{ color: 'var(--fg-muted)' }}>
              {option.sublabel}
            </div>
          )}
        </div>
      </div>

      {isSelected && (
        <Check
          style={{ height: 16, width: 16, color: 'var(--moss)' }}
          className="shrink-0 ml-2"
        />
      )}
    </button>
  );
}
