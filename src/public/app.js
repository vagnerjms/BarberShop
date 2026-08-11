// ==========================================================================
// ESTADO GLOBAL DA CONVERSA E DADOS DA API
// ==========================================================================
let currentState = 'CLIENT_NAME';
let activeChannel = 'client';
let barbers = [];
let bookings = [];
let billingData = {};

// Formulários temporários
let bookingForm = {
  clientName: '',
  serviceName: '',
  barberId: '',
  barberName: '',
  dateTime: '',
  contactPhone: ''
};

let barberForm = {
  name: '',
  specialties: '',
  schedule: '',
  emailOrPhone: ''
};

// Elementos do DOM
const chatMessages = document.getElementById('chat-messages');
const chatQuickOptions = document.getElementById('chat-quick-options');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const resetChatBtn = document.getElementById('reset-chat-btn');
const currentTimeEl = document.getElementById('current-time');

// Elementos do Seletor de Canais
const channelClientBtn = document.getElementById('channel-client-btn');
const channelOwnerBtn = document.getElementById('channel-owner-btn');
const chatBotTitle = document.getElementById('chat-bot-title');

// Elementos do Dashboard
const billingTotalEl = document.getElementById('billing-total');
const billingAdditionalCountEl = document.getElementById('billing-additional-count');
const billingAdditionalFeeEl = document.getElementById('billing-additional-fee');
const barbersCountEl = document.getElementById('barbers-count');
const barbersListEl = document.getElementById('barbers-list');
const bookingsCountEl = document.getElementById('bookings-count');
const bookingsListEl = document.getElementById('bookings-list');
const logsListEl = document.getElementById('logs-list');

// ==========================================================================
// GOOGLE AUTHENTICATION & LOGIN LOGIC (ADMIN PORTAL ONLY)
// ==========================================================================
function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Erro ao decodificar token JWT:", e);
    return null;
  }
}

async function initGoogleAuth() {
  const loginScreen = document.getElementById('admin-login-screen');
  if (!loginScreen) return; // Não inicializa se não for a página admin
  
  // Buscar configuração do backend (Client ID)
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    
    if (config.googleClientId) {
      // Carregar e renderizar o botão do Google
      google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: handleGoogleLoginResponse
      });
      google.accounts.id.renderButton(
        document.getElementById("g-signin-button"),
        { theme: "filled_blue", size: "large", width: 320, shape: "pill" }
      );
    } else {
      // Se não houver Client ID configurado, avisa amigavelmente e sugere a Demo
      const btnContainer = document.getElementById("g-signin-button");
      if (btnContainer) {
        btnContainer.innerHTML = '<div style="color:var(--text-muted); font-size:12px; margin-bottom:10px;"><i data-lucide="alert-triangle" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Login do Google não configurado. Use a Conta de Demonstração abaixo para testar.</div>';
        lucide.createIcons();
      }
    }
  } catch (error) {
    console.error('Erro ao inicializar autenticação do Google:', error);
  }
}

function handleGoogleLoginResponse(response) {
  const userData = decodeJwt(response.credential);
  if (userData) {
    const sessionUser = {
      name: userData.name,
      email: userData.email,
      picture: userData.picture || 'https://api.dicebear.com/7.x/bottts/svg?seed=Admin'
    };
    saveSession(sessionUser);
  }
}

function handleDemoLogin() {
  const demoUser = {
    name: 'Gestor BarberStudio',
    email: 'contato@barberstudio.com.br',
    picture: 'https://api.dicebear.com/7.x/bottts/svg?seed=Admin' // Avatar padrão demo
  };
  saveSession(demoUser);
}

function saveSession(user) {
  localStorage.setItem('barber_admin_session', JSON.stringify(user));
  applySession(user);
}

function applySession(user) {
  const loginScreen = document.getElementById('admin-login-screen');
  const appLayout = document.getElementById('admin-app-layout');
  const userNameEl = document.getElementById('user-name');
  const userEmailEl = document.getElementById('user-email');
  const userAvatarEl = document.getElementById('user-avatar');
  
  if (loginScreen) loginScreen.style.display = 'none';
  if (appLayout) appLayout.style.display = 'flex';
  
  if (userNameEl) userNameEl.textContent = user.name;
  if (userEmailEl) userEmailEl.textContent = user.email;
  if (userAvatarEl) userAvatarEl.src = user.picture;
  
  // Recarregar os dados do painel agora que está logado
  refreshDashboard();
}

