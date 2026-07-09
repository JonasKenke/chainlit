import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import Page from 'pages/Page';

import {
  ChainlitContext,
  IPrompt,
  useAuth,
  useConfig,
  usePromptGallery
} from '@chainlit/react-client';

import { useTranslation } from '@/components/i18n/Translator';
import { Button } from '@/components/ui/button';

export default function PromptSharePage() {
  const { id } = useParams<{ id: string }>();
  const apiClient = useContext(ChainlitContext);
  const { config } = useConfig();
  const { user } = useAuth();
  const { addSharedPrompt } = usePromptGallery();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [prompt, setPrompt] = useState<IPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient
      .getSharedPrompt(id)
      .then((p) => {
        setPrompt(p);
        setLoading(false);
      })
      .catch(() => {
        setError('Prompt not found or no longer shared.');
        setLoading(false);
      });
  }, [id, apiClient]);

  const handleAdd = async () => {
    if (!id || !user) {
      navigate('/login');
      return;
    }
    setAdding(true);
    try {
      await addSharedPrompt(id);
      setAdded(true);
      toast.success(t('chat.promptGallery.added'));
      navigate('/'); // ponytail: go back to app after adding
    } catch {
      toast.error('Failed to add prompt');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Page>
      <div className="flex flex-col items-center justify-center flex-1 p-6 gap-6 max-w-xl mx-auto w-full">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" onClick={() => navigate('/')}>
              Go home
            </Button>
          </div>
        ) : prompt ? (
          <div className="w-full flex flex-col gap-4">
            <h1 className="text-xl font-semibold">{prompt.title}</h1>
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <pre className="whitespace-pre-wrap text-sm font-sans">
                {prompt.content}
              </pre>
            </div>
            {config?.promptGallery ? (
              <Button
                onClick={handleAdd}
                disabled={adding || added}
                className="self-start"
              >
                {added
                  ? t('chat.promptGallery.added')
                  : adding
                    ? 'Adding…'
                    : t('chat.promptGallery.addToGallery')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Page>
  );
}
