const request = require('supertest');
const app = require('../Server/server');

describe('POST /extractTimeSheetData', () => {
  it('should extract time sheet data from Excel file', async () => {
    const response = await request(app)
      .post('/extractTimeSheetData')
      .expect(200);
  });

  it('should handle errors gracefully', async () => {
    const response = await request(app)
      .post('/extractTimeSheetData')
      .expect(500); 
    // Add assertions for the expected error response data or structure
    expect(response.body).toHaveProperty('error');
  });
});
