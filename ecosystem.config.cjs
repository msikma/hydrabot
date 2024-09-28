module.exports = {
  apps : [{
    name: 'HydraBot',
    script: './bin/hydrabot.mjs',
    instances: '1',
    autorestart: true,
    watch: false,
    max_memory_restart: '4G'
  }]
}
