const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/barbershop';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/connect', async (req, res) => {
  try {
    // 1. Verificar primeiro o status da conexão da instância
    let stateResponse;
    try {
      stateResponse = await fetch('http://evolution:8080/instance/connectionState/BarberStudio', {
        headers: { 'apikey': 'barbershop_key_123' }
      });
    } catch (e) {
      console.warn('Erro ao checar status de conexao:', e.message);
    }
    
    if (stateResponse && stateResponse.ok) {
      const stateData = await stateResponse.json();
      console.log('[DEBUG /connect] Connection State:', stateData);
      
      // Se a conexão já estiver aberta/conectada, exibe tela de sucesso
      if (stateData.instance && stateData.instance.state === 'open') {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>WhatsApp Conectado - BarberStudio</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
              body {
                background: #090a0f;
                color: #f3f4f6;
                font-family: 'Inter', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
              }
              .card {
                background: #11131c;
                border: 1px solid rgba(16, 185, 129, 0.3);
                border-radius: 12px;
                padding: 40px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
              }
              .icon {
                font-size: 50px;
                color: #10b981;
                margin-bottom: 20px;
              }
              h1 {
                font-size: 22px;
                color: #10b981;
                margin-bottom: 10px;
              }
              p {
                font-size: 14px;
                color: #9ca3af;
                line-height: 1.5;
                margin-bottom: 25px;
              }
              .status-badge {
                display: inline-block;
                background: rgba(16, 185, 129, 0.1);
                color: #10b981;
                border: 1px solid rgba(16, 185, 129, 0.2);
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">✓</div>
              <h1>Conectado com Sucesso!</h1>
              <p>O seu WhatsApp já está pareado com a Evolution API e pronto para disparar notificações automáticas de agendamento.</p>
              <span class="status-badge">Status: Conectado (Open)</span>
            </div>
          </body>
          </html>
        `);
      }
    }

    // 2. Se não estiver conectado, busca o QR Code
    const response = await fetch('http://evolution:8080/instance/connect/BarberStudio', {
      headers: {
        'apikey': 'barbershop_key_123'
      }
    });
    
    const data = await response.json();
    console.log('[DEBUG /connect] Status da resposta:', response.status, 'Retorno (início):', JSON.stringify(data).substring(0, 150));
    
    let qrImageSrc = '';
    if (data.qrcode && data.qrcode.base64) {
      qrImageSrc = data.qrcode.base64;
    } else if (data.base64) {
      qrImageSrc = data.base64;
    } else if (data.code) {
      qrImageSrc = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(data.code)}`;
    } else if (data.qrcode && data.qrcode.code) {
      qrImageSrc = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(data.qrcode.code)}`;
    }
    
    if (response.ok && qrImageSrc) {
      // Retorna uma página HTML bonita com o QR code renderizado
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Conectar WhatsApp - BarberStudio</title>
          <meta http-equiv="refresh" content="15">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            body {
              background: #090a0f;
              color: #f3f4f6;
              font-family: 'Inter', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
            }
            .card {
              background: #11131c;
              border: 1px solid rgba(226, 184, 85, 0.15);
              border-radius: 12px;
              padding: 40px;
              max-width: 400px;
              text-align: center;
              box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }
            h1 {
              font-size: 22px;
              color: #e2b855;
              margin-bottom: 10px;
            }
            p {
              font-size: 14px;
              color: #9ca3af;
              line-height: 1.5;
              margin-bottom: 25px;
            }
            img {
              border: 4px solid white;
              border-radius: 8px;
              margin-bottom: 25px;
              max-width: 250px;
            }
            .step {
              font-size: 13px;
              text-align: left;
              color: #d1d5db;
              margin-top: 15px;
            }
            .step ol {
              padding-left: 20px;
              margin: 5px 0;
            }
            .footer {
              font-size: 11px;
              color: #6b7280;
              margin-top: 25px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Conectar WhatsApp</h1>
            <p>Escaneie o QR Code abaixo com seu WhatsApp para ativar o envio automático de mensagens de agendamento.</p>
            <img src="${qrImageSrc}" alt="QR Code WhatsApp">
            <div class="step">
              <strong>Como parear:</strong>
              <ol>
                <li>Abra o WhatsApp no seu celular.</li>
                <li>Toque em <b>Aparelhos Conectados</b> > <b>Conectar um aparelho</b>.</li>
                <li>Aponte a câmera para esta tela para ler o código.</li>
              </ol>
            </div>
            <div class="footer">Instância: BarberStudio</div>
          </div>
        </body>
        </html>
      `);
    } else {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Conectar WhatsApp - BarberStudio</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            body { background: #090a0f; color: #f3f4f6; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { background: #11131c; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; padding: 40px; max-width: 400px; text-align: center; }
            h1 { font-size: 22px; color: #ef4444; }
            p { font-size: 14px; color: #9ca3af; line-height: 1.5; margin-bottom: 20px; }
            button { background: #e2b855; color: #111; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>WhatsApp Desconectado ou Não Inicializado</h1>
            <p>O contêiner da Evolution API está rodando, mas a instância <b>BarberStudio</b> pode não ter sido criada no terminal do seu servidor ou a chave de API é inválida.</p>
            <p>Retorno: ${data.response?.message || data.message || 'Instância ainda não conectada ou sem QR Code ativo.'}</p>
            <button onclick="window.location.reload()">Recarregar Página</button>
          </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    res.status(500).send(`Erro ao conectar com Evolution API: ${error.message}`);
  }
});

// MongoDB Connection
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Conectado ao MongoDB com sucesso.');
    seedDefaultBarber();
  })
  .catch(err => {
    console.error('Erro ao conectar ao MongoDB:', err);
  });

// Schemas e Modelos
const BarberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialties: [{ type: String }],
  schedule: { type: String, required: true },
  emailOrPhone: { type: String, required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const BookingSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  serviceName: { type: String, required: true },
  barberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Barber', required: false },
  barberName: { type: String, required: true },
  dateTime: { type: String, required: true },
  contactPhone: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const LogSchema = new mongoose.Schema({
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Barber = mongoose.model('Barber', BarberSchema);
const Booking = mongoose.model('Booking', BookingSchema);
const Log = mongoose.model('Log', LogSchema);

// Helper para semear o primeiro barbeiro padrão se o banco estiver vazio
async function seedDefaultBarber() {
  try {
    const count = await Barber.countDocuments({ active: true });
    if (count === 0) {
      const defaultBarber = new Barber({
        name: 'Thiago Silva',
        specialties: ['Cabelo', 'Barba', 'Combo'],
        schedule: 'Terça a Sábado, 09h às 19h',
        emailOrPhone: 'thiago.silva@barbershop.com',
        active: true
      });
      await defaultBarber.save();
      const log = new Log({
        message: 'Sistema inicializado. Barbeiro padrão (Thiago Silva) cadastrado. Assinatura base ativada (R$ 50,00).'
      });
      await log.save();
      console.log('Barbeiro padrão semeado com sucesso.');
    }
  } catch (error) {
    console.error('Erro ao semear barbeiro padrão:', error);
  }
}

// Helper para calcular faturamento
function calculateSubscriptionFee(activeBarbersCount) {
  if (activeBarbersCount <= 0) return 50.00; // Plano base inclui pelo menos 1 barbeiro
  return 50.00 + (activeBarbersCount - 1) * 25.00;
}

// Endpoints da API

// 1. Obter status da assinatura
app.get('/api/billing', async (req, res) => {
  try {
    const activeBarbersCount = await Barber.countDocuments({ active: true });
    const fee = calculateSubscriptionFee(activeBarbersCount);
    res.json({
      activeBarbersCount,
      monthlyFee: fee,
      baseFee: 50.00,
      additionalBarberFee: 25.00,
      formula: 'R$ 50 + [(N - 1) * R$ 25]'
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar dados de faturamento' });
  }
});

// 2. Barbeiros
app.get('/api/barbers', async (req, res) => {
  try {
    const barbers = await Barber.find({ active: true }).sort({ createdAt: 1 });
    res.json(barbers);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter barbeiros' });
  }
});

app.post('/api/barbers', async (req, res) => {
  const { name, specialties, schedule, emailOrPhone } = req.body;
  
  if (!name || !schedule || !emailOrPhone) {
    return res.status(400).json({ error: 'Os campos Nome, Horário e E-mail/Telefone são obrigatórios.' });
  }

  try {
    const activeCountBefore = await Barber.countDocuments({ active: true });
    
    const newBarber = new Barber({
      name,
      specialties: specialties || [],
      schedule,
      emailOrPhone,
      active: true
    });
    
    await newBarber.save();
    
    const activeCountAfter = activeCountBefore + 1;
    const oldFee = calculateSubscriptionFee(activeCountBefore);
    const newFee = calculateSubscriptionFee(activeCountAfter);
    
    const logMsg = `Barbeiro cadastrado: ${name}. Faturamento mensal reajustado de R$ ${oldFee.toFixed(2)} para R$ ${newFee.toFixed(2)}.`;
    const log = new Log({ message: logMsg });
    await log.save();
    
    res.status(201).json({
      barber: newBarber,
      billingUpdate: {
        previousCount: activeCountBefore,
        newCount: activeCountAfter,
        previousFee: oldFee,
        newFee: newFee
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar barbeiro' });
  }
});

app.delete('/api/barbers/:id', async (req, res) => {
  try {
    const barberId = req.params.id;
    const barber = await Barber.findById(barberId);
    
    if (!barber || !barber.active) {
      return res.status(404).json({ error: 'Barbeiro não encontrado ou já inativo.' });
    }
    
    // Desativar ao invés de deletar fisicamente para manter histórico
    barber.active = false;
    await barber.save();
    
    const activeCountBefore = await Barber.countDocuments({ active: true }) + 1;
    const activeCountAfter = activeCountBefore - 1;
    const oldFee = calculateSubscriptionFee(activeCountBefore);
    const newFee = calculateSubscriptionFee(activeCountAfter);
    
    const logMsg = `Barbeiro removido: ${barber.name}. Faturamento mensal reajustado de R$ ${oldFee.toFixed(2)} para R$ ${newFee.toFixed(2)} a partir do próximo ciclo de cobrança.`;
    const log = new Log({ message: logMsg });
    await log.save();
    
    res.json({
      message: 'Barbeiro desativado com sucesso.',
      billingUpdate: {
        previousCount: activeCountBefore,
        newCount: activeCountAfter,
        previousFee: oldFee,
        newFee: newFee
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover barbeiro' });
  }
});

// 3. Agendamentos
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter agendamentos' });
  }
});

app.post('/api/bookings', async (req, res) => {
  const { clientName, serviceName, barberId, barberName, dateTime, contactPhone } = req.body;
  
  if (!clientName || !serviceName || !barberName || !dateTime || !contactPhone) {
    return res.status(400).json({ error: 'Faltam dados obrigatórios para criar o agendamento.' });
  }

  try {
    const newBooking = new Booking({
      clientName,
      serviceName,
      barberId: barberId || null,
      barberName,
      dateTime,
      contactPhone
    });
    
    await newBooking.save();
    
    const logMsg = `Novo agendamento criado: Cliente ${clientName} com Barbeiro ${barberName} em ${dateTime}.`;
    const log = new Log({ message: logMsg });
    await log.save();
    
    // Disparar Webhook para o n8n em segundo plano (comunicando internamente no docker)
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://n8n:5678/webhook/booking';
    fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBooking)
    })
    .then(webRes => {
      console.log(`Webhook n8n respondido com status ${webRes.status}`);
    })
    .catch(webErr => {
      console.warn('Alerta: n8n offline ou webhook não ativo:', webErr.message);
    });
    
    res.status(201).json(newBooking);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

// 4. Logs de Auditoria
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 }).limit(30);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter logs' });
  }
});

// 5. Configurações Públicas (como Client ID do Google)
app.get('/api/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || ''
  });
});

// Inicialização
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
