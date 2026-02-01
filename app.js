// CHEGA! App - Sistema Completo
class ChegaApp {
    constructor() {
        this.user = {
            name: 'Usuária',
            phone: '',
            emergencyContacts: [],
            settings: {}
        };
        
        this.location = null;
        this.trip = null;
        this.community = [];
        this.emergencyActive = false;
        
        this.init();
    }
    
    async init() {
        // Carregar dados salvos
        await this.loadData();
        
        // Iniciar serviços
        this.initLocation();
        this.initEmergencyDetection();
        this.initServiceWorker();
        this.initUI();
        this.startBackgroundTasks();
        
        console.log('CHEGA! App iniciado');
    }
    
    async loadData() {
        const saved = localStorage.getItem('chega_user');
        if (saved) {
            this.user = JSON.parse(saved);
        } else {
            // Primeiro uso - configuração inicial
            await this.firstTimeSetup();
        }
    }
    
    async firstTimeSetup() {
        // Solicitar permissões
        const permissions = await this.requestPermissions();
        
        // Configurar contatos de emergência
        const contacts = await this.setupEmergencyContacts();
        
        // Configurar mensagem personalizada
        const message = await this.setupEmergencyMessage();
        
        this.user = {
            name: await this.promptUserName(),
            phone: await this.getUserPhone(),
            emergencyContacts: contacts,
            emergencyMessage: message,
            settings: {
                vibrate: true,
                sound: true,
                flashlight: true,
                autoSMS: true,
                shareLocation: true,
                notifyContacts: true
            }
        };
        
        this.saveData();
    }
    
    async requestPermissions() {
        const permissions = [
            { name: 'geolocation', desc: 'localização' },
            { name: 'notifications', desc: 'notificações' }
        ];
        
        for (const perm of permissions) {
            try {
                if (perm.name === 'geolocation') {
                    this.location = await this.getCurrentLocation();
                }
                if (perm.name === 'notifications' && 'Notification' in window) {
                    await Notification.requestPermission();
                }
            } catch (error) {
                console.warn(`Permissão ${perm.desc}:`, error);
            }
        }
    }
    
    async setupEmergencyContacts() {
        // Pedir 3 contatos de emergência
        const contacts = [];
        
        for (let i = 1; i <= 3; i++) {
            const name = prompt(`Contato ${i} - Nome:`);
            const phone = prompt(`Contato ${i} - Telefone:`);
            
            if (name && phone) {
                contacts.push({ name, phone, active: true });
            }
        }
        
        return contacts;
    }
    
    setupEmergencyMessage() {
        const defaultMessage = `🚨 EMERGÊNCIA CHEGA! Preciso de ajuda! Local: {LOCATION} Hora: {TIME}`;
        const custom = prompt('Mensagem de emergência (deixe em branco para padrão):', defaultMessage);
        return custom || defaultMessage;
    }
    
    promptUserName() {
        return prompt('Seu nome (aparecerá nos alertas):', 'Usuária') || 'Usuária';
    }
    
    async getUserPhone() {
        if ('contacts' in navigator && 'ContactsManager' in window) {
            try {
                const contacts = await navigator.contacts.select(['tel'], { multiple: false });
                return contacts[0]?.tel[0] || '';
            } catch (error) {
                return prompt('Seu telefone (para identificação):') || '';
            }
        }
        return prompt('Seu telefone (para identificação):') || '';
    }
    
    initEmergencyDetection() {
        // Detecção por botão físico (via gyroscope hack)
        this.initVolumeButtonDetection();
        this.initShakeDetection();
        this.initScreenOffDetection();
    }
    
    initVolumeButtonDetection() {
        // Hack: Detectar mudanças no volume
        let lastVolume = 50;
        let pressCount = 0;
        let lastPress = 0;
        
        // Simulação - na prática precisa de plugin Cordova
        document.addEventListener('keydown', (e) => {
            if (e.key === 'VolumeUp' || e.key === 'VolumeDown') {
                const now = Date.now();
                if (now - lastPress < 2000) {
                    pressCount++;
                    if (pressCount >= 3) {
                        this.triggerEmergency();
                        pressCount = 0;
                    }
                } else {
                    pressCount = 1;
                }
                lastPress = now;
            }
        });
    }
    
    initShakeDetection() {
        let lastShake = 0;
        
        if ('DeviceMotionEvent' in window) {
            window.addEventListener('devicemotion', (e) => {
                const acceleration = e.acceleration;
                if (!acceleration) return;
                
                const shake = Math.abs(acceleration.x) + Math.abs(acceleration.y) + Math.abs(acceleration.z);
                
                if (shake > 30 && Date.now() - lastShake > 3000) {
                    lastShake = Date.now();
                    this.showQuickEmergencyMenu();
                }
            });
        }
    }
    