function checkSession() {
  const sessionData = localStorage.getItem('barber_admin_session');
  if (sessionData) {
    const user = JSON.parse(sessionData);
    applySession(user);
    return true;
  }
  return false;
}

function logoutAdmin() {
  localStorage.removeItem('barber_admin_session');
  window.location.reload();
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  // Exibir hora atual do chat
  const now = new Date();
  currentTimeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Registrar escutadores de eventos
  chatForm.addEventListener('submit', handleFormSubmit);
  resetChatBtn.addEventListener('click', resetChat);
  
  if (channelClientBtn) channelClientBtn.addEventListener('click', () => switchChannel('client'));
  if (channelOwnerBtn) channelOwnerBtn.addEventListener('click', () => switchChannel('owner'));
  
  // Detectar qual página está carregada
  const isDashboardPresent = !!document.getElementById('barbers-list');
  
  if (isDashboardPresent) {
    // Configurações exclusivas da página de Administração
    const demoLoginBtn = document.getElementById('demo-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (demoLoginBtn) demoLoginBtn.addEventListener('click', handleDemoLogin);
    if (logoutBtn) logoutBtn.addEventListener('click', logoutAdmin);
    
    // Iniciar Google Auth e verificar sessão
    initGoogleAuth();
    const isLoggedIn = checkSession();
    
    if (isLoggedIn) {
      switchChannel('owner');
    }
  } else {
    // Para o cliente final, apenas buscar barbeiros para as opções do chatbot
    fetchBarbers();
    switchChannel('client');
  }
});

// ==========================================================================
// FUNÇÕES DE COMUNICAÇÃO COM A API (FETCH)
// ==========================================================================
async function refreshDashboard() {
  const isDashboardPresent = !!document.getElementById('barbers-list');
  if (!isDashboardPresent) return;
  
  await Promise.all([
    fetchBilling(),
    fetchBarbers(),
    fetchBookings(),
    fetchLogs()
  ]);
  // Atualiza ícones Lucide inseridos dinamicamente no Dashboard
  lucide.createIcons();
}

async function fetchBilling() {
  try {
    const res = await fetch('/api/billing');
    const data = await res.json();
    billingData = data;
    
    // Atualizar UI se os elementos existirem
    if (billingTotalEl) billingTotalEl.textContent = data.monthlyFee.toFixed(2).replace('.', ',');
    const addCount = data.activeBarbersCount > 1 ? data.activeBarbersCount - 1 : 0;
    if (billingAdditionalCountEl) billingAdditionalCountEl.textContent = addCount;
    if (billingAdditionalFeeEl) billingAdditionalFeeEl.textContent = (addCount * data.additionalBarberFee).toFixed(2).replace('.', ',');
  } catch (error) {
    console.error('Erro ao buscar faturamento:', error);
  }
}

async function fetchBarbers() {
  try {
    const res = await fetch('/api/barbers');
    barbers = await res.json();
    
    // Atualizar UI se os elementos existirem
    if (barbersCountEl) barbersCountEl.textContent = barbers.length;
    
    if (barbersListEl) {
      if (barbers.length === 0) {
        barbersListEl.innerHTML = '<div class="empty-state">Nenhum barbeiro ativo cadastrado.</div>';
        return;
      }
      
      barbersListEl.innerHTML = '';
      barbers.forEach((barber, index) => {
        const isBase = index === 0; // O primeiro barbeiro é o incluído no plano base
        const card = document.createElement('div');
        card.className = 'barber-card';
        card.innerHTML = `
          <div class="barber-info">
            <div class="barber-name-row">
              <span class="barber-name">${barber.name}</span>
              ${isBase ? '<span class="barber-tag-base">Incluso no Plano Base</span>' : ''}
            </div>
            <span class="barber-specialties">${barber.specialties.join(', ') || 'Corte Geral'}</span>
            <div class="barber-schedule-meta">
              <i data-lucide="clock"></i>
              <span>${barber.schedule}</span>
            </div>
            <div class="barber-schedule-meta">
              <i data-lucide="mail"></i>
              <span>${barber.emailOrPhone}</span>
            </div>
          </div>
          <button class="barber-remove-btn" onclick="removeBarber('${barber._id}')" title="Remover Barbeiro">
            <i data-lucide="trash-2"></i>
          </button>
        `;
        barbersListEl.appendChild(card);
      });
    }
  } catch (error) {
    console.error('Erro ao buscar barbeiros:', error);
    if (barbersListEl) {
      barbersListEl.innerHTML = '<div class="empty-state text-danger">Erro ao carregar equipe.</div>';
    }
  }
}

