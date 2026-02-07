// Sistema de Emergência CHEGA!
class EmergencySystem {
    constructor() {
        this.active = false;
        this.startTime = null;
        this.location = null;
        this.alertsSent = [];
        this.effects = {
            visual: null,
            sound: null,
            vibration: null
        };
        
        this.init();
    }
    
    async init() {
        // Obter parâmetros da URL
        const params = new URLSearchParams(window.location.search);
        this.location = {
            lat: parseFloat(params.get('lat')),
            lng: parseFloat(params.get('lng')),
            source: params.get('source') || 'manual'
        };
        
        // Iniciar emergência
        await this.startEmergency();
        
        // Configurar interface
        this.setupEmergencyUI();
        
        // Iniciar contador
        this.startTimer();
    }
    
    async startEmergency() {
        this.active = true;
        this.startTime = new Date();
        
        // 1. Ativar efeitos de emergência
        this.activateEmergencyEffects();
        
        // 2. Bloquear tela (tela cheia, evitar saída)
        this.lockScreen();
        
        // 3. Obter localização precisa (se não veio da URL)
        if (!this.location.lat) {
            this.location = await this.getPreciseLocation();
        }
        
        // 4. Enviar todos os alertas
        await this.sendAllAlerts();
        
        // 5. Iniciar gravação (se permitido)
        this.startRecording();
        
        // 6. Notificar serviço de emergência (190, etc)
        this.notifyEmergencyServices();
    }
    
    activateEmergencyEffects() {
        // EFEITO VISUAL: Piscar tela vermelho/branco
        document.body.style.animation = 'emergencyFlash 0.5s infinite';
        
        // Criar overlay de SOS
        const overlay = document.createElement('div');
        overlay.id = 'sos-overlay';
        overlay.innerHTML = '🚨 S O S 🚨';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 59, 48, 0.9);
            color: white;
            font-size: 4em;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            pointer-events: none;
            animation: pulse 1s infinite;
        `;
        document.body.appendChild(overlay);
        
        // EFEITO SONORO: Sirene
        this.playSiren();
        
        // VIBRAÇÃO: Padrão de emergência
        if (navigator.vibrate) {
            navigator.vibrate([1000, 500, 1000, 500, 1000]);
        }
        
        // TENTAR ACENDER LANTERNA (via screen brightness hack)
        this.activateFlashlight();
    }
    
    playSiren() {
        // Criar sirene com Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Sirene oscilante
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1600, audioContext.currentTime + 0.5);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 1);
        
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 30); // Para após 30s
        
        this.effects.sound = { oscillator, gainNode, audioContext };
    }
    
    activateFlashlight() {
        // Hack para simular lanterna (máximo brightness)
        document.body.style.filter = 'brightness(200%)';
        
        // Tentar API de tela (se disponível)
        if ('wakeLock' in navigator) {
            navigator.wakeLock.request('screen');
        }
        
        // Tentar API de lanterna (experimental)
        if ('torch' in navigator.mediaDevices || 'torch' in navigator) {
            this.toggleTorch(true);
        }
    }
    
    async toggleTorch(on) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            const track = stream.getVideoTracks()[0];
            if ('torch' in track) {
                await track.torch(on);
            }
        } catch (e) {
            console.log('Lanterna não suportada');
        }
    }
    
    lockScreen() {
        // Tela cheia
        document.documentElement.requestFullscreen?.();
        
        // Manter tela ligada
        if ('wakeLock' in navigator) {
            navigator.wakeLock.request('screen');
        }
        
        // Prevenir saída
        window.onbeforeunload = () => "A emergência ainda está ativa!";
        
        // Bloquear botões físicos
        document.addEventListener('keydown', this.blockKeys);
    }
    
    blockKeys(e) {
        if (['Escape', 'Backspace', 'Home'].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
        }
    }
    
    async getPreciseLocation() {
        return new Promise((resolve) => {
            let bestLocation = null;
            let attempts = 0;
            
            const watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    attempts++;
                    const location = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        accuracy: pos.coords.accuracy,
                        speed: pos.coords.speed,
                        heading: pos.coords.heading,
                        timestamp: new Date()
                    };
                    
                    // Aceitar se precisão < 50m ou após 3 tentativas
                    if (location.accuracy < 50 || attempts >= 3) {
                        navigator.geolocation.clearWatch(watchId);
                        bestLocation = location;
                        resolve(location);
                    } else if (!bestLocation || location.accuracy < bestLocation.accuracy) {
                        bestLocation = location;
                    }
                },
                (error) => {
                    console.error('Erro GPS:', error);
                    resolve(bestLocation || { lat: 0, lng: 0 });
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
            
            // Timeout após 15 segundos
            setTimeout(() => {
                navigator.geolocation.clearWatch(watchId);
                resolve(bestLocation || { lat: 0, lng: 0 });
            }, 15000);
        });
    }
    
    async sendAllAlerts() {
        const user = JSON.parse(localStorage.getItem('chega_user'));
        
        // 1. SMS para contatos de emergência
        await this.sendSMSToContacts(user);
        
        // 2. Email de emergência
        await this.sendEmergencyEmail(user);
        
        // 3. Notificação push
        this.sendPushNotification(user);
        
        // 4. Alertar comunidade próxima
        this.alertCommunity(user);
        
        // 5. Postar em redes sociais (opcional)
        if (user.settings.shareSocialMedia) {
            this.postToSocialMedia(user);
        }
        
        // Registrar envios
        this.alertsSent = [
            { type: 'sms', time: new Date() },
            { type: 'push', time: new Date() }
        ];
    }
    
    async sendSMSToContacts(user) {
        const message = this.formatAlertMessage(user);
        
        for (const contact of user.emergencyContacts.filter(c => c.active)) {
            try {
                // Tentar Web Share API
                if (navigator.share) {
                    await navigator.share({
                        text: message,
                        title: '🚨 EMERGÊNCIA CHEGA!'
                    });
                } else {
                    // Fallback para intent SMS
                    const smsUrl = `sms:${contact.phone}?body=${encodeURIComponent(message)}`;
                    window.open(smsUrl, '_blank');
                }
                
                console.log(`SMS enviado para ${contact.name}`);
            } catch (error) {
                console.error(`Erro SMS para ${contact.name}:`, error);
            }
        }
    }
    
    formatAlertMessage(user) {
        const mapLink = `https://maps.google.com/?q=${this.location.lat},${this.location.lng}`;
        const time = new Date().toLocaleString('pt-BR');
        
