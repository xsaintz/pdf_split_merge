# Graph Report - pdf merge dan split  (2026-09-21)

## Corpus Check
- Corpus is ~29,195 words - fits in a single context window. You may not need a graph.

## Summary
- 358 nodes · 962 edges · 18 communities (16 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.84)
- Token cost: 6,120 input · 4,380 output

## Community Hubs (Navigation)
- File Loading and Tools
- Navigation and Routing
- Motion and PDF Preview
- Worker API and Images
- Build Dependencies
- Icon Build Pipeline
- PDF Operations Engine
- PDF Compression Engine
- Application Shell and Features
- Markdown Conversion
- GitHub Pages Deployment
- PWA 512 Icon
- Apple Touch Icon
- PWA 192 Icon
- Social Preview Card
- Maskable PWA Icon
- Application Entrypoint
- PWA Gradient Asset

## God Nodes (most connected - your core abstractions)
1. `renderImages()` - 36 edges
2. `renderOrganize()` - 32 edges
3. `renderMerge()` - 31 edges
4. `renderSplit()` - 29 edges
5. `paintIcons()` - 24 edges
6. `paintStatus()` - 24 edges
7. `html()` - 23 edges
8. `setVisible()` - 23 edges
9. `renderCompress()` - 23 edges
10. `createFileLoader()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Client-Side Privacy Message` --semantically_similar_to--> `Client-Side PDF Processing`  [INFERRED] [semantically similar]
  index.html → README.md
- `Home Page SEO and Social Metadata` --semantically_similar_to--> `Route-Specific SEO Pages`  [INFERRED] [semantically similar]
  index.html → README.md
- `Skip Link and Route Announcer` --semantically_similar_to--> `Keyboard and Screen Reader Accessibility`  [INFERRED] [semantically similar]
  index.html → README.md
- `chunk()` --calls--> `crc32()`  [EXTRACTED]
  scripts/make-icons.mjs → src/lib/zip.js
- `route()` --indirect_call--> `warmUp()`  [INFERRED]
  src/main.js → src/lib/pdf.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Client-Side PDF Toolkit Product** — readme_pdf_toolkit, readme_client_side_processing, index_pdf_toolkit_html_shell, index_client_side_privacy_message [INFERRED 0.95]
- **Three PDF Compression Strategies** — readme_pdf_compression, readme_light_compression, readme_medium_compression, readme_strong_compression, readme_smaller_output_guard [EXTRACTED 1.00]
- **GitHub Pages Build and Delivery Pipeline** — readme_github_pages_deployment, _github_workflows_deploy_main_branch_trigger, _github_workflows_deploy_build_job, _github_workflows_deploy_dist_artifact, _github_workflows_deploy_deploy_job [EXTRACTED 1.00]
- **Visual Icon Composition** — public_pwa_512_blue_cyan_gradient_background, public_pwa_512_left_rounded_panel, public_pwa_512_right_angular_panel, public_pwa_512_central_separation_gap, public_pwa_512_app_icon [EXTRACTED 1.00]
- **Maskable Application Visual Identity** — public_pwa_maskable_512_maskable_pwa_app_icon, public_pwa_maskable_512_abstract_document_operation_glyph, public_pwa_maskable_512_blue_cyan_gradient_background, public_pwa_maskable_512_high_contrast_minimal_branding [INFERRED 0.85]

## Communities (18 total, 2 thin omitted)

### Community 0 - "File Loading and Tools"
Cohesion: 0.14
Nodes (55): brandIcon(), shapes, createFileLoader(), load(), reset(), captureRects(), subNavMarkup(), closeDocument() (+47 more)

### Community 1 - "Navigation and Routing"
Cohesion: 0.09
Nodes (31): base, pathOf(), src_lib_nav_routebyslug, slugOf(), src_lib_nav_tools, revealOnScroll(), legacyHashes, routeBySlug() (+23 more)

### Community 2 - "Motion and PDF Preview"
Cohesion: 0.13
Nodes (31): pdfjs-dist, collapseOut(), enterIn(), fadeIn(), fadeOut(), play(), playFlip(), pop() (+23 more)

