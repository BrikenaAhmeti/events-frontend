import clsx from 'clsx';
import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

const control =
  'min-h-11 w-full rounded-xl border border-input bg-surface-raised px-3.5 text-sm text-foreground shadow-sm transition-[background-color,border-color,box-shadow] placeholder:text-muted-foreground hover:border-primary/45 focus:border-primary/55 focus:outline-none focus:ring-2 focus:ring-focus/20 disabled:pointer-events-none disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={clsx(control, className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea ref={ref} className={clsx(control, 'min-h-28 resize-y py-3', className)} {...props} />
  );
});