        let message = user.emergencyMessage || `🚨 EMERGÊNCIA CHEGA!
        
        ${user.name} precisa de ajuda imediata!
        
        📍 LOCALIZAÇÃO: ${mapLink}
        🕒 HORA: ${time}
        📱 CONTATO: ${user.phone}
        
        Este alerta foi enviado automaticamente pelo App CHEGA!`;
        
        // Adicionar instruções de segurança
        message += `
        
        INSTRUÇÕES:
        1. NÃO ligue para a vítima (pode piorar a situação)
        2. Verifique a localização no mapa
        3. Se possível, envie ajuda
        4. Contate autoridades se necessário`;
        
        return message;
    }
    
    sendPushNotification(user) {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification('🚨 Alerta de Emergência Ativado', {
                    body: `${user.name} ativou o modo emergência`,
                    icon: 'icons/icon-192.png',
                    badge: 'icons/badge-72.png',
                    tag: 'emergency_alert',
                    requireInteraction: true,
                    actions: [
                        {
                            action: 'view_location',
                            title: '📍 Ver Localização',
                            icon: 'icons/map.png'
                        },
                        {
                            action: 'call_emergency',
                            title: '📞 Ligar 190',
                            icon: 'icons/phone.png'
                        }
                    ],
                    data: {
                        url: `https://maps.google.com/?q=${this.location.lat},${this.location.lng}`,
                        phone: user.phone
                    }
                });
            });
        }
    }
    
    alertCommunity(user) {
        // Enviar para usuários CHEGA+ em um raio de 1km
        const alert = {
            type: 'emergency_alert',
            user: {
                id: user.anonymousId,
                distance: 'próximo',
                needsHelp: true
            },
            location: this.location,
            timestamp: new Date()
        };
        
        // Enviar via WebRTC ou WebSocket
        this.broadcastToCommunity(alert);
    }
    
    broadcastToCommunity(alert) {
        // Usar BroadcastChannel para abas abertas
        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel('chega_emergency');
            channel.postMessage(alert);
        }
        
        // Usar localStorage event para outros métodos
        localStorage.setItem('chega_last_alert', JSON.stringify(alert));
        localStorage.removeItem('chega_last_alert');
    }
    
    startRecording() {
        // Iniciar gravação de áudio (se permitido)
        if (navigator.mediaDevices && user.settings.recordAudio) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    const mediaRecorder = new MediaRecorder(stream);
                    const chunks = [];
                    
                    mediaRecorder.ondataavailable = e => chunks.push(e.data);
                    mediaRecorder.onstop = () => {
                        const blob = new Blob(chunks, { type: 'audio/webm' });
                        this.saveRecording(blob);
                    };
                    
                    mediaRecorder.start();
                    
                    // Parar após 5 minutos
                    setTimeout(() => mediaRecorder.stop(), 300000);
                })
                .catch(err => console.log('Gravação não permitida:', err));
        }
    }
    
    saveRecording(blob) {
        // Salvar localmente
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chega_emergency_${new Date().getTime()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    
    notifyEmergencyServices() {
        // Preparar chamada para 190 com informações
        const emergencyInfo = {
            type: 'domestic_violence', // Configurável
            location: this.location,
            userInfo: {
                hasApp: true,
                appName: 'CHEGA!'
            }
        };
        
        // Salvar para quando a chamada for atendida
        localStorage.setItem('emergency_call_data', JSON.stringify(emergencyInfo));
        
        // Mostrar botão para ligar
        this.showEmergencyCallButton();
    }
    
    showEmergencyCallButton() {
        const btn = document.createElement('button');
        btn.id = 'call-190-btn';
        btn.innerHTML = '📞 LIGAR PARA 190';
        btn.onclick = () => window.open('tel:190', '_blank');
        
        btn.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 20px;
            background: #4cd964;
            color: white;
            border: none;
            padding: 15px;
            border-radius: 50%;
            font-size: 0.9em;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(btn);
    }
    
    setupEmergencyUI() {
        // Criar interface de emergência
        document.body.innerHTML = `
            <div class="emergency-container">
                <div class="sos-display">🚨 S O S 🚨</div>
                
                <div class="info-panel">
                    <h2>EMERGÊNCIA ATIVADA</h2>
                    
                    <div class="status-item">
                        <span>📍 Localização:</span>
                        <span id="location-text">Enviada</span>
                    </div>
                    
                    <div class="status-item">
                        <span>📱 Alertas:</span>
                        <span id="alerts-sent">${this.alertsSent.length} enviados</span>
                    </div>
                    
                    <div class="status-item">
                        <span>⏱️ Tempo:</span>
                        <span id="emergency-timer">00:00</span>
                    </div>
                    
                    <div class="location-map" id="map-preview">
                        <!-- Mapa será inserido aqui -->
                    </div>
                </div>
                
                <div class="emergency-actions">
                    <button id="cancel-btn" class="btn-safe">
                        ✅ ESTOU SEGURA
                    </button>
                    
                    <button id="update-location" class="btn-secondary">
                        🔄 ATUALIZAR LOCALIZAÇÃO
                    </button>
                    
                    <button id="send-additional-alert" class="btn-alert">
                        📢 ENVIAR ALERTA EXTRA
                    </button>
                </div>
                
                <div class="instructions">
                    <h3>O QUE FAZER:</h3>
                    <p>1. Se possível, vá para um local público</p>
                    <p>2. Sua localização está sendo compartilhada</p>
                    <p>3. Seus contatos foram alertados</p>
                    <p>4. Toque em "ESTOU SEGURA" quando for seguro</p>
                </div>
            </div>
        `;
        
        // Adicionar estilos
        this.addEmergencyStyles();
        
        // Configurar eventos
        this.setupEventListeners();
        
        // Carregar mapa
        this.loadMapPreview();
    }
    
    addEmergencyStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .emergency-container {
                padding: 20px;
                text-align: center;
                background: linear-gradient(45deg, #ff0000, #ff6b6b);
                min-height: 100vh;
                color: white;
                animation: pulseBackground 2s infinite;
            }
            
            @keyframes pulseBackground {
                0% { background: #ff0000; }
                50% { background: #ff6b6b; }
                100% { background: #ff0000; }
            }
            
            .sos-display {
                font-size: 4em;
                margin: 20px 0;
                animation: blink 1s infinite;
            }
            
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }
            
            .info-panel {
                background: rgba(0,0,0,0.7);
                padding: 20px;
                border-radius: 15px;
                margin: 20px 0;
            }
            
            .status-item {
                display: flex;
                justify-content: space-between;
                margin: 10px 0;
                font-size: 1.1em;
            }
            
            .location-map {
                height: 200px;
                background: #333;
                border-radius: 10px;
                margin: 20px 0;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .emergency-actions {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin: 20px 0;
            }
            
            .btn-safe, .btn-secondary, .btn-alert {
                padding: 15px;
                border: none;
                border-radius: 10px;
                font-size: 1.1em;
                font-weight: bold;
                cursor: pointer;
            }
            
            .btn-safe {
                background: #4cd964;
                color: white;
            }
            
            .btn-secondary {
                background: #007aff;
                color: white;
            }
            
            .btn-alert {
                background: #ff9500;
                color: white;
            }
            
            .instructions {
                background: rgba(255,255,255,0.1);
                padding: 15px;
                border-radius: 10px;
                margin-top: 20px;
                text-align: left;
            }
        `;
        document.head.appendChild(style);
    }
    
    setupEventListeners() {
        document.getElementById('cancel-btn').onclick = () => this.cancelEmergency();
        document.getElementById('update-location').onclick = () => this.updateLocation();
        document.getElementById('send-additional-alert').onclick = () => this.sendAdditionalAlert();
        
        // Atalho de teclado: Espaço para cancelar
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                this.cancelEmergency();
            }
        });
    }
    
    startTimer() {
        setInterval(() => {
            const elapsed = Math.floor((new Date() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            document.getElementById('emergency-timer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    loadMapPreview() {
        const mapDiv = document.getElementById('map-preview');
        
        if (this.location.lat) {
            const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${this.location.lat},${this.location.lng}&zoom=15&size=400x200&markers=color:red%7C${this.location.lat},${this.location.lng}&key=YOUR_KEY`;
            
            mapDiv.innerHTML = `<img src="${staticMapUrl}" alt="Localização" style="width:100%;border-radius:10px;">`;
        } else {
            mapDiv.innerHTML = '<p>Localização não disponível</p>';
        }
    }
    
    async updateLocation() {
        const newLocation = await this.getPreciseLocation();
        this.location = newLocation;
        
        // Atualizar display
        document.getElementById('location-text').textContent = 
            `${newLocation.lat.toFixed(4)}, ${newLocation.lng.toFixed(4)}`;
        
        // Recarregar mapa
        this.loadMapPreview();
        
        // Reenviar alertas com nova localização
        this.sendLocationUpdate();
    }
    
    sendLocationUpdate() {
        const user = JSON.parse(localStorage.getItem('chega_user'));
        const updateMessage = `📍 ATUALIZAÇÃO: ${user.name} está agora em: https://maps.google.com/?q=${this.location.lat},${this.location.lng}`;
        
        // Enviar para contatos
        user.emergencyContacts.forEach(contact => {
            this.sendSMS(contact.phone, updateMessage);
        });
    }
    
    sendAdditionalAlert() {
        const user = JSON.parse(localStorage.getItem('chega_user'));
        const extraMessage = `🚨 ALERTA EXTRA: ${user.name} ainda precisa de ajuda! Local atual: https://maps.google.com/?q=${this.location.lat},${this.location.lng}`;
        
        user.emergencyContacts.forEach(contact => {
            this.sendSMS(contact.phone, extraMessage);
        });
        
        // Feedback visual
        document.getElementById('alerts-sent').textContent = 
            `${this.alertsSent.length + 1} enviados`;
    }
    
    async cancelEmergency() {
        // Confirmar cancelamento
        if (!confirm('Tem certeza que está segura? Esta ação será registrada.')) {
            return;
        }
        
        // Parar todos os efeitos
        this.stopEmergencyEffects();
        
        // Registrar fim da emergência
        await this.logEmergencyEnd();
        
        // Notificar contatos
        this.sendAllClear();
        
        // Redirecionar para dashboard
        window.location.href = 'index.html?emergency_cancelled=true';
    }
    
    stopEmergencyEffects() {
        // Parar animações
        document.body.style.animation = '';
        
        // Remover overlay
        const overlay = document.getElementById('sos-overlay');
        if (overlay) overlay.remove();
        
        // Parar sirene
        if (this.effects.sound) {
            this.effects.sound.oscillator.stop();
            this.effects.sound.audioContext.close();
        }
        
        // Parar vibração
        if (navigator.vibrate) navigator.vibrate(0);
        
        // Desligar lanterna
        this.toggleTorch(false);
        document.body.style.filter = '';
        
        // Liberar tela
        document.exitFullscreen?.();
        
        if (this.wakeLock) this.wakeLock.release();
    }
    
    async logEmergencyEnd() {
        const emergencyLog = {
            start: this.startTime,
            end: new Date(),
            duration: (new Date() - this.startTime) / 1000,
            location: this.location,
            alertsSent: this.alertsSent.length,
            cancelledByUser: true
        };
        
        // Salvar no histórico
        const history = JSON.parse(localStorage.getItem('chega_emergency_history') || '[]');
        history.push(emergencyLog);
        localStorage.setItem('chega_emergency_history', JSON.stringify(history));
        
        // Enviar para análise (anonimizado)
        this.sendAnalytics('emergency_ended', emergencyLog);
    }
    
    sendAllClear() {
        const user = JSON.parse(localStorage.getItem('chega_user'));
        const message = `✅ TUDO BEM: ${user.name} cancelou o alerta de emergência. Ela está segura agora.`;
        
        user.emergencyContacts.forEach(contact => {
            this.sendSMS(contact.phone, message);
        });
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.emergencySystem = new EmergencySystem();
});