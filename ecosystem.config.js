/**
 * PM2 Ecosystem Configuration for AeroLMS
 *
 * Production deployment configuration for Windows Server
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart ecosystem.config.js
 *   pm2 stop aerolms
 *   pm2 logs aerolms
 */

module.exports = {
  apps: [
    {
      // Application name
      name: 'aerolms',

      // Next.js start script
      script: 'node_modules/next/dist/bin/next',
      args: 'start',

      // Project directory (update to match your deployment path)
      cwd: 'C:/inetpub/wwwroot/AeroLMS',

      // Execution mode
      instances: 1,
      exec_mode: 'fork', // Fork mode for single instance (use 'cluster' with instances > 1)

      // Environment variables (production)
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },

      // Load additional env vars from file
      env_file: '.env.production',

      // Logging configuration
      error_file: 'C:/inetpub/logs/AeroLMS/pm2-error.log',
      out_file: 'C:/inetpub/logs/AeroLMS/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Auto-restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s', // App must stay up for 10s to be considered started

      // Restart delay
      restart_delay: 4000, // Wait 4s before restarting after crash

      // Watch for file changes (disable in production)
      watch: false,

      // Memory management
      max_memory_restart: '1G', // Restart if memory usage exceeds 1GB

      // Graceful shutdown
      kill_timeout: 5000, // Wait 5s for graceful shutdown
      listen_timeout: 3000, // Wait 3s for app to listen

      // Windows-specific
      windowsHide: false // Show console window (for debugging)

      // Health check (optional - requires endpoint)
      // health_check_url: 'http://localhost:3000/api/health',

      // Cron restart (optional - restart daily at 3 AM)
      // cron_restart: '0 3 * * *',
    }
  ],

  /**
   * PM2 deployment configuration (optional)
   * For automated deployments via PM2
   */
  deploy: {
    production: {
      // Windows server user
      user: 'Administrator',

      // Server hostname/IP
      host: 'YOUR_SERVER_IP',

      // Git repository
      ref: 'origin/master',
      repo: 'https://github.com/inspiritenergy/AeroLMS.git',

      // Deployment path on server
      path: 'C:/inetpub/wwwroot',

      // Post-deployment commands
      'post-deploy':
        'npm install && npx next build && pm2 reload ecosystem.config.js',

      // Environment variables
      env: {
        NODE_ENV: 'production',
        SKIP_POSTINSTALL: 'true'
      }
    }
  }
};
