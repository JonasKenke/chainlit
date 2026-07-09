import {
  act,
  fireEvent,
  render,
  screen
} from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IPrompt, promptGalleryState, useConfig } from '@chainlit/react-client';

import { PromptGalleryButton } from '@/components/chat/MessageComposer/PromptGalleryButton';

const fetchPromptsMock = vi.fn().mockResolvedValue(undefined);
const removePromptMock = vi.fn().mockResolvedValue(undefined);
const sharePromptMock = vi.fn().mockResolvedValue('/prompt/some-id');
const editPromptMock = vi.fn().mockResolvedValue({ id: 'p1', title: 'Updated', content: 'New content', userId: 'u1', isShared: false, createdAt: '', updatedAt: '' });

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
      prompts: [],
      fetchPrompts: fetchPromptsMock,
      editPrompt: editPromptMock,
      removePrompt: removePromptMock,
      sharePrompt: sharePromptMock
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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('renders button when promptGallery is enabled', () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows empty state when gallery has no prompts', () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent([]);
    fireEvent.click(screen.getByRole('button'));
    expect(
      screen.getByText('chat.promptGallery.empty.title')
    ).toBeInTheDocument();
  });

  it('shows prompt list on open', () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent(samplePrompts);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Summarise')).toBeInTheDocument();
  });

  it('calls fetchPrompts only once on first open', async () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent();
    const btn = screen.getByRole('button');
    // use real timers for this test since fetchPrompts is async
    vi.useRealTimers();
    fireEvent.click(btn); // open
    await vi.waitUntil(() => fetchPromptsMock.mock.calls.length >= 1);
    fireEvent.click(btn); // close
    fireEvent.click(btn); // open again
    expect(fetchPromptsMock).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect when a prompt is clicked', () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent(samplePrompts);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Summarise'));
    expect(mockOnSelect).toHaveBeenCalledWith('Summarise this: {text}');
  });

  it('respects disabled prop', () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent(samplePrompts, { disabled: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows tooltip after hover delay', async () => {
    (useConfig as any).mockReturnValue({ config: { promptGallery: true } });
    renderComponent();
    const btn = screen.getByRole('button');
    fireEvent.mouseEnter(btn);
    expect(
      screen.queryByText('chat.promptGallery.button')
    ).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(800));
    const tips = screen.getAllByText('chat.promptGallery.button');
    expect(tips.length).toBeGreaterThan(0);
  });
});
