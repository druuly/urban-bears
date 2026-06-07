# Urban BEARS

**Biomedical Engineering and Research Student Network** — public website.

Student-led nonprofit focused on increasing STEM participation in underserved communities through free, accessible chapters and scientific literacy resources.

Built with vanilla HTML, CSS, and JavaScript — no frameworks, no build step.

---

## File Tree

```
urban-bears/
│
├── index.html                    # Home page (hero, articles, resources, mission)
│
├── pages/                        # Additional pages added as the site grows
│   └── (e.g. research.html, volunteer.html, journal.html)
│
├── css/
│   ├── base.css                  # ★ Load first on every page
│   │                             #   Reset, CSS variables, shared components:
│   │                             #   nav, footer, all buttons, card-box,
│   │                             #   placeholder utility, section divider
│   │
│   ├── animations.css            # Load second on every page
│   │                             #   @keyframes (slideDown, fadeSlideUp,
│   │                             #   fadeIn, starPulse) + .reveal / .stagger
│   │                             #   scroll-reveal classes driven by main.js
│   │
│   └── index.css                 # Home page–specific styles
│                                 #   Hero, Featured Articles, Resources &
│                                 #   Events, Mission Statement, and their
│                                 #   responsive breakpoints
│
├── js/
│   └── main.js                   # Shared JS for every page
│                                 #   Mobile nav toggle + scroll-reveal
│                                 #   IntersectionObserver
│
└── assets/
    ├── images/
    │   ├── hero/                 # Hero section image(s)
    │   ├── articles/             # Article thumbnail images
    │   └── logo/                 # Logo variants (PNG, SVG)
    └── icons/                    # SVG icons, favicon
```

---

## CSS Architecture

Every page links three stylesheets **in this order**:

```html
<link rel="stylesheet" href="css/base.css" />
<link rel="stylesheet" href="css/animations.css" />
<link rel="stylesheet" href="css/[pagename].css" />
```

| File | Purpose | Required on every page? |
|------|---------|------------------------|
| `base.css` | Variables, reset, nav, footer, buttons, cards | Yes |
| `animations.css` | Keyframes + reveal classes | Yes |
| `index.css` | Home page layout | Only on `index.html` |
| `[page].css` | Future page-specific styles | Per page |

**Rule of thumb:** if a style appears on more than one page, it belongs in `base.css`. Page-specific layout stays in its own file.

---

## Adding a New Page

1. Create `pages/[name].html` — copy the `<head>` block from `index.html`.
2. Swap `css/index.css` for `css/[name].css` in the `<link>` tags.
3. Create `css/[name].css` for any layout unique to that page.
4. Update the nav links in all existing HTML files to point to the new page.

---

## Replacing Placeholder Images

Placeholder `.ph` elements are marked with HTML comments. Swap them for real `<img>` tags once assets are ready:

```html
<!-- Before -->
<div class="ph ph-hero"> … </div>

<!-- After -->
<img src="assets/images/hero/hero-photo.jpg" alt="Descriptive alt text" />
```

Delete unused `.ph-*` CSS rules from `base.css` once all placeholders are replaced.