async function fetchBookings() {
  try {
    const res = await fetch('/api/bookings');
    bookings = await res.json();
    
    if (bookingsCountEl) bookingsCountEl.textContent = bookings.leng      if (bookings.length === 0) {
        bookingsListEl.innerHTML = `
          <tr>
            <td colspan="6" class="empty-state">Nenhum agendamento realizado hoje.</td>
          </tr>
        `;
        return;
      }
      
      bookingsListEl.innerHTML = '';
      bookings.forEach(booking => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${booking.clientName}</strong></td>
          <td><span class="barber-tag-base">${booking.serviceName}</span></td>
          <td>${booking.barberName}</td>
          <td><strong>${booking.dateTime}</strong></td>
          <td>${booking.contactPhone}</td>
          <td>
            <button class="action-btn delete-btn" onclick="cancelBooking('${booking._id}')" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
              Cancelar
            </button>
          </td>
        `;
        bookingsListEl.appendChild(row);
      });
    }
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error);
    if (bookingsListEl) {
      bookingsListEl.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state text-danger">Erro ao carregar agendamentos.</td>
        </tr>
      `;
    }
  }
}

async function fetchLogs() {
  try {
    const res = await fetch('/api/logs');
    const logs = await res.json();
    
    if (logsListEl) {
      if (logs.length === 0) {
        logsListEl.innerHTML = '<li class="empty-state">Nenhum registro no log.</li>';
        return;
      }
      
      logsListEl.innerHTML = '';
      logs.forEach(log => {
        const li = document.createElement('li');
        
        if (log.message.includes('faturamento') || log.message.includes('Assinatura')) {
          li.className = 'log-billing-change';
        } else if (log.message.includes('removido') || log.message.includes('inativo')) {
          li.className = 'log-deletion';
        }
        
        const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        li.innerHTML = `
          <span class="log-time">[${timeStr}]</span>
          <span class="log-text">${log.message}</span>
        `;
        logsListEl.appendChild(li);
      });
    }
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    if (logsListEl) {
      logsListEl.innerHTML = '<li class="empty-state text-danger">Erro ao carregar logs.</li>';
    }
  }
}

// Remover barbeiro (Painel Administrativo)
async function removeBarber(id) {
  if (!confirm('Tem certeza que deseja remover este barbeiro? Esta ação reduzirá a assinatura em R$ 25,00/mês a partir do próximo ciclo de cobrança.')) {
    return;
  }
  
  try {
    const res = await fetch(`/api/barbers/${id}`, { method: 'DELETE' });
    const data = await res.json();
    
    if (res.ok) {
      appendSystemMessage('Remoção de barbeiro registrada no servidor.');
      refreshDashboard();
      
      // Se o chatbot estiver no fluxo de dono, sugerir reiniciar para refletir a remoção
      if (currentState.startsWith('OWNER_')) {
        sendBotMessage("Um barbeiro foi removido pelo painel. O que você deseja fazer agora?", ["Ver Custos / Assinatura", "Adicionar Barbeiro", "Voltar ao Menu Principal"]);
        currentState = 'OWNER_MENU';
      }
    } else {
      alert(`Erro: ${data.error}`);
    }
  } catch (error) {
    console.error('Erro ao remover barbeiro:', error);
    alert('Erro de conexão ao tentar remover barbeiro.');
  }
}

// ==========================================================================
// RENDERIZAÇÃO DO CHATBOT (MENSAGENS & DIGITAÇÃO)
// ==========================================================================
function appendUserMessage(text) {
  const msgEl = document.createElement('div');
  msgEl.className = 'message user-msg';
  msgEl.textContent = text;
  chatMessages.appendChild(msgEl);
  scrollToBottom();
}

function appendSystemMessage(text) {
  const msgEl = document.createElement('div');
  msgEl.className = 'message system-msg';
  msgEl.innerHTML = text;
  chatMessages.appendChild(msgEl);
  scrollToBottom();
}

