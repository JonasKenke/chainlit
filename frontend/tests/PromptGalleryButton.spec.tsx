import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IPrompt, promptGalleryState, useConfig } from '@chainlit/react-client';

import { PromptGalleryButton } from '@/components/chat/MessageComposer/PromptGalleryButton';

const fetchPromptsMock = vi.fn().mockResolvedValue(undefined);
const removePromptMock = vi.fn().mockResolvedValue(undefined);
const sharePromptMock = vi.fn().mockResolvedValue('/prompt/some-id');
const editPromptMock = vi.fn().mockResolvedValue({
  id: 'p1',
  title: 'Updated',
  content: 'New content',
  userId: 'u1',
  isShared: false,
  createdAt: '',
  updatedAt: ''
});
const savePromptMock = vi.fn().mockResolvedValue({
  id: 'p2',
  title: 'New',
  content: 'New content',
  userId: 'u1',
  isShared: false,
  createdAt: '',
  updatedAt: ''
});

vi.mock('@/components/i18n/Translator', () => ({
  default: ({ path }: { path: string }) => path,
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

vi.mock('@chainlit/react-client', async () => {
  const { atom } = await import('recoil');
  return {
    useConfig: vi.fn(),
    usePromptGallery: () => ({
      fetchPrompts: fetchPromptsMock,
      editPrompt: editPromptMock,
      removePrompt: removePromptMock,
      sharePrompt: sharePromptMock,
      savePrompt: savePromptMock
    }),
    promptGalleryState: atom<IPrompt[]>({
      key: 'promptGalleryState_test',
      default: []
    })
  };
});

// required for Radix UI
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const samplePrompts: IPrompt[] = [
  {
    id: 'p1',
    title: 'Summarise',
    content: 'Summarise this: {text}',
    userId: 'u1',
    isShared: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

describe('PromptGalleryButton', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (prompts = samplePrompts, props = {}) => {
    return render(
      <RecoilRoot
        initializeState={({ set }) => {
          set(promptGalleryState, prompts);
        }}
      >
        <PromptGalleryButton onSelect={mockOnSelect} {...props} />
      </RecoilRoot>
    );
  };

  it('returns null when promptGallery is disabled', () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: false } });
    const { container } = renderComponent();
    expect(container.firstChild).toBeNull();
  });

  const getGalleryBtn = () => document.getElementById('prompt-gallery-open')!;

  it('renders button when promptGallery is enabled', () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent();
    expect(getGalleryBtn()).toBeInTheDocument();
  });

  it('opens dialog on button click', async () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent();
    fireEvent.click(getGalleryBtn());
    await waitFor(() => {
      expect(screen.getByText('chat.promptGallery.title')).toBeInTheDocument();
    });
  });

  it('shows empty state when gallery has no prompts', async () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent([]);
    fireEvent.click(getGalleryBtn());
    await waitFor(() => {
      expect(
        screen.getByText('chat.promptGallery.empty.title')
      ).toBeInTheDocument();
    });
  });

  it('shows prompt list on open', async () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent(samplePrompts);
    fireEvent.click(getGalleryBtn());
    await waitFor(() => {
      expect(screen.getByText('Summarise')).toBeInTheDocument();
    });
  });

  it('calls fetchPrompts only once on first open', async () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent();
    fireEvent.click(getGalleryBtn());
    await waitFor(() => expect(fetchPromptsMock).toHaveBeenCalledTimes(1));
    // close via Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(getGalleryBtn());
    await act(() => Promise.resolve());
    expect(fetchPromptsMock).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect when a prompt is clicked', async () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent(samplePrompts);
    fireEvent.click(getGalleryBtn());
    await waitFor(() => screen.getByText('Summarise'));
    fireEvent.click(screen.getByText('Summarise'));
    expect(mockOnSelect).toHaveBeenCalledWith('Summarise this: {text}');
  });

  it('respects disabled prop', () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent(samplePrompts, { disabled: true });
    expect(getGalleryBtn()).toBeDisabled();
  });

  it('reopens gallery when edit dialog is closed/cancelled', async () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent(samplePrompts);
    // Open gallery
    fireEvent.click(getGalleryBtn());
    await waitFor(() => screen.getByText('Summarise'));
    // Click edit on the prompt
    const editBtn = screen.getByRole('button', {
      name: 'chat.promptGallery.edit'
    });
    fireEvent.click(editBtn);
    // Gallery closed, edit dialog open
    await waitFor(() => screen.getByText('chat.promptGallery.save'));
    // Cancel the edit dialog
    fireEvent.click(
      screen.getByRole('button', { name: 'chat.promptGallery.dialog.cancel' })
    );
    // Gallery should reopen
    await waitFor(() =>
      expect(screen.getByText('chat.promptGallery.title')).toBeInTheDocument()
    );
  });

  it('reopens gallery after a successful edit save', async () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent(samplePrompts);
    fireEvent.click(getGalleryBtn());
    await waitFor(() => screen.getByText('Summarise'));
    fireEvent.click(
      screen.getByRole('button', { name: 'chat.promptGallery.edit' })
    );
    await waitFor(() => screen.getByText('chat.promptGallery.save'));
    // Save
    fireEvent.click(
      screen.getByRole('button', { name: 'chat.promptGallery.dialog.save' })
    );
    await waitFor(() =>
      expect(screen.getByText('chat.promptGallery.title')).toBeInTheDocument()
    );
  });

  it('gallery stays open when New Prompt is clicked (save dialog stacks on top)', async () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent([]);
    fireEvent.click(getGalleryBtn());
    await waitFor(() => screen.getByText('chat.promptGallery.new'));
    fireEvent.click(screen.getByText('chat.promptGallery.new'));
    // Gallery title is still visible (gallery stays open)
    expect(screen.getByText('chat.promptGallery.title')).toBeInTheDocument();
    // Save dialog also opens on top
    await waitFor(() => {
      expect(screen.getByText('chat.promptGallery.save')).toBeInTheDocument();
    });
  });

  it('shows New Prompt button in open dialog', async () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent([]);
    fireEvent.click(getGalleryBtn());
    await waitFor(() => {
      expect(screen.getByText('chat.promptGallery.new')).toBeInTheDocument();
    });
  });
});
