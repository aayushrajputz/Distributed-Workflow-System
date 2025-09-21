import '@testing-library/jest-dom';

// Mock Next.js redirect
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

import Home from '../app/page';

describe('Home Page', () => {
  it('redirects to /dashboard', () => {
    const { redirect } = require('next/navigation');
    // Call the page function directly; it triggers redirect
    Home();
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });
});
