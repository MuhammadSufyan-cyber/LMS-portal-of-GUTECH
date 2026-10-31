import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const charsetFirst = {
  name: 'charset-first',
  transformIndexHtml: {
    order: 'post' as const,
    handler(html: string) {
      const charset = html.match(/<meta\s+charset=["'][^"']+["']\s*\/?>/i)?.[0];
      if (!charset) return html;
      const withoutCharset = html.replace(charset, '');
      return withoutCharset.replace(/<head([^>]*)>/i, `<head$1>\n    ${charset}`);
    },
  },
};

export default defineConfig({ plugins: [react(), charsetFirst], server: { port: 5173 } });
