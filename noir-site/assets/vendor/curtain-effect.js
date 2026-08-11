/**
 * Curtain Opening Effect - Reusable JavaScript
 * Created for IISF 2025 - Can be used on any website
 * Author: Tulsiram Kushwah
 * LinkedIn: https://www.linkedin.com/in/tulsiram-kushwah-software-engineer/
 * Facebook: https://www.facebook.com/ramp00786
 * Version: 1.0
 * 
 * Dependencies: None (Pure JavaScript)
 * Usage: Include this file and call CurtainEffect.init(options)
 */

const CurtainEffect = {
    // Default configuration
    defaultOptions: {
        title: 'Welcome',
        subtitle: 'Click to Enter',
        buttonText: 'Open Curtains',
        theme: 'default', // default, royal, elegant, gold
        autoOpen: false,
        autoOpenDelay: 5000,
        sparkles: true,
        sound: false,
        speed: 2000, // Animation duration in milliseconds (default: 2000ms = 2s)
        leftCurtainImage: '', // Path to left curtain image
        rightCurtainImage: '', // Path to right curtain image
        onOpen: null,
        onComplete: null
    },

    // Current configuration
    options: {},

    // DOM elements
    elements: {
        container: null,
        leftPanel: null,
        rightPanel: null,
        button: null,
        title: null,
        subtitle: null,
        sparklesContainer: null
    },

    // State
    isOpen: false,
    isAnimating: false,

    /**
     * Initialize the curtain effect
     * @param {Object} userOptions - Configuration options
     */
    // init(userOptions = {}) {
    //     this.options = { ...this.defaultOptions, ...userOptions };
    //     this.createCurtainHTML();
    //     this.applyCurtainImages(); // Apply custom images if provided
    //     this.bindEvents();
    //     this.startSparkles();

    //     if (this.options.autoOpen) {
    //         setTimeout(() => {
    //             this.openCurtains();
    //         }, this.options.autoOpenDelay);
    //     }

    //     // Hide body scrollbar when curtains are closed
    //     document.body.style.overflow = 'hidden';

    //     console.log('🎭 Curtain Effect initialized successfully!');
    //     if (this.options.leftCurtainImage || this.options.rightCurtainImage) {
    //         console.log('🖼️ Custom curtain images applied');
    //     }
    // },

    init(userOptions = {}) {
        // ✅ FIRST: Destroy any existing curtain instance
        if (this.elements.container) {
            console.log('🎭 Destroying previous curtain instance...');
            this.destroy();
        }

        // ✅ RESET: Clear all state
        this.isOpen = false;
        this.isAnimating = false;

        // ✅ NOW: Initialize new curtain
        this.options = { ...this.defaultOptions, ...userOptions };
        this.createCurtainHTML();
        this.applyCurtainImages();
        this.bindEvents(); // This will bind to the NEW button
        this.startSparkles();

        if (this.options.autoOpen) {
            setTimeout(() => {
                this.openCurtains();
            }, this.options.autoOpenDelay);
        }

        // Hide body scrollbar when curtains are closed
        document.body.style.overflow = 'hidden';

        console.log('🎭 Curtain Effect initialized successfully!');
        if (this.options.leftCurtainImage || this.options.rightCurtainImage) {
            console.log('🖼️ Custom curtain images applied');
        }
    },

    /**
     * Create the curtain HTML structure
     */
    createCurtainHTML() {
        // Create main container
        const container = document.createElement('div');
        container.className = `curtain-container active ${this.options.theme !== 'default' ? 'curtain-theme-' + this.options.theme : ''}`;
        container.id = 'curtainContainer';

        // Create curtain HTML
        container.innerHTML = `
            <!-- Left Curtain Panel -->
            <div class="curtain-panel curtain-left" id="curtainLeft"></div>
            
            <!-- Right Curtain Panel -->
            <div class="curtain-panel curtain-right" id="curtainRight"></div>
            
            <!-- Content Box -->
            <div class="curtain-content-box" id="curtainContentBox">
                <!-- Curtain Title -->
                <div class="curtain-title" id="curtainTitle">${this.options.title}</div>
                
                <!-- Curtain Subtitle -->
                <div class="curtain-subtitle" id="curtainSubtitle">${this.options.subtitle}</div>
                
                <!-- Open Button -->
                <button class="curtain-open-btn" id="curtainOpenBtn">
                    <i class="fas fa-magic" style="margin-right: 10px;"></i>
                    ${this.options.buttonText}
                </button>
            </div>
            
            <!-- Sparkles Container -->
            <div class="curtain-sparkles" id="curtainSparkles"></div>
        `;

        // Add to body
        document.body.appendChild(container);

        // Store element references
        this.elements.container = container;
        this.elements.leftPanel = document.getElementById('curtainLeft');
        this.elements.rightPanel = document.getElementById('curtainRight');
        this.elements.contentBox = document.getElementById('curtainContentBox');
        this.elements.button = document.getElementById('curtainOpenBtn');
        this.elements.title = document.getElementById('curtainTitle');
        this.elements.subtitle = document.getElementById('curtainSubtitle');
        this.elements.sparklesContainer = document.getElementById('curtainSparkles');

        // Apply speed setting to curtain panels
        this.applySpeedSetting();
    },

    /**
     * Apply custom curtain images if provided
     */
    applyCurtainImages() {
        // Apply left curtain image
        if (this.options.leftCurtainImage && this.options.leftCurtainImage.trim() !== '') {
            this.elements.leftPanel.style.backgroundImage = `url('${this.options.leftCurtainImage}')`;
            this.elements.leftPanel.style.backgroundSize = 'cover';
            this.elements.leftPanel.style.backgroundPosition = 'center';
            this.elements.leftPanel.style.backgroundRepeat = 'no-repeat';
            console.log('🖼️ Left curtain image applied:', this.options.leftCurtainImage);
        }

        // Apply right curtain image
        if (this.options.rightCurtainImage && this.options.rightCurtainImage.trim() !== '') {
            this.elements.rightPanel.style.backgroundImage = `url('${this.options.rightCurtainImage}')`;
            this.elements.rightPanel.style.backgroundSize = 'cover';
            this.elements.rightPanel.style.backgroundPosition = 'center';
            this.elements.rightPanel.style.backgroundRepeat = 'no-repeat';
            console.log('🖼️ Right curtain image applied:', this.options.rightCurtainImage);
        }
    },

    /**
     * Apply speed setting to curtain panels
     */
    applySpeedSetting() {
        const speedInSeconds = this.options.speed / 1000;
        const transitionValue = `transform ${speedInSeconds}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;

        // Apply transition to both curtain panels
        if (this.elements.leftPanel) {
            this.elements.leftPanel.style.transition = transitionValue;
        }
        if (this.elements.rightPanel) {
            this.elements.rightPanel.style.transition = transitionValue;
        }

        console.log(`🎭 Curtain speed set to ${this.options.speed}ms (${speedInSeconds}s)`);
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Button click event
        this.elements.button.addEventListener('click', () => {
            this.openCurtains();
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                if (!this.isOpen && !this.isAnimating) {
                    e.preventDefault();
                    this.openCurtains();
                }
            }
            if (e.code === 'Escape') {
                if (!this.isOpen && !this.isAnimating) {
                    this.openCurtains();
                }
            }
        });

        // Prevent body scroll when curtains are active
        this.elements.container.addEventListener('wheel', (e) => {
            e.preventDefault();
        }, { passive: false });

        this.elements.container.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
    },

    /**
     * Open the curtains with animation
     */
    openCurtains() {
        if (this.isAnimating || this.isOpen) return;

        this.isAnimating = true;

        // Trigger callback
        if (typeof this.options.onOpen === 'function') {
            this.options.onOpen();
        }

        // Play sound if enabled
        if (this.options.sound) {
            this.playSound();
        }

        // Add opening class to trigger CSS animation
        this.elements.container.classList.add('opening');

        // Button pulse effect before disappearing
        this.elements.button.style.animation = 'pulse 0.5s ease-in-out';

        // Wait for animation to complete (use dynamic speed)
        setTimeout(() => {
            this.isOpen = true;
            this.isAnimating = false;

            // Hide the entire curtain container
            this.elements.container.classList.add('revealed');

            // Remove from DOM after fade out
            setTimeout(() => {
                if (this.elements.container.parentNode) {
                    this.elements.container.parentNode.removeChild(this.elements.container);
                }

                // Trigger completion callback
                if (typeof this.options.onComplete === 'function') {
                    this.options.onComplete();
                }

                // Re-enable body scroll
                document.body.style.overflow = '';

                console.log('🎭 Curtains opened successfully!');
            }, 1000);

        }, this.options.speed);

        // Disable body scroll initially
        document.body.style.overflow = 'hidden';
    },

    /**
     * Start sparkle animation
     */
    startSparkles() {
        if (!this.options.sparkles) return;

        const createSparkle = () => {
            if (this.isOpen) return;

            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.style.left = Math.random() * 100 + '%';
            sparkle.style.animationDelay = Math.random() * 2 + 's';
            sparkle.style.animationDuration = (Math.random() * 3 + 2) + 's';

            this.elements.sparklesContainer.appendChild(sparkle);

            // Remove sparkle after animation
            setTimeout(() => {
                if (sparkle.parentNode) {
                    sparkle.parentNode.removeChild(sparkle);
                }
            }, 5000);
        };

        // Create sparkles at intervals
        const sparkleInterval = setInterval(() => {
            if (this.isOpen) {
                clearInterval(sparkleInterval);
                return;
            }
            createSparkle();
        }, 300);

        // Initial sparkles
        for (let i = 0; i < 5; i++) {
            setTimeout(createSparkle, i * 100);
        }
    },

    /**
     * Play opening sound effect
     */
    playSound() {
        try {
            // Create audio element for clapping sound
            const audio = new Audio('curtain-assets/sounds/clapping.wav');
            audio.volume = 0.7; // Set volume to 70%
            audio.currentTime = 0; // Start from beginning

            // Play the sound
            const playPromise = audio.play();

            // Handle play promise for modern browsers
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('🎵 Clapping sound playing successfully');
                    })
                    .catch(error => {
                        console.log('🎵 Sound autoplay prevented by browser:', error);
                        // Fallback: try to play after user interaction
                        document.addEventListener('click', () => {
                            audio.play().catch(e => console.log('🎵 Sound play failed:', e));
                        }, { once: true });
                    });
            }
        } catch (error) {
            console.log('🎵 Sound loading failed:', error);
            console.log('🎵 Make sure clapping.wav exists in curtain-assets/sounds/ directory');
        }
    },

    /**
     * Set custom title
     * @param {string} title - New title text
     */
    setTitle(title) {
        if (this.elements.title) {
            this.elements.title.textContent = title;
        }
    },

    /**
     * Set custom subtitle
     * @param {string} subtitle - New subtitle text
     */
    setSubtitle(subtitle) {
        if (this.elements.subtitle) {
            this.elements.subtitle.textContent = subtitle;
        }
    },

    /**
     * Set custom button text
     * @param {string} buttonText - New button text
     */
    setButtonText(buttonText) {
        if (this.elements.button) {
            this.elements.button.innerHTML = `
                <i class="fas fa-magic" style="margin-right: 10px;"></i>
                ${buttonText}
            `;
        }
    },

    /**
     * Set custom curtain images
     * @param {string} leftImage - Path to left curtain image
     * @param {string} rightImage - Path to right curtain image
     */
    setCurtainImages(leftImage, rightImage) {
        this.options.leftCurtainImage = leftImage || '';
        this.options.rightCurtainImage = rightImage || '';
        this.applyCurtainImages();
    },

    /**
     * Change theme
     * @param {string} theme - Theme name (default, royal, elegant, gold)
     */
    setTheme(theme) {
        if (this.elements.container) {
            // Remove existing theme classes
            this.elements.container.classList.remove('curtain-theme-royal', 'curtain-theme-elegant', 'curtain-theme-gold');

            // Add new theme class
            if (theme !== 'default') {
                this.elements.container.classList.add('curtain-theme-' + theme);
            }
        }
    },

    /**
     * Force open curtains (for debugging or manual control)
     */
    forceOpen() {
        this.openCurtains();
    },

    /**
     * Check if curtains are currently open
     * @returns {boolean}
     */
    isOpened() {
        return this.isOpen;
    },

    /**
     * Destroy the curtain effect and clean up
     */
    destroy() {
        if (this.elements.container && this.elements.container.parentNode) {
            this.elements.container.parentNode.removeChild(this.elements.container);
        }

        // Reset state
        this.isOpen = false;
        this.isAnimating = false;

        // Re-enable body scroll
        document.body.style.overflow = '';

        console.log('🎭 Curtain Effect destroyed');
    }
};

// Auto-initialization logic
function initializeCurtain() {
    console.log('🎭 Curtain script loading...');

    let initAttempts = 0;
    const maxAttempts = 10;

    function attemptInitialization() {
        initAttempts++;
        console.log(`🎭 Initialization attempt ${initAttempts}/${maxAttempts}`);

        if (typeof CurtainEffect !== 'undefined') {
            console.log('🎭 CurtainEffect found! Initializing...');

            // Check for data attributes first
            const autoInit = document.querySelector('[data-curtain-auto]');
            if (autoInit) {
                const options = {
                    title: autoInit.dataset.curtainTitle || 'Welcome',
                    subtitle: autoInit.dataset.curtainSubtitle || 'Click to Enter',
                    buttonText: autoInit.dataset.curtainButton || 'Open Curtains',
                    theme: autoInit.dataset.curtainTheme || 'default',
                    autoOpen: autoInit.dataset.curtainAuto === 'true',
                    autoOpenDelay: parseInt(autoInit.dataset.curtainDelay) || 5000,
                    sparkles: autoInit.dataset.curtainSparkles !== 'false',
                    sound: autoInit.dataset.curtainSound === 'true',
                    speed: parseInt(autoInit.dataset.curtainSpeed) || 2000,
                    leftCurtainImage: autoInit.dataset.curtainLeftImage || '',
                    rightCurtainImage: autoInit.dataset.curtainRightImage || ''
                };

                CurtainEffect.init(options);
                return;
            }

            // Check if window.curtainConfig exists (set by page)
            if (typeof window.curtainConfig !== 'undefined') {
                console.log('🎭 Using window.curtainConfig settings');
                CurtainEffect.init(window.curtainConfig);
                return;
            }

            // Default initialization if no config found
            console.log('🎭 Using default settings');
            CurtainEffect.init();

        } else {
            console.warn(`🎭 CurtainEffect not loaded yet (attempt ${initAttempts})`);
            if (initAttempts < maxAttempts) {
                setTimeout(attemptInitialization, 500);
            } else {
                console.error('🎭 Failed to load CurtainEffect after multiple attempts. Please check:');
                console.error('   - Is curtain-assets/js/curtain-effect.js accessible?');
                console.error('   - Are there any JavaScript errors preventing the script from loading?');
                console.error('   - Check the browser Network tab for failed requests');
            }
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attemptInitialization);
    } else {
        setTimeout(attemptInitialization, 100);
    }
}

// Auto-start initialization
initializeCurtain();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CurtainEffect;
}

// Make available globally
window.CurtainEffect = CurtainEffect;