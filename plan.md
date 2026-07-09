# Plan: Prompt Gallery

Store reusable prompts, edit them in place, and share them via a link. Anyone
with the link can add the prompt to their own gallery. Opt-in via `config.toml`.
Storage is left to the user (data-layer seam), exactly like chat history.

## Guiding principle (reuse, don't invent)

Two features already in the repo cover ~90% of this. Mirror them:

| Need                                 | Existing pattern to copy                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| Config-gated popover in composer     | `frontend/.../MessageComposer/FavoriteButton.tsx` + `features.favorites` flag     |
| Bookmark under a message             | `frontend/.../Messages/Message/Buttons/index.tsx` (add button for `user_message`) |
| Shareable, anonymously-viewable link | `GET /project/share/{thread_id}` + `is_shared` metadata + `/share/:id` route      |
| Storage owned by the user            | `BaseDataLayer` methods (favorites) + `@cl.data_layer` registration               |
| Feature exposed to frontend          | `/project/settings` → `features`/`threadSharing` flags                            |

Net new concept = a `Prompt` record (id, title, content, owner, is_shared). Everything
else is wiring that already exists.

---

## Data model

`Prompt` (Pydantic model in `backend/chainlit/types.py`):

```
id: str            # uuid4, also the share slug
title: str
content: str
user_id: str       # owner
is_shared: bool = False
created_at: str
updated_at: str
```

Frontend `IPrompt` mirror in `libs/react-client/src/types/`.

---

## Backend

### 1. Config flag — `backend/chainlit/config.py`

- `config.toml` template (near `favorites = false`, line ~118):
  ```toml
  # Enable the prompt gallery (store, edit, share reusable prompts)
  prompt_gallery = false
  ```
- Add to `FeaturesSettings` (line ~339): `prompt_gallery: bool = False`

### 2. Storage seam — `backend/chainlit/data/base.py`

Add methods to `BaseDataLayer`. **Backward compatibility: do NOT use `@abstractmethod`.**
Ship concrete default implementations (raise `NotImplementedError` or no-op) so every
existing custom data layer keeps working without changes:

```
async def create_prompt(self, prompt: PromptDict) -> PromptDict
async def list_prompts(self, user_id: str) -> List[PromptDict]
async def get_prompt(self, prompt_id: str) -> Optional[PromptDict]   # for shared lookup
async def update_prompt(self, prompt: PromptDict) -> PromptDict
async def delete_prompt(self, prompt_id: str, user_id: str) -> bool
```

Implement in `sql_alchemy.py` (new `prompts` table via migration), and leave
`dynamodb.py` / `literalai.py` on the default (feature simply inert there until implemented).
"Up to the user how to store" = they subclass/register their own `@cl.data_layer`.

> ponytail: default methods over abstract keeps all 3 existing data layers + every
> user subclass compiling. Only SQLAlchemy gets a real implementation now.

### 3. REST endpoints — `backend/chainlit/server.py`

Model directly on the favorites (owner CRUD) + shared-thread (anonymous read) routes:

```
GET    /project/prompts               # list caller's prompts (auth required)
POST   /project/prompts               # create/save {title, content}
PUT    /project/prompts/{id}          # edit (author only)
DELETE /project/prompts/{id}          # delete (author only)
POST   /project/prompts/{id}/share    # set is_shared=true, return share url
GET    /project/prompt/share/{id}     # anonymous read IF is_shared  (copy of get_shared_thread)
POST   /project/prompts/{id}/add      # copy a shared prompt into caller's gallery
```

- All gated on `config.features.prompt_gallery` + `get_data_layer()` present → else 400/404.
- `/project/prompt/share/{id}` requires **no auth** and 404s when `is_shared` is false
  (verbatim behavior of `get_shared_thread`, avoids leaking existence).
- Share URL = base URL + `/prompt/{uuid}`. Reuse how the frontend builds share links today
  (`config.run.root_path` + `window.location.origin` on the client — no new base-url plumbing).

### 4. Settings exposure — `/project/settings`

Add to the JSON payload (line ~865):

```
"promptGallery": bool(getattr(cfg.features, "prompt_gallery", False)),
```

---

## Frontend

### 5. react-client — `libs/react-client/src`

