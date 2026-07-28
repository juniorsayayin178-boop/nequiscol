module.exports = {
  webhookUrl: process.env.DISCORD_WEBHOOK_URL,
  enabled: !!process.env.DISCORD_WEBHOOK_URL,
  timeout: 10000,
  retryAttempts: 3,
  colors: {
    info: 0x2d6aff,
    success: 0x16a34a,
    error: 0xdc2626,
    warning: 0xf59e0b,
    security: 0x8b5cf6,
    nequi: 0x8b5cf6,
  },
  footer: {
    text: '🔐 Sistema Nequi • ',
    icon_url: 'https://i.imgur.com/3kH5x6q.png'
  }
};