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
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://barbershop-n8n:5678/webhook/booking';
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
