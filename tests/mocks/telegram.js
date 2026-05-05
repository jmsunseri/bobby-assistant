const telegramMock = {
  initClient: function() { return Promise.resolve(true); },
  sendCode: function(phone) { return Promise.resolve({ success: true, status: 'code_sent', message: 'Verification code sent' }); },
  signIn: function(data) { return Promise.resolve({ success: true, status: 'signed_in' }); },
  signInWithPassword: function(password) { return Promise.resolve({ success: true, status: 'signed_in' }); },
  disconnect: function() { return Promise.resolve(); },
  logout: function() { return Promise.resolve(); },
  checkConnection: function() { return Promise.resolve({ connected: true, hasSession: true }); },
  getAuthState: function() { return { phoneNumber: null, isWaitingForCode: false }; },
  getClient: function() { return null; },
  isClientConnected: function() { return false; },
  getCurrentUser: function() { return null; },
  saveSession: function() {},
  loadSession: function() { return null; },
  clearSession: function() {},
  hasSession: function() { return false; },
  saveBotUsername: function() {},
  getBotUsername: function() { return null; },
  getSessionInfo: function() { return null; },
  sendMessage: function() {},
  onMessage: function() {},
  startListening: function() {},
  sendAndWaitForResponse: function() {},
  sendStreamingRequest: function() {},
};

global.__telegramMock = telegramMock;

module.exports = telegramMock;