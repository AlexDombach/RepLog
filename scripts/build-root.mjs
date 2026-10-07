/**
 * Build for a host that serves from the domain root (Netlify, Vercel, a custom
 * domain) instead of a GitHub Pages subpath. Cross-platform env var setting —
 * `BASE_PATH=/ npm run build` doesn't work in PowerShell.
 */
import { spawnSync } from 'node:child_process'

const r = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, BASE_PATH: '/' },
})
process.exit(r.status ?? 1)
