// CHEGA! - Sistema Principal
import { Capacitor } from './capacitor-runtime.js';

class ChegaApp {
    constructor() {
        this.user = {
            name: 'Usuária',
            phone: '',
            emergencyContacts: [],
            settings: {
                volumeDetection: true,
                vibration: true,
                sound: true,
                autoSMS: true,
                shareLocation: true
            }
        };
        
        this.location = null;
        this.battery = null;
        this.volumeDetection = null;
        this.emergencyActive = false;
        
        this.init();
    }
    
    async init() {
        console.log('🚀 CHEGA! App inicializando...');
        
        // Carregar dados do usuário
        await this.loadUserData();
        
        // Iniciar serviços
        await this.initServices();
        
        // Configurar interface
        this.initUI();
        
        // Iniciar detecção de volume
        await this.initVolumeDetection();
        
        console.log('✅ CHEGA! App pronto');
    }
    
    async loadUserData() {
        try {
            const saved = localStorage.getItem('chega_user');
            if (saved) {
                this.user = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }
    
    async initServices() {
        // Inicializar localização
        await this.initLocation();
        
        // Monitorar bateria
        await this.initBatteryMonitor();
        
        // Registrar Service Worker
        await this.registerServiceWorker();
    }
    
    async initLocation() {
        if ('geolocation' in navigator) {
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    });
                });
                
                this.location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: new Date()
                };
                
                this.updateUI('locationStatus', 'Ativa ✅');
                
            } catch (error) {
                console.warn('Localização não disponível:', error);
                this.updateUI('locationStatus', 'Inativa ❌');
            }
        }
    }
    
    async initBatteryMonitor() {
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                this.battery = battery;
                
                this.updateBatteryDisplay();
                
                // Monitorar mudanças
                battery.addEventListener('levelchange', () => this.updateBatteryDisplay());
                battery.addEventListener('chargingchange', () => this.updateBatteryDisplay());
                
            } catch (error) {
                console.warn('Monitor de bateria não disponível:', error);
                this.updateUI('batteryStatus', 'N/A');
            }
        } else {
            this.updateUI('batteryStatus', 'N/A');
        }
    }
    
    updateBatteryDisplay() {
        if (this.battery) {
            const level = Math.round(this.battery.level * 100);
            const charging = this.battery.charging ? '⚡' : '';
            const status = `${level}% ${charging}`;
            this.updateUI('batteryStatus', status);
        }
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker
