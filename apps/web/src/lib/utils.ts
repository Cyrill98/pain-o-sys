import { createCn } from 'cn/config';

/**
 * Class merger that knows the Tenang theme (index.css). Without this, `cn` treats unknown
 * names like `text-body` as a text *colour* and silently drops the real colour class
 * (e.g. `text-destructive-foreground`) when both appear together.
 *
 * Always import `cn` from here, never from the `cn` package directly.
 */
export const cn = createCn({
  extend: {
    theme: {
      text: ['display-lg', 'display-md', 'title', 'body', 'body-sm', 'label', 'time', 'caption'],
      shadow: ['soft'],
      radius: ['pill'],
      spacing: ['tap'],
    },
  },
});
