bridge/outbox/ — runtime state directory
=========================================

This directory holds the local bridge's runtime state. It is created
automatically by server.js on first start, so it does NOT need to be
shipped with the plugin package.

Files (created at runtime, never distributed):
  latest.json   the most recent push payload (markdown or uispec spec)
  state.json    sequence bookkeeping: { seq, appliedSeq, ... }
                - seq        : last issued push id
                - appliedSeq : last push the Figma plugin acknowledged via /ack
                               (used to prevent auto-replay on plugin reopen)

Why you will not find them in the ZIP:
  - latest.json may contain the full content you pushed (private by design;
    it never leaves localhost:9876, and it must not travel with the package).
  - state.json is machine-local; shipping it would make a fresh install
    believe old pushes were already applied.

Note: an old doc placeholder in earlier drafts sat in this folder. The
runtime files above are the only real contents going forward.
