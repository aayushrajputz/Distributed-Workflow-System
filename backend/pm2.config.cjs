module.exports = {
  apps: [
    {
      name: 'workflow-backend',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '512M',
      watch: false,
      time: true,
      merge_logs: true,
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log'
    }
  ]
}


