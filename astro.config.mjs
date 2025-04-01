// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

export default defineConfig({
  site: 'https://tarjuman.netlify.app',
  output: 'server',
  adapter: netlify(),
});