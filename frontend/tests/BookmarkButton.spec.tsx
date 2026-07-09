import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { describe, expect, it, vi } from 'vitest';

import { IStep, useConfig } from '@chainlit/react-client';

import { BookmarkButton } from '@/components/chat/Messages/Message/Buttons/BookmarkButton';

const savePromptMock = vi.fn().mockResolvedValue({
  id: 'p1',
  title: 'My prompt',
  content: 'Hello world',
  userId: 'u1',
  isShared: false,
  createdAt: '',
  updatedAt: ''
});

vi.mock('@/components/i18n/Translator', () => ({
  default: ({ path }: { path: string }) => path,
  useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('@chainlit/react-client', async () => ({
  useConfig: vi.fn(),
  usePromptGallery: () => ({ savePrompt: savePromptMock })
}));

// Radix UI needs ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const fakeMessage: IStep = {
  id: 'msg-1',
  name: 'user',
  type: 'user_message',
  output: 'Summarise this document for me',
  createdAt: '2024-01-01T00:00:00Z'
} as IStep;

const renderBtn = (msg = fakeMessage) =>
  render(
    <RecoilRoot>
      <BookmarkButton message={msg} />
    </RecoilRoot>
  );

describe('BookmarkButton', () => {
  it('returns null when promptGallery disabled', () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: false } });
    const { container } = renderBtn();
    expect(container.firstChild).toBeNull();
  });

  it('renders bookmark icon when promptGallery enabled', () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderBtn();
    expect(
      screen.getByRole('button', { name: 'chat.promptGallery.save' })
    ).toBeInTheDocument();
  });

  it('opens save dialog on click', async () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderBtn();
    fireEvent.click(
      screen.getByRole('button', { name: 'chat.promptGallery.save' })
    );
    await waitFor(() => {
      // Dialog title uses the same key
      expect(
        screen.getAllByText('chat.promptGallery.save').length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it('pre-fills content from message.output', async () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderBtn();
    fireEvent.click(
      screen.getByRole('button', { name: 'chat.promptGallery.save' })
    );
    await waitFor(() => {
      const textarea = screen.getByRole('textbox', {
        name: 'chat.promptGallery.dialog.contentLabel'
      }) as HTMLTextAreaElement;
      expect(textarea.value).toBe('Summarise this document for me');
    });
  });
});
