'use client';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          't-body h-control-md w-full rounded-md border border-hairline-strong bg-canvas px-sm',
          'text-ink placeholder:text-ink-faint',
          'transition-colors duration-[120ms] focus:border-hairline-focus',
          'disabled:cursor-not-allowed disabled:text-ink-disabled',
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { autoGrow?: boolean }
>(function Textarea({ className, autoGrow, onInput, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      onInput={(e) => {
        if (autoGrow) {
          const el = e.currentTarget;
          el.style.height = 'auto';
          el.style.height = `${el.scrollHeight}px`;
        }
        onInput?.(e);
      }}
      className={cn(
        't-body w-full resize-none rounded-md border border-hairline-strong bg-canvas p-sm',
        'text-ink placeholder:text-ink-faint',
        'transition-colors duration-[120ms] focus:border-hairline-focus',
        className,
      )}
      {...props}
    />
  );
});
