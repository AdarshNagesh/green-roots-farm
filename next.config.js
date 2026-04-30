const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = withSentryConfig(nextConfig, {
  org:     'adarshinifarm',
  project: 'javascript-nextjs',
  silent:  true,              // ← change to false so we can see logs
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
})
