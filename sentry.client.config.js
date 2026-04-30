import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,      // 20% of transactions — free tier friendly
  replaysSessionSampleRate: 0, // disable replays on free tier
  environment: process.env.NODE_ENV,
  
})
