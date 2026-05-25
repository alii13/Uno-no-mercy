<template>
  <div class="landing-container">
    <div class="scan-line"></div>
    <div class="noise-overlay"></div>
    
    <!-- Animated Background Grid -->
    <div class="grid-bg"></div>
    
    <!-- Danger Tape Top -->
    <div class="danger-tape top">
      <div class="tape-content">
        <span v-for="i in 20" :key="i">// NO MERCY ZONE // ENTER AT YOUR OWN RISK //</span>
      </div>
    </div>
    
    <!-- Main Content - Split Layout -->
    <main class="landing-main">
      <!-- Left Side - Branding -->
      <div class="brand-section">
        <h1 class="title glitch-text" data-text="UNO">UNO</h1>
        <h2 class="subtitle">NO MERCY</h2>
        <p class="tagline">THE RUTHLESS CARD BATTLE</p>
        
        <!-- Status Display -->
        <div class="status-display">
          <div class="status-line">
            <span class="blink">▶</span> SYSTEM: <span class="online">ONLINE</span>
          </div>
          <div class="status-line">
            <span class="blink">▶</span> THREAT LEVEL: <span class="critical">MAXIMUM</span>
          </div>
        </div>
      </div>
      
      <!-- Right Side - Actions -->
      <div class="action-section">
        <div class="action-card">
          <h3 class="card-title">JOIN THE BATTLE</h3>
          
          <button @click="$emit('playGuest')" class="action-btn primary">
            PLAY NOW
          </button>

          <button @click="$emit('showAuth', 'signup')" class="action-btn secondary">
            CREATE ACCOUNT
          </button>

          <button @click="$emit('showAuth', 'login')" class="action-btn tertiary">
            RETURNING PLAYER
          </button>

          <div class="separator"></div>
          
          <!-- Features List -->
          <div class="features-list">
            <div class="feature-item">
              <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span class="feature-text">Real-time Multiplayer</span>
            </div>
            <div class="feature-item">
              <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="11"/><circle cx="8" cy="16" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/></svg>
              <span class="feature-text">VS Ruthless AI</span>
            </div>
            <div class="feature-item">
              <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              <span class="feature-text">Stack Draws & Skip Everyone</span>
            </div>
          </div>
        </div>
      </div>
    </main>
    
    <!-- Hazard Bar Bottom -->
    <div class="hazard-bar">
      <div class="hazard-stripe"></div>
      <p class="warning-text">// WARNING: FRIENDSHIPS MAY NOT SURVIVE //</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'showAuth', mode: 'login' | 'signup'): void
  (e: 'playGuest'): void
}>()
</script>

<style scoped>
.landing-container {
  min-height: 100vh;
  background: var(--bg-concrete);
  color: var(--text-primary);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.scan-line {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.2) 51%);
  background-size: 100% 4px;
  pointer-events: none;
  z-index: 100;
}

.noise-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 99;
  opacity: 0.4;
}

/* Grid Background */
.grid-bg {
  position: fixed;
  inset: 0;
  background: 
    repeating-linear-gradient(90deg, transparent, transparent 80px, rgba(255, 42, 42, 0.03) 80px, rgba(255, 42, 42, 0.03) 81px),
    repeating-linear-gradient(0deg, transparent, transparent 80px, rgba(255, 42, 42, 0.03) 80px, rgba(255, 42, 42, 0.03) 81px);
  pointer-events: none;
  z-index: 0;
}

