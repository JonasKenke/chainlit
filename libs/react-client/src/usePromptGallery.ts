import { useCallback, useContext } from 'react';
import { useRecoilState } from 'recoil';

import { IPrompt } from './types/prompt';

import { ChainlitContext } from './context';
import { promptGalleryState } from './state';

const usePromptGallery = () => {
  const apiClient = useContext(ChainlitContext);
  const [prompts, setPrompts] = useRecoilState(promptGalleryState);

  const fetchPrompts = useCallback(async () => {
    const list = await apiClient.listPrompts();
    setPrompts(list);
  }, [apiClient, setPrompts]);

  const savePrompt = useCallback(
    async (title: string, content: string): Promise<IPrompt> => {
      const created = await apiClient.createPrompt(title, content);
      setPrompts((prev) => [created, ...prev]);
      return created;
    },
    [apiClient, setPrompts]
  );

  const editPrompt = useCallback(
    async (
      id: string,
      fields: { title?: string; content?: string }
    ): Promise<IPrompt> => {
      const updated = await apiClient.updatePrompt(id, fields);
      setPrompts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    },
    [apiClient, setPrompts]
  );

  const removePrompt = useCallback(
    async (id: string): Promise<void> => {
      await apiClient.deletePrompt(id);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    },
    [apiClient, setPrompts]
  );

  const sharePrompt = useCallback(
    async (id: string, isShared: boolean): Promise<string> => {
      const { prompt, shareUrl } = await apiClient.sharePrompt(id, isShared);
      setPrompts((prev) => prev.map((p) => (p.id === id ? prompt : p)));
      return shareUrl;
    },
    [apiClient, setPrompts]
  );

  const addSharedPrompt = useCallback(
    async (sharedId: string): Promise<IPrompt> => {
      const created = await apiClient.addSharedPrompt(sharedId);
      setPrompts((prev) => [created, ...prev]);
      return created;
    },
    [apiClient, setPrompts]
  );

  return {
    prompts,
    fetchPrompts,
    savePrompt,
    editPrompt,
    removePrompt,
    sharePrompt,
    addSharedPrompt
  };
};

export { usePromptGallery };