### Community 3 - "Worker API and Images"
Cohesion: 0.12
Nodes (31): decodeImage(), imageKind(), reencodeAsJpeg(), abortImages(), abortMerge(), addImage(), addToMerge(), arrangePages() (+23 more)

### Community 4 - "Build Dependencies"
Cohesion: 0.07
Nodes (29): dependencies, lucide, marked, pdf-lib, pdfjs-dist, devDependencies, tailwindcss, @tailwindcss/vite (+21 more)

### Community 5 - "Icon Build Pipeline"
Cohesion: 0.10
Nodes (26): ref_node_child_process, ref_node_fs, ref_node_os, ref_node_path, ref_node_url, ref_node_zlib, assets, chunk() (+18 more)

### Community 6 - "PDF Operations Engine"
Cohesion: 0.12
Nodes (16): arrange(), buildFromPages(), compress(), documentOf(), documents, extract(), extractZip(), imageJobs (+8 more)

### Community 7 - "PDF Compression Engine"
Cohesion: 0.16
Nodes (22): ref_node_assert, pdf-lib, canvasToJpeg(), componentsOf(), compressPdf(), describeImage(), encodeScaled(), filtersOf() (+14 more)

### Community 8 - "Application Shell and Features"
Cohesion: 0.11
Nodes (23): Skip Link and Route Announcer, Client-Side Privacy Message, Legacy GitHub Pages Redirect, PDF Toolkit HTML Shell, Application Preloader, Responsive Tool Navigation, Home Page SEO and Social Metadata, PDF Toolkit WebApplication Structured Data (+15 more)

### Community 9 - "Markdown Conversion"
Cohesion: 0.18
Nodes (15): marked, BANNED_TAGS, documentCss, guessTitle(), isBannedTag(), isSafeAttribute(), printMarkdown(), renderMarkdown() (+7 more)

### Community 10 - "GitHub Pages Deployment"
Cohesion: 0.25
Nodes (9): Build Job, Deploy Job, Deploy to GitHub Pages Workflow, Built dist Artifact, Main Branch Push Trigger, Manual Workflow Dispatch, Node.js 22 Build Environment, GitHub Pages Deployment Permissions (+1 more)

### Community 11 - "PWA 512 Icon"
Cohesion: 0.33
Nodes (6): PDF Utility App Icon, Central Separation Gap, Document Page Pair, Left Rounded White Panel, PDF Split and Merge Symbolism, Right Angular White Panel

### Community 12 - "Apple Touch Icon"
Cohesion: 0.50
Nodes (5): Apple Touch App Icon, Blue-to-Cyan Gradient Background, Minimal Document Tool Branding, PDF Split and Merge, Separated White Document Panels

### Community 13 - "PWA 192 Icon"
Cohesion: 0.70
Nodes (5): Blue-to-Cyan Gradient Background, Left White Rounded Panel, PDF Utility PWA App Icon, Right White Tapered Panel, Split Document Metaphor

### Community 14 - "Social Preview Card"
Cohesion: 0.67
Nodes (4): Blue-to-Cyan Gradient Identity, PDF Merge and Split Metaphor, Minimalist Social Preview Card, White Application Mark

### Community 15 - "Maskable PWA Icon"
Cohesion: 0.67
Nodes (4): Abstract Document Operation Glyph, Blue-to-Cyan Gradient Background, High-Contrast Minimal Branding, Maskable PWA App Icon

## Knowledge Gaps
- **88 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+83 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 110 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pdf-lib` connect `PDF Compression Engine` to `Build Dependencies`, `PDF Operations Engine`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Why does `lucide` connect `Build Dependencies` to `File Loading and Tools`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **Why does `pdfjs-dist` connect `Motion and PDF Preview` to `Build Dependencies`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `renderImages()` (e.g. with `keepImages()` and `forget()`) actually correct?**
  _`renderImages()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `renderOrganize()` (e.g. with `clearDocument()` and `undo()`) actually correct?**
  _`renderOrganize()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _88 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `File Loading and Tools` be split into smaller, more focused modules?**
  _Cohesion score 0.13942307692307693 - nodes in this community are weakly interconnected._