# Writing Docs

- Write each doc for the question its reader brings:
  - extension-architecture.md and extension-origin-storage.md are explanations. They answer how the extension works, such as what each execution context is responsible for, how data and requests flow between contexts, and why the split solves its problem, so a reader can follow them without the code open. They do not inventory functions or file lists, which the code already shows and which churn with every refactor.
  - chrome-store-submission.md is a guide. It answers what to submit to the Chrome Web Store and what to check before a release.
- Write docs as Markdown, with figures as SVG files in `images/` embedded by relative links, so GitHub renders them. Make each figure show one point, state that point in the alt text, and give the SVG `width` and `height` equal to its `viewBox`.
- When a doc has a figure, its text covers only what the figure can't show, such as why a part sits where it does or what follows from that.
- Use Title Case for headings. In explanations, phrase each section heading as the action the section explains, such as “Bridge the Watch Page Through a Hidden Frame”, and keep plain labels for lists such as “References”.
