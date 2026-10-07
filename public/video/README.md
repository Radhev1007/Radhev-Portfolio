# Hero background video

Drop the files here:

| File | Required | Notes |
| --- | --- | --- |
| `hero.mp4` | yes | H.264 / AAC-free (it plays muted). 1920×1080 is plenty. |
| `hero.webm` | optional | VP9. Smaller than MP4; the browser picks it first when supported. |
| `hero-poster.jpg` | recommended | First frame. Shown before playback and to anyone using reduced motion. |

Keep it short and small: a 6–12 second seamless loop, under ~5 MB.
Long or heavy files cost real money on mobile data, and the hero is the
first thing anyone downloads.

Nothing here is on the critical path (`preload="none"`), and the component
degrades to the poster — then to the page backdrop — if the files are absent.
