# IncidentData LiveStack Visual Library

This reusable set accompanies the two-part blog and parallel presentation. Reuse the same named assets in the future workshop documentation to make the concepts familiar across formats.

## Visual style

Use warm ivory backgrounds, charcoal text, terracotta emphasis, teal diagrams and occasional ochre accents. Arial is the chosen typeface. The illustrations are static Redwood-inspired, Powtoon-like editorial cartoons generated with the built-in image tool. They are not official Oracle or Powtoon artwork and do not depict actual events or people.

The three illustrations introduce the platform, source review and technology. The ten diagrams explain the learner journey, Data Room pipeline, shared platform, vector retrieval, spatial context, relationships, JSON Relational Duality, Select AI paths, agent workflow and DDS lab. These diagrams are conceptual explainers. Their labels distinguish capability concepts from current application execution paths.

## Reuse

- Use the PNG assets for blog pages, learner guides and presenter material.
- Preserve the aspect ratio and captions. Avoid cropping away technical labels.
- Use `manifest.json` for the palette, filenames, descriptions and blog placements.
- Use `image-prompts.json` for the original illustration prompt set and generation method.
- Edit slide text, diagram nodes and connectors in the final PPTX; the diagrams remain native PowerPoint objects.
- `docs/visuals/build-presentation.mjs` retains the presentation authoring source. It uses the Codex bundled JavaScript artifact runtime and contains this workspace's paths; adjust those paths when moving the project.

The self-contained HTML blog embeds the images and can be opened without its asset folder. The Markdown edition uses absolute workspace image paths for the Codex preview. The supplied ZIP includes a portable Markdown edition with relative asset links.

IncidentData LiveStack is the public identity used throughout this visual pack.
