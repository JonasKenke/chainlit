import { Bookmark } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { IStep, useConfig, usePromptGallery } from '@chainlit/react-client';

import { PromptSaveDialog } from '@/components/PromptSaveDialog';
import { useTranslation } from '@/components/i18n/Translator';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

interface Props {
  message: IStep;
}

export function BookmarkButton({ message }: Props) {
  const { config } = useConfig();
  const { t } = useTranslation();
  const { savePrompt } = usePromptGallery();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!config?.promptGallery) return null;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label={t('chat.promptGallery.save')}
              onClick={() => setDialogOpen(true)}
            >
              <Bookmark className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('chat.promptGallery.save')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PromptSaveDialog
        open={dialogOpen}
        initialContent={message.output}
        onSave={async (title, content) => {
          await savePrompt(title, content);
          toast.success(t('chat.promptGallery.save'));
        }}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}

export default BookmarkButton;
