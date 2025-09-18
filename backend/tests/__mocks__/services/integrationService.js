module.exports = {
  sendSlackNotification: jest.fn().mockResolvedValue({ success: true }),
  createJiraIssue: jest.fn().mockResolvedValue({ 
    success: true, 
    data: { 
      id: 'MOCK-123', 
      url: 'https://jira.example.com/browse/MOCK-123' 
    } 
  }),
  addJiraComment: jest.fn().mockResolvedValue({ success: true }),
  testIntegration: jest.fn().mockResolvedValue({ success: true }),
  encrypt: jest.fn().mockReturnValue('mock-encrypted-value'),
  decrypt: jest.fn().mockReturnValue('mock-decrypted-value'),
};