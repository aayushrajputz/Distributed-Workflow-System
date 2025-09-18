import { Page, BrowserContext } from '@playwright/test';

export async function connectSocket(page: Page) {
  await page.addInitScript(() => {
    // Initialize socket connection
    if (typeof window !== 'undefined' && !window.socket) {
      const io = require('socket.io-client');
      window.socket = io('http://localhost:5000', {
        auth: {
          token: localStorage.getItem('token')
        }
      });
      
      window.socketEvents = [];
      
      // Log all socket events for testing
      window.socket.onAny((eventName: string, ...args: any[]) => {
        window.socketEvents.push({ name: eventName, args, timestamp: Date.now() });
      });
    }
  });
}

export async function waitForSocketEvent(page: Page, eventName: string, timeout: number = 5000) {
  return page.waitForFunction(
    (eventName) => {
      return window.socketEvents && window.socketEvents.some(event => event.name === eventName);
    },
    eventName,
    { timeout }
  );
}

export async function setupCollaborationTest(contexts: BrowserContext[], userTypes: string[]) {
  const pages = [];
  
  for (let i = 0; i < contexts.length; i++) {
    const page = await contexts[i].newPage();
    
    // Setup authentication for each user
    const userType = userTypes[i] || 'user';
    await page.addInitScript((token) => {
      localStorage.setItem('token', token);
    }, `${userType}-token`); // This would be actual tokens in real implementation
    
    await connectSocket(page);
    await page.goto('/dashboard');
    
    pages.push(page);
  }
  
  return { pages, userTypes };
}

export async function waitForRealTimeUpdate(page: Page, selector: string, expectedText: string, timeout: number = 5000) {
  return page.waitForFunction(
    ({ selector, expectedText }) => {
      const element = document.querySelector(selector);
      return element && element.textContent?.includes(expectedText);
    },
    { selector, expectedText },
    { timeout }
  );
}

export async function verifyNotificationReceived(page: Page, notificationType: string) {
  return page.waitForFunction(
    (notificationType) => {
      return window.socketEvents && window.socketEvents.some(event => 
        event.name === 'notification' && event.args[0]?.type === notificationType
      );
    },
    notificationType,
    { timeout: 5000 }
  );
}