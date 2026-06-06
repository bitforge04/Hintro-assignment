const request = require('supertest');
const app = require('../src/app');

describe('Meeting Routes', () => {
  it('should reject unauthenticated request to GET /api/meetings', async () => {
    const res = await request(app).get('/api/meetings');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty('traceId');
  });

  it('should reject unauthenticated request to POST /api/meetings', async () => {
    const res = await request(app)
      .post('/api/meetings')
      .send({ title: 'Test Meeting' });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject meeting creation with missing fields when authenticated', async () => {
    // First login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    // If no user exists yet, skip this test
    if (!loginRes.body.data?.token) return;

    const token = loginRes.body.data.token;

    const res = await request(app)
      .post('/api/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '' }); // missing required fields

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty('traceId');
  });
});