function sendBotMessage(htmlText, quickOptions = [], delayMs = 600) {
  // Limpar opções rápidas antigas
  chatQuickOptions.innerHTML = '';
  
  // Criar indicador de digitação
  const typingEl = document.createElement('div');
  typingEl.className = 'message bot-msg typing-indicator';
  typingEl.innerHTML = `
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  `;
  chatMessages.appendChild(typingEl);
  scrollToBottom();
  
  setTimeout(() => {
    // Remover indicador de digitação
    typingEl.remove();
    
    // Inserir mensagem real
    const msgEl = document.createElement('div');
    msgEl.className = 'message bot-msg';
    msgEl.innerHTML = htmlText;
    chatMessages.appendChild(msgEl);
    
    // Renderizar opções rápidas se existirem
    if (quickOptions && quickOptions.length > 0) {
      quickOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn-pill';
        btn.innerHTML = opt;
        btn.onclick = () => handleQuickOptionClick(opt);
        chatQuickOptions.appendChild(btn);
      });
    }
    
    scrollToBottom();
    lucide.createIcons();
  }, delayMs);
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function switchChannel(channel) {
  if (channel === 'client') {
    activeChannel = 'client';
    if (channelClientBtn) channelClientBtn.classList.add('active');
    if (channelOwnerBtn) channelOwnerBtn.classList.remove('active');
    if (chatBotTitle) chatBotTitle.textContent = 'Assistente de Agendamento';
  } else {
    activeChannel = 'owner';
    if (channelOwnerBtn) channelOwnerBtn.classList.add('active');
    if (channelClientBtn) channelClientBtn.classList.remove('active');
    if (chatBotTitle) chatBotTitle.textContent = 'Canal de Gestão';
  }
  resetChat();
}

