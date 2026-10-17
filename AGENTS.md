<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules
- Member "remember me" uses an httpOnly device cookie holding the refresh token (src/lib/remember.functions.ts), refreshed on every token rotation — why: app wrappers/WebViews can wipe localStorage, and httpOnly keeps the token out of page scripts.
- "Open batches" must always load pwthor.live as a top-level page (Chrome hand-off from Android WebViews/frames, new tab from frames) — why: that site refuses to be shown inside another page.
- Keep device destination selection in a browser-safe pure helper with regression tests — why: both study links must use the same frame/WebView handling.