- `types/config.ts`: add `prompt_gallery?: boolean` under `features`.
- `state.ts`: `promptGalleryState = atom<IPrompt[]>(...)` (mirror `favoriteMessagesState`).
- `api.ts`: `listPrompts / savePrompt / updatePrompt / deletePrompt / sharePrompt /
getSharedPrompt / addSharedPrompt` (thin `ChainlitAPI` HTTP wrappers).
- `useChatInteract.ts` or a small `usePromptGallery` hook exposing those + optimistic state
  updates (copy the `toggleMessageFavorite` optimistic pattern).

### 6. Gallery button in the chat bar — `MessageComposer/PromptGalleryButton.tsx`

- Clone `FavoriteButton.tsx` structure (Popover + Command list + Tooltip, same classes).
- Icon: `LibraryBig` / `GalleryVerticalEnd` from `lucide-react` (gallery look).
- Guard: `if (!config?.features?.prompt_gallery) return null;`
- Popover content per prompt: **Use** (fills composer via `onSelect`), **Edit** (inline
  dialog), **Share** (calls share, copies link to clipboard), **Delete**.
- Wire into `MessageComposer/index.tsx` right next to the Settings button (place before
  `<FavoriteButton />`), reusing the existing `onFavoriteSelect`-style `setValueExtern` fill.

### 7. Bookmark under a prompt — `Messages/Message/Buttons/index.tsx`

- New `BookmarkButton.tsx` (bookmark icon) shown when `isUser && config.features.prompt_gallery`.
- Click → opens the "Save prompt" dialog prefilled with `message.output` → `savePrompt`.
- `MessageButtons` currently returns buttons only for non-user; add the user-message branch.

### 8. Save dialog — `PromptSaveDialog.tsx`

- Reuse `@/components/ui/dialog` + `input` + `button` (same primitives as the rest of the app).
- Fields: title, content (prefilled). Shared by both the bookmark button and gallery "edit".

### 9. Shared prompt route — `frontend/src/router.tsx` + `pages/`

- Route `/prompt/:id` → page that fetches `GET /project/prompt/share/{id}`, shows the prompt
  read-only with an **"Add to my gallery"** button (`addSharedPrompt`). Mirror `Share.tsx` /
  the `/share/:id` page. If unauthenticated, prompt login first (reuse existing auth guard).

### 10. i18n

Add `chat.promptGallery.*` keys (title/use/edit/share/delete/save/empty/added) to
`backend/chainlit/translations/en-US.json` (+ mirror the favorites keys layout).

---

## Minimal test app (for manual + agent_browser verification)

`backend/chainlit/sample/prompt_gallery_demo.py`:

```python
import chainlit as cl
# register an in-memory or SQLite @cl.data_layer implementing the 5 prompt methods

@cl.on_message
async def main(msg: cl.Message):
    await cl.Message(content=f"You said: {msg.content}").send()
```

`.chainlit/config.toml` for the demo: `prompt_gallery = true`, plus a data layer with
storage. Run with a **venv** (`uv sync --all-extras`; `uv run chainlit run ...`).

---

## Verification (agent_browser)

1. `uv run chainlit run backend/chainlit/sample/prompt_gallery_demo.py -h` (venv).
2. `pnpm build` frontend (or `pnpm run dev` proxy).
3. agent_browser: open app → snapshot → confirm gallery icon next to settings.
4. Send a message → click bookmark under it → save dialog → save → reopen gallery → verify listed.
5. Edit a prompt → verify persisted after reload.
6. Share → copy link → open `/prompt/:id` in a fresh/anon session → "Add to my gallery" →
   verify it lands in that user's gallery.
7. Confirm feature fully hidden when `prompt_gallery = false`.

---

## Build / test / lint checklist

- Python: `uv run scripts/lint.py --fix`, `uv run scripts/format.py`, `uv run scripts/type_check.py`, `uv run pytest`
- JS: `pnpm lint:fix`, `pnpm format`, `pnpm type-check`, `pnpm test`
- Backend unit tests for the 7 endpoints (auth gating, `is_shared` 404 behavior, add-to-gallery copy).

---

## Scope notes

- skipped: DynamoDB/LiteralAI prompt persistence — add when a user needs it (default methods
  keep them compiling). SQLAlchemy is the reference implementation.
- skipped: prompt folders/tags/search — flat list first, add when the gallery grows.
- All changes additive and behind `prompt_gallery = false`; zero behavior change by default.
