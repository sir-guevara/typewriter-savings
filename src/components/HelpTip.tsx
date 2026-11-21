import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Info, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Tooltip appearance, with a dismissible popover so help also works by touch
// and keyboard rather than depending on hover alone.
export default function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const suppressFocus = useRef(false);
  const dismiss = () => { suppressFocus.current = true; trigger.current?.focus(); suppressFocus.current = false; setOpen(false); };
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const cancelClose = () => clearTimeout(timer.current);
  const show = () => { cancelClose(); setOpen(true); };
  const closeSoon = () => { cancelClose(); timer.current = setTimeout(() => setOpen(false), 180); };
  useEffect(() => () => clearTimeout(timer.current), []);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button ref={trigger} type="button" aria-label={`About ${label}`} className="help-tip-trigger inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground hover:bg-muted hover:text-foreground" onMouseEnter={show} onMouseLeave={closeSoon} onFocus={() => { if (!suppressFocus.current) show(); }} onClick={event => { event.preventDefault(); show(); }}><Info aria-hidden="true" className="h-4 w-4"/></button></PopoverTrigger>
    <PopoverContent aria-label={label} className="help-tip-content max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-sm p-4 font-body text-sm leading-relaxed" sideOffset={8} onEscapeKeyDown={event => { event.preventDefault(); dismiss(); }} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()} onMouseEnter={cancelClose} onMouseLeave={closeSoon}>
      <div className="mb-2 flex items-start justify-between gap-3"><b className="text-sm">{label}</b><button type="button" aria-label="Close help" className="-mr-1 -mt-1 rounded-sm p-1 text-muted-foreground hover:bg-muted" onClick={dismiss}><X aria-hidden="true" className="h-4 w-4"/></button></div>
      <div className="space-y-3 text-muted-foreground">{children}</div>
    </PopoverContent>
  </Popover>;
}
