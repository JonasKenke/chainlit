import getRouterBasename from '@/lib/router';
import { cn } from '@/lib/utils';
import {
  BookMarked,
  Globe,
  GlobeLock,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react';
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
  CommandInput,
  CommandItem,
  CommandListScrollable
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

interface Props {
  disabled?: boolean;
  onSelect: (content: string) => void;
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand('copy')) {
      throw new Error('Clipboard is unavailable');
    }
  } finally {
    textarea.remove();
  }
}

export function PromptGalleryButton({ disabled = false, onSelect }: Props) {
  const { config } = useConfig();
  const { t } = useTranslation();
  const prompts = useRecoilValue(promptGalleryState);
  const { fetchPrompts, editPrompt, removePrompt, sharePrompt, savePrompt } =
    usePromptGallery();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IPrompt | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const hasFetchedRef = useRef(false);
  const fetchInFlightRef = useRef(false);
  useEffect(() => {
    if (open && !hasFetchedRef.current && !fetchInFlightRef.current) {
      fetchInFlightRef.current = true;
      Promise.resolve(fetchPrompts())
        .then(() => {
          hasFetchedRef.current = true;
        })
        .catch(() => null)
        .finally(() => {
          fetchInFlightRef.current = false;
        });
    }
  }, [open, fetchPrompts]);

  const handleShare = useCallback(
    async (prompt: IPrompt) => {
      const isCurrentlyShared = prompt.isShared;
      const newSharedState = !isCurrentlyShared;
      const shareUrl = await sharePrompt(prompt.id, newSharedState);
      if (newSharedState) {
        const basename = getRouterBasename().replace(/\/$/, '');
        const fullUrl = `${window.location.origin}${basename}${shareUrl}`;
        await copyToClipboard(fullUrl);
        toast.success(t('chat.promptGallery.copied'));
      } else {
        toast.success(t('chat.promptGallery.unshared'));
      }
    },
    [sharePrompt, t]
  );

  if (!config?.promptGallery) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                id="prompt-gallery-open"
                variant="ghost"
                size="icon"
                className={cn(
                  'rounded-full hover:bg-muted hover:dark:bg-muted transition-all duration-200',
                  open && 'bg-muted/50'
                )}
                disabled={disabled}
                onClick={() => setOpen(true)}
              >
                <BookMarked className="!size-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('chat.promptGallery.button')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DialogContent
          className="sm:max-w-2xl flex flex-col max-h-[80vh] gap-4"
          aria-describedby={undefined}
        >
          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <DialogTitle>{t('chat.promptGallery.title')}</DialogTitle>
            <Button
              id="prompt-gallery-new"
              size="sm"
              onClick={() => {
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('chat.promptGallery.new')}
            </Button>
          </DialogHeader>

          <Command className="flex-1 overflow-hidden border rounded-md">
            <CommandInput placeholder={t('chat.promptGallery.search')} />
            <CommandListScrollable className="max-h-[50vh] custom-scrollbar">
              {prompts.length === 0 ? (
                <CommandEmpty className="py-8 px-4">
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
                <CommandGroup>
                  {prompts.map((prompt) => (
                    <CommandItem
                      key={prompt.id}
                      value={`${prompt.id} ${prompt.title} ${prompt.content}`}
                      onSelect={() => {
                        onSelect(prompt.content);
                        setOpen(false);
                      }}
                      className="cursor-pointer flex-col items-start py-4"
                    >
                      <div className="flex items-start justify-between gap-2 w-full overflow-hidden">
                        <div className="flex flex-col gap-1 overflow-hidden">
                          <span className="text-sm font-medium">
                            {prompt.title}
                          </span>
                          <span className="line-clamp-2 text-xs text-muted-foreground whitespace-pre-wrap">
                            {prompt.content}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
                            className={cn(
                              'h-7 w-7',
                              prompt.isShared
                                ? 'text-blue-500 hover:text-blue-600'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                            aria-label={
                              prompt.isShared
                                ? t('chat.promptGallery.unshare')
                                : t('chat.promptGallery.share.title')
                            }
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShare(prompt).catch(() =>
                                toast.error(t('common.status.error.default'))
                              );
                            }}
                          >
                            {prompt.isShared ? (
                              <GlobeLock className="h-3.5 w-3.5" />
                            ) : (
                              <Globe className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            aria-label={t('chat.promptGallery.delete')}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              removePrompt(prompt.id).catch(() =>
                                toast.error(t('common.status.error.default'))
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
        </DialogContent>
      </Dialog>

      {editTarget && (
        <PromptSaveDialog
          open
          editing
          initialTitle={editTarget.title}
          initialContent={editTarget.content}
          onSave={async (title, content) => {
            await editPrompt(editTarget.id, { title, content });
            setEditTarget(null);
            setOpen(true);
          }}
          onClose={() => {
            setEditTarget(null);
            setOpen(true); // reopen gallery when edit is cancelled/closed
          }}
          onError={() => toast.error(t('common.status.error.default'))}
        />
      )}

      <PromptSaveDialog
        open={createOpen}
        onSave={async (title, content) => {
          await savePrompt(title, content);
          setCreateOpen(false);
          toast.success(t('chat.promptGallery.saved'));
        }}
        onClose={() => setCreateOpen(false)}
        onError={() => toast.error(t('common.status.error.default'))}
      />
    </>
  );
}

export default PromptGalleryButton;
