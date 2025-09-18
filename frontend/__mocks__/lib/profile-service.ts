import type { Profile } from '../types/profile';

const defaultProfile: Profile = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  avatar: 'https://example.com/avatar.png',
  role: 'user',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const profileService = {
  getProfile: jest.fn().mockResolvedValue(defaultProfile),
  updateProfile: jest.fn(),
  deleteProfile: jest.fn(),
};

// Helper to reset all mocks
export const resetProfileMocks = () => {
  Object.values(profileService).forEach((mock) => {
    mock.mockReset();
    if (mock === profileService.getProfile) {
      mock.mockResolvedValue(defaultProfile);
    }
  });
};

// Helper to set mock responses
export const setProfileMockResponse = (
  method: keyof typeof profileService,
  response: any,
  error = false
) => {
  const mock = profileService[method];
  if (error) {
    mock.mockRejectedValue(response);
  } else {
    mock.mockResolvedValue(response);
  }
};

export default profileService;