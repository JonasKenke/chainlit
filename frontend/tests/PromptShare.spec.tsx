import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { describe, expect, it, vi } from 'vitest';

import PromptSharePage from '@/pages/PromptShare';

// ── imports after mocks ────────────────────────────────────────────────────
import { ChainlitContext } from '@chainlit/react-client';

// ── hoisted mocks (must be defined before vi.mock factories run) ────────────
const navigateMock = vi.hoisted(() => vi.fn());
const addSharedPromptMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);
const getSharedPromptMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    id: 'shared-abc',
    title: 'Cool Prompt',
    content: 'Do something cool',
    userId: 'u1',
    isShared: true,
    createdAt: '',
    updatedAt: ''
  })
);

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useParams: () => ({ id: 'shared-abc' })
}));

vi.mock('@/components/i18n/Translator', () => ({
  useTranslation: () => ({ t: (k: string) => k })
}));

vi.mock('@chainlit/react-client', async () => {
  const { createContext } = await import('react');
  return {
    ChainlitContext: createContext<any>(undefined),
    useAuth: () => ({ user: { id: 'u1' } }),
    useConfig: () => ({ config: { promptGallery: true } }),
    usePromptGallery: () => ({ addSharedPrompt: addSharedPromptMock })
  };
});

vi.mock('pages/Page', () => ({
  default: ({ children }: any) => <>{children}</>
}));

const fakeApi = { getSharedPrompt: getSharedPromptMock };

const renderPage = () =>
  render(
    <RecoilRoot>
      <ChainlitContext.Provider value={fakeApi}>
        <PromptSharePage />
      </ChainlitContext.Provider>
    </RecoilRoot>
  );

describe('PromptSharePage', () => {
  it('shows the shared prompt title and content', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Cool Prompt'));
    expect(screen.getByText('Do something cool')).toBeInTheDocument();
  });

  it('navigates to / after adding the prompt', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Cool Prompt'));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'chat.promptGallery.addToGallery' })
      );
    });
    await waitFor(() =>
      expect(addSharedPromptMock).toHaveBeenCalledWith('shared-abc')
    );
    expect(navigateMock).toHaveBeenCalledWith('/');
  });
});
