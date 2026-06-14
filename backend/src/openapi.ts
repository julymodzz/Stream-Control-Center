import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config/env';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Stream Control Center API',
      version: '2.0.0',
      description: 'Production-grade REST API für Streaming-Infrastruktur-Monitoring und -Steuerung',
    },
    servers: [{ url: `http://${config.host}:${config.port}/api/v1` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth' },
      { name: 'Dashboard' },
      { name: 'Control' },
      { name: 'Logs' },
      { name: 'Alerts' },
      { name: 'Audit' },
      { name: 'Backup' },
    ],
  },
  apis: ['./src/routes/v1/*.ts'],
});
