// trip.js - Sistema de Acompanhamento de Trajeto

class TripManager {
    constructor() {
        this.trip = null;
        this.watchId = null;
        this.checkpoints = [];
        this.startTime = null;
        
        this.init();
    }
    
    init() {
        this.loadSavedTrip();
        this.setupUI();
        this.startTracking();
    }
    
    loadSavedTrip() {
        const saved = localStorage.getItem('chega_current_trip');
        if (saved) {
            this.trip = JSON.parse(saved);
            this.checkpoints = this.trip.checkpoints || [];
            this.startTime = new Date(this.trip.startTime);
            this.updateUI();
        }
    }
    
    setupUI() {
        // Atualizar timer
        setInterval(() => this.updateTimer(), 1000);
        
        // Configurar botões
        document.getElementById('startTripBtn')?.addEventListener('click', () => this.startNewTrip());
        document.getElementById('endTripBtn')?.addEventListener('click', () => this.endTrip());
        document.getElementById('pauseTripBtn')?.addEventListener('click', () => this.togglePause());
        document.getElementById('shareLocationBtn')?.addEventListener('click', () => this.shareCurrentLocation());
    }
    
    async startNewTrip(destination = null, duration = 60) {
        if (this.trip?.active) {
            if (!confirm('Já existe um trajeto ativo. Deseja iniciar um novo?')) {
                return;
            }
            await this.endTrip();
        }
        
        try {
            const position = await this.getCurrentPosition();
            
            this.trip = {
                id: Date.now(),
                startTime: new Date().toISOString(),
                startLocation: {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                },
                destination: destination,
                maxDuration: duration, // em minutos
                active: true,
                paused: false,
                checkpoints: [],
                sharedWith: this.getEmergencyContacts(),
                estimatedArrival: this.calculateETA(duration)
            };
            
            this.startTime = new Date();
            this.checkpoints = [];
            
            this.saveTrip();
            this.startTracking();
            this.notifyTripStart();
            
            this.updateUI();
            this.showToast('Trajeto iniciado! Seus contatos foram notificados.', 'success');
            
        } catch (error) {
            console.error('Erro ao iniciar trajeto:', error);
            this.showToast('Não foi possível obter localização. Verifique as permissões.', 'error');
        }
    }
    
    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
    }
    
    startTracking() {
        if (!this.trip?.active || this.trip.paused) return;
        
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.onPositionUpdate(position),
            (error) => this.onPositionError(error),
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
                distanceFilter: 10 // metros
            }
        );
        
        // Verificar segurança periodicamente
        this.safetyCheckInterval = setInterval(() => this.performSafetyCheck(), 60000); // 1 minuto
    }
    
    onPositionUpdate(position) {
        if (!this.trip?.active) return;
        
        const checkpoint = {
            timestamp: new Date().toISOString(),
            location: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                speed: position.coords.speed,
                heading: position.coords.heading
            },
            battery: this.getBatteryInfo()
        };
        
        this.checkpoints.push(checkpoint);
        this.trip.checkpoints = this.checkpoints;
        
        // Atualizar UI
        this.updateMap(position);
        this.updateCheckpointList(checkpoint);
        
        // Verificar se chegou ao destino
        if (this.trip.destination) {
            const distance = this.calculateDistance(
                checkpoint.location,
                this.trip.destination
            );
            
            if (distance < 100) { // 100 metros
                this.arriveAtDestination();
            }
        }
        
        // Verificar tempo excessivo
        const elapsed = (new Date() - this.startTime) / 60000; // minutos
        if (elapsed > this.trip.maxDuration) {
            this.checkExtendedTrip();
        }
        
        // Salvar periodicamente
        if (this.checkpoints.length % 5 === 0) {
            this.saveTrip();
        }
    }
    
    updateMap(position) {
        const mapElement = document.getElementById('tripMap');
        if (!mapElement) return;
        
        // Simplificado - na prática usar API de mapas
        mapElement.innerHTML = `
            <div class="map-placeholder">
                <p>📍 Localização atual:</p>
                <p>Lat: ${position.coords.latitude.toFixed(6)}</p>
                <p>Lng: ${position.coords.longitude.toFixed(6)}</p>
                <p>Precisão: ${Math.round(position.coords.accuracy)}m</p>
                ${position.coords.speed ? `<p>Velocidade: ${(position.coords.speed * 3.6).toFixed(1)} km/h</p>` : ''}
            </div>
        `;
    }
    
    updateCheckpointList(checkpoint) {
        const listElement = document.getElementById('checkpointList');
        if (!listElement) return;
        
        const time = new Date(checkpoint.timestamp).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const item = document.createElement('li');
        item.className = 'checkpoint-item';
        item.innerHTML = `
            <span class="checkpoint-time">${time}</span>
            <span class="checkpoint-location">
                📍 ${checkpoint.location.lat.toFixed(4)}, ${checkpoint.location.lng.toFixed(4)}
            </span>
            <span class="checkpoint-status">✅</span>
        `;
        
        listElement.prepend(item);
        
        // Manter apenas últimos 20 checkpoints visíveis
        const items = listElement.querySelectorAll('.checkpoint-item');
        if (items.length > 20) {
            items[items.length - 1].remove();
        }
    }
    
    updateTimer() {
        if (!this.trip?.active || this.trip.paused) return;
        
        const now = new Date();
        const elapsed = Math.floor((now - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        const timerElement = document.getElementById('tripTimer');
        if (timerElement) {
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Atualizar distância percorrida
        this.updateDistance();
    }
    
    updateDistance() {
        if (this.checkpoints.length < 2) return;
        
        let totalDistance = 0;
        for (let i = 1; i < this.checkpoints.length; i++) {
            const dist = this.calculateDistance(
                this.checkpoints[i-1].location,
                this.checkpoints[i].location
            );
            totalDistance += dist;
        }
        
        const distanceElement = document.getElementById('tripDistance');
        if (distanceElement) {
            if (totalDistance < 1000) {
                distanceElement.textContent = `${Math.round(totalDistance)}m`;
            } else {
                distanceElement.textContent = `${(totalDistance / 1000).toFixed(1)}km`;
            }
        }
    }
    
    calculateDistance(point1, point2) {
        const R = 6371e3; // metros
        const φ1 = point1.lat * Math.PI / 180;
        const φ2 = point2.lat * Math.PI / 180;
        const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
        const Δλ = (point2.lng - point1.lng) * Math.PI / 180;
        
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c;
    }
    
    calculateETA(minutes) {
        const eta = new Date();
        eta.setMinutes(eta.getMinutes() + minutes);
        return eta.toISOString();
    }
    
    async endTrip(reason = 'manual') {
        if (!this.trip?.active) return;
        
        this.trip.active = false;
        this.trip.endTime = new Date().toISOString();
        this.trip.endReason = reason;
        
        // Parar tracking
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        if (this.safetyCheckInterval) {
            clearInterval(this.safetyCheckInterval);
        }
        
        // Notificar contatos se chegou bem
        if (reason === 'arrived') {
            await this.notifyArrival();
        }
        
        // Salvar no histórico
        await this.saveTripHistory();
        
        // Limpar trajeto atual
        localStorage.removeItem('chega_current_trip');
        this.trip = null;
        this.checkpoints = [];
        
        this.updateUI();
        this.showToast('Trajeto finalizado!', 'success');
        
        // Redirecionar após 3 segundos
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    }
    
    togglePause() {
        if (!this.trip) return;
        
        this.trip.paused = !this.trip.paused;
        
        if (this.trip.paused) {
            if (this.watchId) {
                navigator.geolocation.clearWatch(this.watchId);
                this.watchId = null;
            }
            this.showToast('Trajeto pausado', 'warning');
        } else {
            this.startTracking();
            this.showToast('Trajeto retomado', 'success');
        }
        
        this.saveTrip();
        this.updateUI();
    }
    
    async shareCurrentLocation() {
        try {
            const position = await this.getCurrentPosition();
            const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            const message = `📍 Estou aqui: https://maps.google.com/?q=${location.lat},${location.lng}`;
            
            if (navigator.share) {
                await navigator.share({
                    title: 'Minha Localização - CHEGA!',
                    text: message
                });
            } else {
                // Fallback para copiar
                await navigator.clipboard.writeText(message);
                this.showToast('Localização copiada!', 'success');
            }
            
        } catch (error) {
            console.error('Erro ao compartilhar:', error);
            this.showToast('Não foi possível compartilhar a localização', 'error');
        }
    }
    
    notifyTripStart() {
        if (!this.trip?.sharedWith || this.trip.sharedWith.length === 0) return;
        
        const message = `📍 ${this.getUserName()} iniciou um trajeto. Chegada estimada: ${this.formatETA()}`;
        
        this.trip.sharedWith.forEach(contact => {
            this.sendAlert(contact, message);
        });
    }
    
    async notifyArrival() {
        if (!this.trip?.sharedWith || this.trip.sharedWith.length === 0) return;
        
        const message = `✅ ${this.getUserName()} chegou em segurança!`;
        
        for (const contact of this.trip.sharedWith) {
            await this.sendAlert(contact, message);
        }
    }
    
    performSafetyCheck() {
        if (!this.trip?.active || this.trip.paused) return;
        
        // Verificar se está se movendo
        if (this.checkpoints.length >= 2) {
            const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];
            const prevCheckpoint = this.checkpoints[this.checkpoints.length - 2];
            
            const timeDiff = (new Date(lastCheckpoint.timestamp) - new Date(prevCheckpoint.timestamp)) / 1000; // segundos
            const distance = this.calculateDistance(prevCheckpoint.location, lastCheckpoint.location);
            
            // Se não se moveu em 5 minutos
            if (timeDiff > 300 && distance < 10) {
                this.checkStationary();
            }
        }
        
        // Verificar bateria
        this.checkBattery();
    }
    
    checkStationary() {
        this.showToast('Você está parado há muito tempo. Está tudo bem?', 'warning');
        
        // Enviar notificação para contatos se continuar parado
        setTimeout(() => {
            if (this.trip?.active && !this.trip.paused) {
                const stationaryMessage = `⚠️ ${this.getUserName()} está parado há mais de 10 minutos. Última localização: https://maps.google.com/?q=${this.checkpoints[this.checkpoints.length-1].location.lat},${this.checkpoints[this.checkpoints.length-1].location.lng}`;
                
                this.trip.sharedWith.forEach(contact => {
                    this.sendAlert(contact, stationaryMessage);
                });
            }
        }, 300000); // 5 minutos
    }
    
    checkBattery() {
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                if (battery.level < 0.2) { // 20%
                    this.showToast('⚠️ Bateria baixa! Carregue o celular.', 'warning');
                }
                if (battery.level < 0.1) { // 10%
                    const batteryMessage = `🔋 ${this.getUserName()} está com bateria crítica (${Math.round(battery.level * 100)}%).`;
                    this.trip.sharedWith.forEach(contact => {
                        this.sendAlert(contact, batteryMessage);
                    });
                }
            });
        }
    }
    
    checkExtendedTrip() {
        this.showToast('Trajeto está demorando mais que o esperado. Está tudo bem?', 'warning');
        
        const extendedMessage = `⏰ ${this.getUserName()} está em trânsito há mais tempo que o esperado.`;
        this.trip.sharedWith.forEach(contact => {
            this.sendAlert(contact, extendedMessage);
        });
    }
    
    arriveAtDestination() {
        this.showToast('🎉 Você chegou ao destino!', 'success');
        this.endTrip('arrived');
    }
    
    // Métodos auxiliares
    getEmergencyContacts() {
        const user = JSON.parse(localStorage.getItem('chega_user') || '{}');
        return user.emergencyContacts || [];
    }
    
    getUserName() {
        const user = JSON.parse(localStorage.getItem('chega_user') || '{}');
        return user.name || 'Usuária';
    }
    
    formatETA() {
        if (!this.trip?.estimatedArrival) return 'desconhecida';
        const eta = new Date(this.trip.estimatedArrival);
        return eta.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    
    getBatteryInfo() {
        if ('getBattery' in navigator) {
            return navigator.getBattery().then(battery => ({
                level: battery.level,
                charging: battery.charging
            }));
        }
        return null;
    }
    
    async sendAlert(contact, message) {
        // Implementação simplificada
        console.log(`Enviando para ${contact.name}: ${message}`);
        
        // Na prática, enviaria SMS ou notificação
        try {
            if ('sms' in navigator) {
                await navigator.sms.send({
                    number: contact.phone,
                    text: message
                });
            }
        } catch (error) {
            console.error('Erro ao enviar alerta:', error);
        }
    }
    
    saveTrip() {
        if (this.trip) {
            localStorage.setItem('chega_current_trip', JSON.stringify(this.trip));
        }
    }
    
    async saveTripHistory() {
        if (!this.trip) return;
        
        const history = JSON.parse(localStorage.getItem('chega_trip_history') || '[]');
        history.push({
            ...this.trip,
            totalCheckpoints: this.checkpoints.length,
            totalDistance: this.calculateTotalDistance()
        });
        
        localStorage.setItem('chega_trip_history', JSON.stringify(history));
    }
    
    calculateTotalDistance() {
        if (this.checkpoints.length < 2) return 0;
        
        let total = 0;
        for (let i = 1; i < this.checkpoints.length; i++) {
            total += this.calculateDistance(
                this.checkpoints[i-1].location,
                this.checkpoints[i].location
            );
        }
        return total;
    }
    
    updateUI() {
        // Atualizar elementos da UI baseados no estado do trajeto
        const startBtn = document.getElementById('startTripBtn');
        const endBtn = document.getElementById('endTripBtn');
        const pauseBtn = document.getElementById('pauseTripBtn');
        const statusElement = document.getElementById('tripStatus');
        
        if (this.trip?.active) {
            if (startBtn) startBtn.style.display = 'none';
            if (endBtn) endBtn.style.display = 'block';
            if (pauseBtn) {
                pauseBtn.style.display = 'block';
                pauseBtn.textContent = this.trip.paused ? '▶️ Retomar' : '⏸️ Pausar';
            }
            if (statusElement) {
                statusElement.textContent = this.trip.paused ? '⏸️ Pausado' : '📍 Em andamento';
                statusElement.className = this.trip.paused ? 'status paused' : 'status active';
            }
        } else {
            if (startBtn) startBtn.style.display = 'block';
            if (endBtn) endBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (statusElement) {
                statusElement.textContent = '🚀 Pronto para iniciar';
                statusElement.className = 'status ready';
            }
        }
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
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.tripManager = new TripManager();
});