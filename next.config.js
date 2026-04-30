const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,         // suppress CLI output
  org:    'adarshinifarm',   // your Sentry org slug
  project:'javascript-nextjs', // your Sentry project slug
}, {
  widenClientFileUpload: true,
  hideSourceMaps: true, // don't expose source maps to browser
  disableLogger: true,
})
