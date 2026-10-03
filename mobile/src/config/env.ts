/**
 * The only backend that exists is the production Railway deployment —
 * there's no separate staging environment yet (see
 * claude/ci-cd-setup.md). Hardcoded for now; once EAS build profiles or a
 * local-dev proxy are set up (a later phase), this becomes an
 * environment-specific value instead of a constant.
 */
export const API_BASE_URL = 'https://longevityapp-production.up.railway.app';
