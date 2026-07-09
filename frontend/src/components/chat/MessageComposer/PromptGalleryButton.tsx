import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@radix-ui/react-popover';
import { BookMarked, Copy, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { toast } from 'sonner';

import {
  IPrompt,
  promptGalleryState,
  useConfig,
  usePromptGallery
} from '@chainlit/react-client';

import { PromptSaveDialog } from '@/components/PromptSaveDialog';
import Translator, { useTranslation } from '@/components/i18n/Translator';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandListScrollable
} from '@/components/ui/command';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

const TOOLTIP_DELAY_MS = 700;

interface Props {
  disabled?: boolean;
  onSelect: (content: string) => void;
}

export function PromptGalleryButton({ disabled = false, onSelect }: Props) {
  const { config } = useConfig();
  const { t } = useTranslation();
  const prompts = useRecoilValue(promptGalleryState);
  const { fetchPrompts, editPrompt, removePrompt, sharePrompt } =
    usePromptGallery();

  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IPrompt | null>(null);
  const hoverTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // Fetch on first open
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (open && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchPrompts().catch(() => null);
    }
  }, [open, fetchPrompts]);

  useEffect(() => {
    if (open) cancelTooltipOpen();
  }, [open]);

  const scheduleTooltipOpen = () => {
    if (disabled || open) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(
      () => setTooltipOpen(true),
      TOOLTIP_DELAY_MS
    );
  };

  const cancelTooltipOpen = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setTooltipOpen(false);
  };

  const handleShare = useCallback(
    async (prompt: IPrompt) => {
      const shareUrl = await sharePrompt(prompt.id, true);
      const fullUrl = `${window.location.origin}${shareUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      toast.success(t('chat.promptGallery.copied'));
    },
    [sharePrompt, t]
  );

  if (!config?.promptGallery) return null;

  return (
    <div className={cn('prompt-gallery-popover-wrapper')}>
      <Popover
        open={open}
        onOpenChange={(val) => {
          setOpen(val);
          if (val) cancelTooltipOpen();
        }}
      >
        <TooltipProvider>
          <Tooltip open={!open && tooltipOpen}>
            <TooltipTrigger asChild>
              <span
                onMouseEnter={scheduleTooltipOpen}
                onMouseLeave={cancelTooltipOpen}
                onFocus={cancelTooltipOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    id="prompt-gallery-open"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'flex items-center h-9 px-3 rounded-full font-medium text-[13px] gap-1.5',
                      'hover:bg-muted hover:dark:bg-muted transition-all duration-200',
                      open && 'bg-muted/50'
                    )}
                    disabled={disabled}
                  >
                    <BookMarked className="!size-5" />
                  </Button>
                </PopoverTrigger>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('chat.promptGallery.button')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <PopoverContent
          align="start"
          sideOffset={12}
          className="p-2 w-[340px] rounded-lg border shadow-md bg-background"
        >
          <Command>
            <CommandListScrollable className="max-h-[360px] custom-scrollbar">
              {prompts.length === 0 ? (
                <CommandEmpty className="py-6 px-4">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <p className="text-sm font-medium text-foreground">
                      <Translator path="chat.promptGallery.empty.title" />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Translator path="chat.promptGallery.empty.description" />
                    </p>
                  </div>
                </CommandEmpty>
              ) : (
                <CommandGroup heading={t('chat.promptGallery.title')}>
                  {prompts.map((prompt) => (
                    <CommandItem
                      key={prompt.id}
                      value={prompt.id}
                      onSelect={() => {
                        onSelect(prompt.content);
                        setOpen(false);
                        cancelTooltipOpen();
                      }}
                      className="cursor-pointer group flex-col items-start"
                    >
                      <div className="flex items-start justify-between gap-2 w-full overflow-hidden">
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          <span className="truncate text-sm font-medium">
                            {prompt.title}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {prompt.content}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            aria-label={t('chat.promptGallery.edit')}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditTarget(prompt);
                              setOpen(false);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            aria-label={t('chat.promptGallery.share.title')}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShare(prompt).catch(() =>
                                toast.error('Failed to share')
                              );
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            aria-label={t('chat.promptGallery.delete')}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              removePrompt(prompt.id).catch(() =>
                                toast.error('Failed to delete')
                              );
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandListScrollable>
          </Command>
        </PopoverContent>
      </Popover>

      {editTarget ? (
        <PromptSaveDialog
          open={!!editTarget}
          initialTitle={editTarget.title}
          initialContent={editTarget.content}
          onSave={async (title, content) => {
            await editPrompt(editTarget.id, { title, content });
            setEditTarget(null);
          }}
          onClose={() => setEditTarget(null)}
        />
      ) : null}
    </div>
  );
}

export default PromptGalleryButton;
