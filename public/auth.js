/**
 * Authentication client for StarForgeFrontier
 * Handles user login, registration, and guest access
 */

(() => {
  // DOM elements
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const showRegisterBtn = document.getElementById('showRegister');
  const showLoginBtn = document.getElementById('showLogin');
  const guestPlayBtn = document.getElementById('guestPlay');
  const messagesContainer = document.getElementById('messages');

  // Form elements
  const loginFormEl = document.getElementById('login');
  const registerFormEl = document.getElementById('register');

  // Show message helper
  function showMessage(text, type = 'info', duration = 5000) {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    messagesContainer.appendChild(message);
    
    setTimeout(() => {
      message.style.opacity = '0';
      setTimeout(() => message.remove(), 300);
    }, duration);
  }

  // Toggle between login and register forms
  function showLoginForm() {
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
  }

  function showRegisterForm() {
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
  }

  // Form switching
  showRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
  });

  showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });

  // Login form handler
  loginFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = loginFormEl.querySelector('button[type="submit"]');
    
    try {
      submitBtn.disabled = true;
      submitBtn.classList.add('loading');
      
      const formData = new FormData(loginFormEl);
      const credentials = {
        username: formData.get('username'),
        password: formData.get('password')
      };
      
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Store authentication data
        localStorage.setItem('playerId', data.playerId);
        localStorage.setItem('username', data.username);
        localStorage.setItem('sessionToken', data.sessionToken);
        
        showMessage('Welcome back, pilot! Launching...', 'success', 2000);
        
        // Redirect to game after short delay
        setTimeout(() => {
          window.location.href = '/index.html';
        }, 1500);
        
      } else {
        showMessage(data.error || 'Login failed', 'error');
      }
      
    } catch (error) {
      console.error('Login error:', error);
      showMessage('Connection failed. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    }
  });

  // Register form handler
  registerFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = registerFormEl.querySelector('button[type="submit"]');
    
    try {
      submitBtn.disabled = true;
      submitBtn.classList.add('loading');
      
      const formData = new FormData(registerFormEl);
      const password = formData.get('password');
      const confirmPassword = formData.get('confirmPassword');
      
      // Validate password confirmation
      if (password !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
      }
      
      const userData = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: password
      };
      
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showMessage('Account created successfully! Please log in.', 'success');
        
        // Pre-fill login form and switch to it
        document.getElementById('loginUsername').value = userData.username;
        showLoginForm();
        
      } else {
        showMessage(data.error || 'Registration failed', 'error');
      }
      
    } catch (error) {
      console.error('Registration error:', error);
      showMessage('Connection failed. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    }
  });

  // Guest play handler
  guestPlayBtn.addEventListener('click', () => {
    // Generate temporary guest credentials
    const guestId = 'guest-' + Math.random().toString(36).substr(2, 9);
    const guestUsername = 'Guest' + Math.floor(Math.random() * 1000);
    
    // Store guest data
    localStorage.setItem('playerId', guestId);
    localStorage.setItem('username', guestUsername);
    localStorage.setItem('isGuest', 'true');
    
    showMessage('Launching as guest pilot...', 'info', 2000);
    
    setTimeout(() => {
      window.location.href = '/index.html';
    }, 1500);
  });

  // Real-time password validation
  const registerPassword = document.getElementById('registerPassword');
  const confirmPassword = document.getElementById('confirmPassword');
  
  function validatePasswords() {
    const password = registerPassword.value;
    const confirm = confirmPassword.value;
    
    if (confirm && password !== confirm) {
      confirmPassword.setCustomValidity('Passwords do not match');
    } else {
      confirmPassword.setCustomValidity('');
    }
  }
  
  registerPassword.addEventListener('input', validatePasswords);
  confirmPassword.addEventListener('input', validatePasswords);

  // Username validation (real-time)
  const registerUsername = document.getElementById('registerUsername');
  const loginUsername = document.getElementById('loginUsername');
  
  function validateUsername(input) {
    const username = input.value;
    const minLength = 3;
    
    if (username.length > 0 && username.length < minLength) {
      input.setCustomValidity(`Username must be at least ${minLength} characters`);
    } else if (username && !/^[a-zA-Z0-9_-]+$/.test(username)) {
      input.setCustomValidity('Username can only contain letters, numbers, hyphens, and underscores');
    } else {
      input.setCustomValidity('');
    }
  }
  
  registerUsername.addEventListener('input', () => validateUsername(registerUsername));
  loginUsername.addEventListener('input', () => validateUsername(loginUsername));

  // Auto-login if already authenticated
  const storedPlayerId = localStorage.getItem('playerId');
  const storedUsername = localStorage.getItem('username');
  
  if (storedPlayerId && storedUsername) {
    showMessage(`Welcome back, ${storedUsername}!`, 'info', 3000);
    
    // Add quick launch button
    const quickLaunch = document.createElement('div');
    quickLaunch.style.textAlign = 'center';
    quickLaunch.style.marginTop = '20px';
    quickLaunch.innerHTML = `
      <p style="color: rgba(255, 255, 255, 0.7); margin-bottom: 10px;">
        Continue as ${storedUsername}
      </p>
      <button class="auth-btn primary" id="quickLaunch" style="width: auto; padding: 10px 20px;">
        Quick Launch
      </button>
      <br>
      <small style="color: rgba(255, 255, 255, 0.5); margin-top: 10px; display: block;">
        Or use the forms above to switch accounts
      </small>
    `;
    
    document.querySelector('.guest-play').appendChild(quickLaunch);
    
    document.getElementById('quickLaunch').addEventListener('click', () => {
      window.location.href = '/index.html';
    });
  }

  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      // Ctrl+Enter submits the active form
      const activeForm = document.querySelector('.form-container.active form');
      if (activeForm) {
        activeForm.dispatchEvent(new Event('submit'));
      }
    } else if (e.key === 'Tab' && e.altKey) {
      // Alt+Tab switches between forms
      e.preventDefault();
      if (loginForm.classList.contains('active')) {
        showRegisterForm();
      } else {
        showLoginForm();
      }
    }
  });

  // Add loading screen for better UX
  const loadingScreen = document.createElement('div');
  loadingScreen.id = 'loadingScreen';
  loadingScreen.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(1, 10, 22, 0.95);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    flex-direction: column;
  `;
  loadingScreen.innerHTML = `
    <div style="text-align: center;">
      <div style="width: 50px; height: 50px; border: 3px solid rgba(0, 212, 255, 0.3); border-top: 3px solid #00d4ff; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
      <p style="color: #00d4ff; font-size: 1.2rem;">Initializing ship systems...</p>
    </div>
  `;
  document.body.appendChild(loadingScreen);

  // Add CSS for loading spinner
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Show loading screen when navigating to game
  function showLoadingScreen() {
    loadingScreen.style.display = 'flex';
  }

  // Override the redirect functions to show loading
  const originalRedirects = [
    () => window.location.href = '/index.html'
  ];
})();