    initScreenOffDetection() {
        // Detectar quando tela apaga (possível emergência)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Tela desligou - iniciar timer de segurança
                this.startSafetyTimer();
            }
        });
    }
    
    showQuickEmergencyMenu() {
        // Menu rápido que aparece ao sacudir
        const menu = document.createElement('div');
        menu.className = 'quick-emergency';
        menu.innerHTML = `
            <button onclick="app.triggerEmergency('shake')">🚨 Emergência</button>
            <button onclick="app.startTrip()">📍 Iniciar Trajeto</button>
            <button onclick="app.sendStatus('ok')">✅ Estou bem</button>
        `;
        document.body.appendChild(menu);
        
        setTimeout(() => menu.remove(), 5000);
    }
    
    async triggerEmergency(source = 'button') {
        if (this.emergencyActive) return;
        
        this.emergencyActive = true;
        
        // 1. Obter localização precisa
        const location = await this.getAccurateLocation();
        
        // 2. Ativar efeitos visuais/sonoros
        this.activateEmergencyEffects();
        
        // 3. Redirecionar para tela de emergência
        window.location.href = `emergency.html?lat=${location.lat}&lng=${location.lng}&source=${source}`;
        
        // 4. Enviar alertas em background
        this.sendEmergencyAlerts(location);
        
        // 5. Registrar no histórico
        this.logEmergency({
            type: 'emergency',
            source,
            location,
            timestamp: new Date(),
            responded: false
        });
    }
    
    async getAccurateLocation() {
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    speed: pos.coords.speed,
                    heading: pos.coords.heading
                }),
                () => resolve({ lat: 0, lng: 0, accuracy: 0 }),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }
    
    activateEmergencyEffects() {
        // Vibrar
        if (this.user.settings.vibrate && navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200, 100, 500]);
        }
        
        // Tocar som (se permitido)
        if (this.user.settings.sound) {
            this.playEmergencySound();
        }
        
        // Piscar tela (simulado)
        document.body.style.animation = 'emergencyFlash 0.5s infinite';
    }
    
    playEmergencySound() {
        const audio = new Audio('sounds/emergency.mp3');
        audio.loop = true;
        audio.volume = 1.0;
        audio.play().catch(e => console.log('Som bloqueado'));
    }
    
    async sendEmergencyAlerts(location) {
        // 1. SMS para contatos
        if (this.user.settings.autoSMS) {
            await this.sendSMSToContacts(location);
        }
        
        // 2. Notificações push
        if (this.user.settings.notifyContacts) {
            this.sendPushNotifications(location);
        }
        
        // 3. API de emergência (ex: 190)
        if (this.user.settings.callEmergency) {
            this.callEmergencyNumber(location);
        }
        
        // 4. Comunidade CHEGA+ próxima
        this.alertNearbyCommunity(location);
    }
    
    async sendSMSToContacts(location) {
        const message = this.formatEmergencyMessage(location);
        
        for (const contact of this.user.emergencyContacts.filter(c => c.active)) {
            try {
                // Tenta API Web Share primeiro
                if (navigator.share) {
                    await navigator.share({
                        text: message,
                        title: '🚨 EMERGÊNCIA CHEGA!'
                    });
                } else {
                    // Fallback para link SMS
                    window.open(`sms:${contact.phone}?body=${encodeURIComponent(message)}`, '_blank');
                }
            } catch (error) {
                console.error('Erro ao enviar SMS:', error);
            }
        }
    }
    
    formatEmergencyMessage(location) {
        const mapLink = `https://maps.google.com/?q=${location.lat},${location.lng}`;
        const time = new Date().toLocaleString('pt-BR');
        
        return this.user.emergencyMessage
            .replace('{LOCATION}', mapLink)
            .replace('{TIME}', time)
            .replace('{NAME}', this.user.name)
            .replace('{PHONE}', this.user.phone);
    }
    
    sendPushNotifications(location) {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification('🚨 Alerta CHEGA! Enviado', {
                    body: 'Seus contatos foram notificados',
                    icon: 'icons/icon-192.png',
                    badge: 'icons/badge-72.png',
                    vibrate: [200, 100, 200],
                    actions: [
                        { action: 'view', title: 'Ver Localização' },
                        { action: 'dismiss', title: 'Fechar' }
                    ],
                    data: { url: `https://maps.google.com/?q=${location.lat},${location.lng}` }
                });
            });
        }
    }
    
    callEmergencyNumber(location) {
        // Liga para número configurado ou 190
        const number = this.user.settings.emergencyNumber || '190';
        
        // Faz a ligação
        window.open(`tel:${number}`, '_blank');
        
        // Prepara mensagem para quando atenderem
        const message = `Emergência: ${this.user.name} precisa de ajuda. Localização: ${location.lat},${location.lng}`;
        localStorage.setItem('emergency_call_message', message);
    }
    
    alertNearbyCommunity(location) {
        // Envia alerta para usuários CHEGA+ próximos (via WebRTC/WebSockets)
        if (this.community.length > 0) {
            this.community.forEach(user => {
                if (this.calculateDistance(location, user.location) < 1000) { // 1km
                    this.sendCommunityAlert(user, location);
                }
            });
        }
    }
    
    calculateDistance(loc1, loc2) {
        const R = 6371e3; // metros
        const φ1 = loc1.lat * Math.PI/180;
        const φ2 = loc2.lat * Math.PI/180;
        const Δφ = (loc2.lat-loc1.lat) * Math.PI/180;
        const Δλ = (loc2.lng-loc1.lng) * Math.PI/180;
        
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c;
    }
    
    sendCommunityAlert(user, location) {
        // Simulação - na prática usar WebSocket
        console.log(`Alerta enviado para ${user.name} próxima`);
        
        // Notificação no navegador dela
        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel('chega_alerts');
            channel.postMessage({
                type: 'emergency_nearby',
                location: location,
                distance: this.calculateDistance(location, user.location),
                timestamp: new Date()
            });
        }
    }
    
    // SISTEMA DE ACOMPANHAMENTO (TRIP)
    async startTrip(destination = null) {
        this.trip = {
            id: Date.now(),
            startTime: new Date(),
            startLocation: await this.getCurrentLocation(),
            destination: destination,
            active: true,
            checkpoints: [],
            sharedWith: this.user.emergencyContacts.filter(c => c.shareTrip)
        };
        
        // Iniciar tracking
        this.startTripTracking();
        
        // Notificar contatos
        this.notifyTripStart();
        
        // Redirecionar para tela de trip
        window.location.href = 'trip.html';
    }
    
    startTripTracking() {
        if (!this.trip) return;
        
        // Atualizar localização a cada 30 segundos
        this.trip.tracker = setInterval(async () => {
            const location = await this.getCurrentLocation();
            
            // Adicionar checkpoint
            this.trip.checkpoints.push({
                location,
                timestamp: new Date(),
                battery: navigator.getBattery ? await navigator.getBattery() : null
            });
            
            // Enviar atualização para contatos
            if (this.trip.sharedWith.length > 0) {
                this.updateTripLocation(location);
            }
            
            // Verificar se chegou ao destino
            if (this.trip.destination && this.calculateDistance(location, this.trip.destination) < 100) {
                this.endTrip('arrived');
            }
            
            // Verificar tempo excessivo
            const duration = Date.now() - this.trip.startTime;
            if (duration > 3600000) { // 1 hora
                this.checkTripSafety();
            }
        }, 30000);
    }
    
    notifyTripStart() {
        const message = `📍 ${this.user.name} iniciou um trajeto. Acompanhe em tempo real.`;
        
        this.trip.sharedWith.forEach(contact => {
            this.sendSMS(contact.phone, message);
        });
    }
    
    updateTripLocation(location) {
        const message = `📍 ${this.user.name} está em: https://maps.google.com/?q=${location.lat},${location.lng}`;
        
        // Enviar apenas para quem pediu atualização
        this.trip.sharedWith.filter(c => c.realTime).forEach(contact => {
            this.sendSMS(contact.phone, message);
        });
    }
    
    async endTrip(reason = 'manual') {
        if (!this.trip || !this.trip.active) return;
        
        this.trip.active = false;
        this.trip.endTime = new Date();
        this.trip.endReason = reason;
        
        // Parar tracker
        if (this.trip.tracker) {
            clearInterval(this.trip.tracker);
        }
        
        // Notificar chegada
        if (reason === 'arrived') {
            await this.sendArrivalMessage();
        }
        
        // Salvar histórico
        await this.saveTripHistory();
        
        // Redirecionar
        window.location.href = 'index.html';
    }
    
    async sendArrivalMessage() {
        const message = `✅ ${this.user.name} chegou em segurança!`;
        
        for (const contact of this.trip.sharedWith) {
            await this.sendSMS(contact.phone, message);
        }
    }
    
    // SISTEMA CHEGA+ (COMUNIDADE)
    async initCommunity() {
        // Buscar usuários próximos
        const nearbyUsers = await this.findNearbyUsers();
        this.community = nearbyUsers;
        
        // Iniciar comunicação P2P
        this.initPeerConnection();
        
        // Atualizar lista periodicamente
        setInterval(() => this.updateCommunity(), 60000); // 1 minuto
    }
    
    async findNearbyUsers() {
        // Simulação - na prática usar WebRTC/WebSocket
        return [
            { id: 1, name: 'Ana', distance: 250, status: 'safe', lastSeen: new Date() },
            { id: 2, name: 'Maria', distance: 800, status: 'traveling', lastSeen: new Date() }
        ];
    }
    
    initPeerConnection() {
        // WebRTC para comunicação direta
        if ('RTCPeerConnection' in window) {
            this.peerConnection = new RTCPeerConnection();
            
            // Configurar canal de dados
            this.dataChannel = this.peerConnection.createDataChannel('chega');
            
            this.dataChannel.onmessage = (event) => {
                this.handleCommunityMessage(event.data);
            };
            
            // Buscar outros peers (simplificado)
            this.discoverPeers();
        }
    }
    
    handleCommunityMessage(message) {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'help_request':
                this.showHelpRequest(data);
                break;
            case 'location_update':
                this.updateCommunityLocation(data);
                break;
            case 'check_in':
                this.logCommunityCheckIn(data);
                break;
        }
    }
    
    showHelpRequest(data) {
        // Mostrar notificação de usuário próximo pedindo ajuda
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🤝 CHEGA+ - Ajuda Solicitada', {
                body: `${data.name} está a ${data.distance}m e precisa de ajuda`,
                icon: 'icons/community.png',
                tag: 'chega_help'
            });
        }
        
        // Mostrar na interface
        this.displayHelpAlert(data);
    }
    
    sendNudge(userId) {
        // "Cutucar" usuário próximo
        const message = {
            type: 'nudge',
            from: this.user.name,
            timestamp: new Date(),
            message: 'Estou aqui se precisar!'
        };
        
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(message));
        }
    }
    
    // HISTÓRICO E DADOS
    async logEmergency(data) {
        const history = JSON.parse(localStorage.getItem('chega_history') || '[]');
        history.push(data);
        
        // Manter apenas últimos 100 registros
        if (history.length > 100) {
            history.splice(0, history.length - 100);
        }
        
        localStorage.setItem('chega_history', JSON.stringify(history));
        
        // Enviar para análise (anonimizado)
        this.sendAnalytics(data);
    }
    
    sendAnalytics(data) {
        // Enviar dados anonimizados para melhoria do app
        const analytics = {
            event: data.type,
            timestamp: data.timestamp,
            source: data.source,
            location_available: !!data.location,
            anonymized_id: this.getAnonymizedId()
        };
        
        // Enviar para servidor (opcional)
        fetch('https://api.chegaapp.org/analytics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(analytics)
        }).catch(() => {}); // Falha silenciosa
    }
    
    getAnonymizedId() {
        // ID único anônimo
        let id = localStorage.getItem('chega_anonymous_id');
        if (!id) {
            id = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('chega_anonymous_id', id);
        }
        return id;
    }
    
    // UTILITÁRIOS
    saveData() {
        localStorage.setItem('chega_user', JSON.stringify(this.user));
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#ff3b30' : type === 'success' ? '#4cd964' : '#007aff'};
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            z-index: 1000;
            animation: slideUp 0.3s;
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
    
    initServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js')
                .then(reg => console.log('Service Worker registrado'))
                .catch(err => console.log('Service Worker falhou:', err));
        }
    }
    
    initUI() {
        // Inicializar componentes da interface
        this.updateStatusDisplay();
        this.setupEventListeners();
    }
    
    startBackgroundTasks() {
        // Verificar segurança periodicamente
        setInterval(() => this.checkSafety(), 300000); // 5 minutos
        
        // Atualizar localização em background
        setInterval(() => this.updateBackgroundLocation(), 60000); // 1 minuto
    }
    
    checkSafety() {
        // Verificações automáticas de segurança
        this.checkBatteryLevel();
        this.checkNetworkStatus();
        this.checkLocationAccuracy();
    }
    
    checkBatteryLevel() {
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                if (battery.level < 0.2) {
                    this.showToast('⚠️ Bateria baixa! Carregue o celular.', 'warning');
                }
            });
        }
    }
    
    updateBackgroundLocation() {
        this.getCurrentLocation().then(location => {
            this.location = location;
            this.saveData();
        });
    }
}

// Inicializar app globalmente
window.app = new ChegaApp();