function resetChat() {
  chatMessages.innerHTML = '';
  const now = new Date();
  appendSystemMessage(`Canal ${activeChannel === 'client' ? 'Cliente' : 'Gestor'} iniciado em ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  
  if (activeChannel === 'client') {
    currentState = 'CLIENT_NAME';
    sendBotMessage(
      "Olá! Seja muito bem-vindo ao <strong>BarberStudio</strong>.<br>Para darmos início ao agendamento de seu serviço, qual é o seu <strong>nome completo</strong>?"
    );
  } else {
    currentState = 'OWNER_MENU';
    sendBotMessage(
      "Olá, Gestor! Bem-vindo à sua central de faturamento e equipe no chat.<br>O que você deseja gerenciar hoje?",
      ['Adicionar Barbeiro', 'Ver Custos / Assinatura', 'Falar com Suporte Técnico']
    );
  }
}

function getAvailableTimeSlots(barberName) {
  // Lista base de horários de funcionamento padrão
  const baseSlots = ['09:00', '10:30', '13:00', '14:30', '16:00', '17:30'];
  const days = ['Hoje', 'Amanhã'];
  const allPossibleSlots = [];
  
  days.forEach(day => {
    baseSlots.forEach(slot => {
      allPossibleSlots.push(`${day} - ${slot}`);
    });
  });

  // Filtrar horários passados se o dia for "Hoje"
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const activeSlots = allPossibleSlots.filter(slot => {
    const [day, time] = slot.split(' - ');
    if (day === 'Hoje') {
      const [hour, minute] = time.split(':').map(Number);
      if (hour < currentHour) return false;
      if (hour === currentHour && minute <= currentMinute) return false;
    }
    return true;
  });
  
  // Se for um barbeiro específico
  if (barberName.toLowerCase() !== 'primeiro disponível') {
    // Filtrar horários onde já existe um agendamento para este barbeiro
    return activeSlots.filter(slot => {
      const isBooked = bookings.some(b => 
        b.barberName.toLowerCase() === barberName.toLowerCase() && 
        b.dateTime === slot
      );
      return !isBooked;
    });
  } else {
    // Se for "Primeiro Disponível"
    // O horário só fica indisponível se TODOS os barbeiros ativos estiverem ocupados
    return activeSlots.filter(slot => {
      // Barbeiros ocupados nesse slot
      const bookedBarbersCount = bookings.filter(b => b.dateTime === slot).length;
      // Se a quantidade de barbeiros ocupados é menor que a quantidade total de barbeiros ativos, o horário está livre!
      return bookedBarbersCount < barbers.length;
    });
  }
}

// ==========================================================================
// EVENTOS E MÁQUINA DE ESTADO DO CHATBOT
// ==========================================================================
function handleFormSubmit(e) {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  
  chatInput.value = '';
  appendUserMessage(text);
  
  // Encaminhar para processamento de acordo com o estado
  processInput(text);
}

function handleQuickOptionClick(optionText) {
  // Remove tags HTML da opção se houver, para manter a exibição limpa
  const cleanText = optionText.replace(/<[^>]*>/g, '');
  appendUserMessage(cleanText);
  processInput(cleanText);
}

function processInput(input) {
  const inputLower = input.toLowerCase();

  // Tratamento de casos fora do escopo global / suporte técnico
  if (inputLower === 'ajuda' || inputLower === 'suporte' || inputLower === 'atendimento') {
    sendBotMessage(
      "Se você precisa de auxílio técnico ou possui alguma dúvida sobre a plataforma, fale diretamente com nosso suporte humano:<br>" +
      `<div class="support-card">
        <div class="support-header"><i data-lucide="help-circle"></i> Suporte Técnico BarberStudio</div>
        <p>Segunda a Sexta, das 08h às 18h</p>
        <button class="support-btn" onclick="window.open('https://wa.me/5599999999999', '_blank')">Iniciar conversa no WhatsApp</button>
      </div>`,
      ['Voltar ao Menu Principal']
    );
    currentState = 'HELP_REDIRECT';
    return;
  }

  switch (currentState) {
    
    case 'HELP_REDIRECT':
      resetChat();
      break;

    // ==========================================
    // FLUXO A: CLIENTE FINAL (AGENDAMENTO)
    // ==========================================
    case 'CLIENT_NAME':
      bookingForm.clientName = input;
      currentState = 'CLIENT_SERVICE';
      sendBotMessage(
        `Prazer em te conhecer, <strong>${bookingForm.clientName}</strong>!<br>Qual o serviço que você gostaria de agendar?`,
        ['Cabelo', 'Barba', 'Combo (Cabelo + Barba)']
      );
      break;
      
    case 'CLIENT_SERVICE':
      bookingForm.serviceName = input;
      currentState = 'CLIENT_BARBER';
      
      // Montar lista de barbeiros ativos para as opções
      const barberOptions = barbers.map(b => b.name);
      barberOptions.push('Primeiro Disponível');
      
      sendBotMessage(
        "Excelente escolha! Agora escolha quem você quer que realize o serviço:",
        barberOptions
      );
      break;
      
    case 'CLIENT_BARBER':
      bookingForm.barberName = input;
      // Salvar ID do barbeiro correspondente se selecionado
      const selectedBarber = barbers.find(b => b.name.toLowerCase() === input.toLowerCase());
      bookingForm.barberId = selectedBarber ? selectedBarber._id : null;
      
      currentState = 'CLIENT_TIME';
      
      // Obter horários disponíveis dinamicamente assimilando a agenda e os agendamentos existentes
      const availableTimes = getAvailableTimeSlots(bookingForm.barberName);
      
      if (availableTimes.length === 0) {
        sendBotMessage(
          `Desculpe, não há horários livres para <strong>${bookingForm.barberName}</strong> entre hoje e amanhã. Deseja selecionar outro profissional?`,
          barbers.map(b => b.name).concat(['Primeiro Disponível'])
        );
        currentState = 'CLIENT_BARBER'; // Mantém no estado para selecionar barbeiro novamente
      } else {
        sendBotMessage(
          "Entendido! Analisamos a agenda em tempo real. Escolha um dos horários livres:",
          availableTimes
        );
      }
      break;
      
    case 'CLIENT_TIME':
      bookingForm.dateTime = input;
      currentState = 'CLIENT_CONTACT';
      sendBotMessage("Estamos quase lá! Por favor, digite seu <strong>telefone / WhatsApp de contato</strong> (com DDD) para confirmação:");
      break;
      
    case 'CLIENT_CONTACT':
      bookingForm.contactPhone = input;
      currentState = 'CLIENT_CONFIRM';
      
      const summary = `
        <strong>Resumo do seu Agendamento:</strong><br>
        <ul>
          <li><strong>Cliente:</strong> ${bookingForm.clientName}</li>
          <li><strong>Serviço:</strong> ${bookingForm.serviceName}</li>
          <li><strong>Barbeiro:</strong> ${bookingForm.barberName}</li>
          <li><strong>Data/Horário:</strong> ${bookingForm.dateTime}</li>
          <li><strong>Contato:</strong> ${bookingForm.contactPhone}</li>
        </ul>
        <br>Podemos confirmar o agendamento?
      `;
      sendBotMessage(summary, ['Sim, Confirmar', 'Não, Reiniciar']);
      break;
      
    case 'CLIENT_CONFIRM':
      if (inputLower.includes('sim') || inputLower.includes('confirmar')) {
        // Criar agendamento real chamando a API
        saveBookingAPI();
      } else {
        if (activeChannel === 'client') {
          currentState = 'CLIENT_NAME';
          sendBotMessage("Tudo bem. Vamos reiniciar o agendamento. Qual é o seu <strong>nome completo</strong>?");
        } else {
          sendBotMessage("Tudo bem. Vamos reiniciar o fluxo.", ['Sou Cliente (Agendar)', 'Sou Gestor / Proprietário']);
          currentState = 'MENU';
        }
      }
      break;

    // ==========================================
    // FLUXO B: GESTOR (CADASTRO E PRECIFICAÇÃO)
    // ==========================================
    case 'OWNER_MENU':
      if (inputLower.includes('adicionar') || inputLower.includes('cadastrar')) {
        currentState = 'OWNER_ADD_NAME';
        sendBotMessage("Vamos iniciar o cadastro de um novo membro na sua equipe. Qual o <strong>nome completo</strong> do barbeiro?");
      } else if (inputLower.includes('custos') || inputLower.includes('assinatura') || inputLower.includes('valor')) {
        const N = billingData.activeBarbersCount || 1;
        const total = billingData.monthlyFee || 50.00;
        sendBotMessage(
          `<strong>Sua Assinatura Atual:</strong><br>` +
          `• Barbeiros ativos no sistema: <strong>${N}</strong><br>` +
          `• Mensalidade atual: <strong>R$ ${total.toFixed(2).replace('.', ',')}</strong><br><br>` +
          `<strong>Lembrete da Regra de Precificação:</strong><br>` +
          `• 1 Barbeiro = R$ 50,00/mês (Plano Base)<br>` +
          `• Cada barbeiro adicional = + R$ 25,00/mês<br><br>` +
          `O que você deseja fazer agora?`,
          ['Adicionar Barbeiro', 'Voltar ao Menu Principal']
        );
      } else if (inputLower.includes('suporte') || inputLower.includes('técnico') || inputLower.includes('falar')) {
        sendBotMessage(
          "Caso sua dúvida seja sobre integração do sistema, problemas de login ou faturas atrasadas, nosso suporte humano está à disposição:<br>" +
          `<div class="support-card">
            <div class="support-header"><i data-lucide="help-circle"></i> Suporte Financeiro/Técnico</div>
            <p>Atendimento prioritário de Gestores</p>
            <button class="support-btn" onclick="window.open('https://wa.me/5599999999999', '_blank')">Falar com Especialista</button>
          </div>`,
          ['Adicionar Barbeiro', 'Voltar ao Menu Principal']
        );
      } else {
        sendBotMessage(
          "Não entendi. Escolha uma das opções abaixo para gerenciar sua barbearia:",
          ['Adicionar Barbeiro', 'Ver Custos / Assinatura', 'Voltar ao Menu Principal']
        );
      }
      break;

    case 'OWNER_ADD_NAME':
      barberForm.name = input;
      currentState = 'OWNER_ADD_SPECIALTIES';
      sendBotMessage(
        `Quais as <strong>especialidades</strong> de corte que o barbeiro <strong>${barberForm.name}</strong> realiza? (Ex: Cabelo, Barba, Combo - selecione ou digite)`,
        ['Cabelo', 'Cabelo e Barba', 'Cabelo, Barba e Sobrancelha']
      );
      break;
      
    case 'OWNER_ADD_SPECIALTIES':
      barberForm.specialties = input;
      currentState = 'OWNER_ADD_SCHEDULE';
      sendBotMessage(
        `Quais são os <strong>dias e horários</strong> de atendimento padrão dele na barbearia?`,
        ['Terça a Sábado, 09h às 19h', 'Segunda a Sexta, 08h às 18h', 'Quarta a Domingo, 10h às 20h']
      );
      break;
      
    case 'OWNER_ADD_SCHEDULE':
      barberForm.schedule = input;
      currentState = 'OWNER_ADD_CONTACT';
      sendBotMessage(`Qual o <strong>e-mail ou telefone</strong> do barbeiro ${barberForm.name} para criarmos as credenciais de login de acesso dele?`);
      break;
      
    case 'OWNER_ADD_CONTACT':
      barberForm.emailOrPhone = input;
      currentState = 'OWNER_ADD_CONFIRM';
      
      // Fazer o cálculo de mudança financeira baseado nos dados atuais
      const currentCount = billingData.activeBarbersCount;
      const nextCount = currentCount + 1;
      const oldVal = billingData.monthlyFee;
      const newVal = 50.00 + (nextCount - 1) * 25.00;
      
      const financialNotice = `
        Perfeito! Adicionando o barbeiro <strong>${barberForm.name}</strong>, sua equipe passará a ter <strong>${nextCount}</strong> barbeiros ativos.<br><br>
        <span style="color: var(--color-primary); font-weight: bold;">
          O valor da sua assinatura mensal ajustará de R$ ${oldVal.toFixed(2).replace('.', ',')} para R$ ${newVal.toFixed(2).replace('.', ',')}.
        </span><br><br>
        Podemos confirmar a inclusão e autorizar a alteração financeira?
      `;
      
      sendBotMessage(financialNotice, ['Sim, Confirmar e Faturar', 'Não, Cancelar Cadastro']);
      break;
      
    case 'OWNER_ADD_CONFIRM':
      if (inputLower.includes('sim') || inputLower.includes('confirmar') || inputLower.includes('faturar')) {
        saveBarberAPI();
      } else {
        sendBotMessage("Cadastro cancelado. O valor da sua assinatura permanece inalterado.", ['Adicionar Barbeiro', 'Voltar ao Menu Principal']);
        currentState = 'OWNER_MENU';
      }
      break;

    default:
      // Se por algum motivo o estado ficar inválido, volta para o menu
      if (activeChannel === 'client') {
        currentState = 'CLIENT_NAME';
        sendBotMessage("Olá! Seja muito bem-vindo ao <strong>BarberStudio</strong>.<br>Para darmos início ao agendamento, qual é o seu <strong>nome completo</strong>?");
      } else {
        currentState = 'MENU';
        sendBotMessage("Olá! Deseja iniciar um agendamento ou gerenciar sua barbearia?", ['Sou Cliente (Agendar)', 'Sou Gestor / Proprietário']);
      }
      break;
  }
}

// ==========================================================================
// FUNÇÕES DE PERSISTÊNCIA VIA REST API
// ==========================================================================
async function saveBookingAPI() {
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientName: bookingForm.clientName,
        serviceName: bookingForm.serviceName,
        barberId: bookingForm.barberId,
        barberName: bookingForm.barberName,
        dateTime: bookingForm.dateTime,
        contactPhone: bookingForm.contactPhone
      })
    });
    
    if (res.ok) {
      if (activeChannel === 'client') {
        sendBotMessage(
          "Agendamento confirmado com sucesso! 🎉<br>" +
          "Seu horário foi reservado e a confirmação foi enviada para o seu WhatsApp.<br><br>" +
          "Deseja fazer algo mais?",
          ['Agendar outro serviço']
        );
      } else {
        sendBotMessage(
          "Agendamento confirmado com sucesso! 🎉<br>" +
          "O barbeiro foi reservado e a informação foi persistida no banco de dados MongoDB.<br><br>" +
          "Deseja fazer algo mais?",
          ['Agendar outro serviço', 'Ir para o Menu Principal']
        );
      }
      currentState = 'CLIENT_POST_CONFIRM';
      refreshDashboard();
    } else {
      const err = await res.json();
      if (activeChannel === 'client') {
        sendBotMessage(`Erro ao salvar agendamento: ${err.error}. Vamos reiniciar o fluxo de agendamento.`);
        currentState = 'CLIENT_NAME';
        sendBotMessage("Qual é o seu <strong>nome completo</strong>?");
      } else {
        sendBotMessage(`Erro ao salvar agendamento: ${err.error}. Deseja tentar novamente?`, ['Sim, Recomeçar', 'Não, Cancelar']);
        currentState = 'MENU';
      }
    }
  } catch (error) {
    console.error('Erro ao salvar agendamento:', error);
    if (activeChannel === 'client') {
      sendBotMessage("Ocorreu um erro ao conectar ao servidor. Vamos reiniciar o fluxo de agendamento.");
      currentState = 'CLIENT_NAME';
      sendBotMessage("Qual é o seu <strong>nome completo</strong>?");
    } else {
      sendBotMessage("Ocorreu um erro ao conectar ao servidor. Deseja tentar de novo?", ['Sim, Recomeçar', 'Não, Cancelar']);
      currentState = 'MENU';
    }
  }
}

async function cancelBooking(id) {
  if (!confirm("Deseja realmente cancelar este agendamento? Esta ação enviará uma notificação de cancelamento via WhatsApp para o cliente e não poderá ser desfeita.")) {
    return;
  }
  
  try {
    const res = await fetch(`/api/bookings/${id}`, {
      method: 'DELETE'
    });
    
    if (res.ok) {
      alert("Agendamento cancelado com sucesso!");
      refreshDashboard();
    } else {
      const err = await res.json();
      alert(`Erro ao cancelar agendamento: ${err.error}`);
    }
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    alert("Erro ao conectar ao servidor para cancelar o agendamento.");
  }
}

async function saveBarberAPI() {
  try {
    const specialtiesArray = barberForm.specialties.split(',').map(s => s.trim());
    const res = await fetch('/api/barbers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: barberForm.name,
        specialties: specialtiesArray,
        schedule: barberForm.schedule,
        emailOrPhone: barberForm.emailOrPhone
      })
    });
    
    if (res.ok) {
      sendBotMessage(
        `Cadastro ativo com sucesso! 🚀<br>` +
        `Enviamos o link de acesso para <strong>${barberForm.emailOrPhone}</strong>.<br>` +
        `O painel administrativo e a assinatura mensal de faturamento já foram reajustados.`,
        ['Adicionar outro Barbeiro', 'Voltar para Menu Principal']
      );
      currentState = 'OWNER_POST_CONFIRM';
      refreshDashboard();
    } else {
      const err = await res.json();
      sendBotMessage(`Erro ao cadastrar barbeiro: ${err.error}`, ['Voltar para Menu Principal']);
      currentState = 'OWNER_MENU';
    }
  } catch (error) {
    console.error('Erro ao salvar barbeiro:', error);
    sendBotMessage("Ocorreu um erro ao salvar o barbeiro no servidor. Tente novamente.", ['Voltar para Menu Principal']);
    currentState = 'OWNER_MENU';
  }
}

// Handler pós confirmações
function handlePostConfirm(inputLower) {
  if (currentState === 'CLIENT_POST_CONFIRM') {
    if (inputLower.includes('outro') || inputLower.includes('agendar')) {
      currentState = 'CLIENT_NAME';
      sendBotMessage("Certo! Qual é o seu <strong>nome completo</strong>?");
    } else {
      sendBotMessage("Tudo bem! Caso precise realizar um novo agendamento futuramente, basta digitar seu <strong>nome completo</strong> para iniciar:");
      currentState = 'CLIENT_NAME';
    }
  } else if (currentState === 'OWNER_POST_CONFIRM') {
    if (inputLower.includes('outro') || inputLower.includes('adicionar')) {
      currentState = 'OWNER_ADD_NAME';
      sendBotMessage("Certo! Qual o <strong>nome completo</strong> do novo barbeiro?");
    } else {
      currentState = 'OWNER_MENU';
      sendBotMessage("Como gestor, o que você deseja fazer agora?", ['Adicionar Barbeiro', 'Ver Custos / Assinatura']);
    }
  }
}

// Sobrescrever processInput para capturar estados pós confirmação
const originalProcessInput = processInput;
processInput = function(input) {
  const inputLower = input.toLowerCase();
  if (currentState === 'CLIENT_POST_CONFIRM' || currentState === 'OWNER_POST_CONFIRM') {
    handlePostConfirm(inputLower);
  } else {
    originalProcessInput(input);
  }
};