/* Danger Tape */
.danger-tape {
  background: repeating-linear-gradient(-45deg, var(--color-alert), var(--color-alert) 10px, #000 10px, #000 20px);
  padding: 6px 0;
  overflow: hidden;
  position: relative;
  z-index: 10;
}

.tape-content {
  display: flex;
  white-space: nowrap;
  animation: scroll-tape 30s linear infinite;
  font-family: var(--font-body);
  font-size: 0.7rem;
  color: white;
  letter-spacing: 2px;
}

.tape-content span {
  padding: 0 2rem;
}

@keyframes scroll-tape {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

/* Main Content - Split Layout */
.landing-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  padding: 4rem;
  align-items: center;
  position: relative;
  z-index: 5;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

/* Brand Section */
.brand-section {
  text-align: left;
}

.title {
  font-family: var(--font-display);
  font-size: 8rem;
  margin: 0;
  line-height: 0.9;
  text-shadow: var(--shadow-glow-red);
}

.subtitle {
  font-family: var(--font-display);
  font-size: 3rem;
  color: var(--color-alert);
  margin: 0.5rem 0 1rem 0;
  text-shadow: var(--shadow-glow-red);
}

.tagline {
  color: var(--text-muted);
  font-size: 1rem;
  letter-spacing: 0.3rem;
  margin: 0 0 2rem 0;
}

.status-display {
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--text-muted);
}

.status-line {
  margin: 0.5rem 0;
}

.blink {
  animation: blink 1s step-end infinite;
  color: var(--color-neon-green);
}

@keyframes blink {
  50% { opacity: 0; }
}

.online {
  color: var(--color-neon-green);
  font-weight: bold;
}

.critical {
  color: var(--color-alert);
  font-weight: bold;
  animation: critical-pulse 1s ease-in-out infinite;
}

@keyframes critical-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* Action Section */
.action-section {
  display: flex;
  justify-content: center;
}

.action-card {
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid #333;
  padding: 3rem;
  width: 100%;
  max-width: 400px;
}

.card-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  margin: 0 0 2rem 0;
  text-align: center;
  color: var(--color-hazard);
}

.action-btn {
  width: 100%;
  padding: 1.2rem 2rem;
  font-family: var(--font-display);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  transition: all 0.3s;
  margin-bottom: 1rem;
}

.action-btn.primary {
  background: linear-gradient(145deg, var(--color-alert) 0%, var(--color-alert-dim) 100%);
  border: 2px solid var(--color-alert);
  color: white;
}

.action-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow-red);
}

.action-btn.secondary {
  background: transparent;
  border: 2px solid var(--color-neon-blue);
  color: var(--color-neon-blue);
}

.action-btn.secondary:hover {
  background: var(--color-neon-blue);
  color: black;
  transform: translateY(-2px);
}

.action-btn.tertiary {
  background: transparent;
  border: 1px solid #444;
  color: var(--text-muted);
}

.action-btn.tertiary:hover {
  border-color: var(--text-secondary);
  color: var(--text-primary);
  transform: translateY(-2px);
}

.btn-icon {
  font-size: 1.2rem;
}

.separator {
  height: 1px;
  background: linear-gradient(90deg, transparent, #333, transparent);
  margin: 2rem 0;
}

/* Features List */
.features-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.feature-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--color-neon-blue);
}

/* Hazard Bar */
.hazard-bar {
  position: relative;
  z-index: 10;
}

.hazard-stripe {
  height: 16px;
  background: repeating-linear-gradient(-45deg, var(--color-hazard), var(--color-hazard) 10px, #000 10px, #000 20px);
}

.warning-text {
  font-family: var(--font-body);
  font-size: 0.8rem;
  text-align: center;
  color: var(--color-alert);
  background: var(--bg-concrete);
  margin: 0;
  padding: 0.75rem;
  letter-spacing: 2px;
}

/* Responsive */
@media (max-width: 900px) {
  .landing-main {
    grid-template-columns: 1fr;
    text-align: center;
    padding: 2rem;
    gap: 2rem;
  }
  
  .brand-section {
    text-align: center;
  }
  
  .title { font-size: 5rem; }
  .subtitle { font-size: 2rem; }
  .action-card { max-width: 100%; }
}

@media (max-width: 500px) {
  .title { font-size: 3.5rem; }
  .subtitle { font-size: 1.5rem; }
  .tagline { letter-spacing: 0.1rem; font-size: 0.8rem; }

  .action-card {
    padding: 1.5rem;
  }

  .action-btn {
    padding: 1rem;
    font-size: 0.9rem;
  }
}

@media (max-width: 375px) {
  .landing-main {
    padding: 1rem;
    gap: 1rem;
  }

  .title { font-size: 2.8rem; }
  .subtitle { font-size: 1.2rem; }
  .tagline { font-size: 0.7rem; }

  .action-card {
    padding: 1rem;
  }

  .card-title {
    font-size: 1.2rem;
    margin-bottom: 1rem;
  }

  .feature-item {
    font-size: 0.8rem;
  }
}
</style>
