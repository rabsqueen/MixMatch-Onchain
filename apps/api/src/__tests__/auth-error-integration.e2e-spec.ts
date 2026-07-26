import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, UseGuards } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthGuard } from '../src/modules/auth/guards/auth.guard';

@Controller('test-auth-error')
class TestAuthErrorController {
  @Get('protected')
  @UseGuards(AuthGuard)
  getProtected() {
    return { success: true };
  }
}

describe('Auth Error Exception Filter — E2E Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestAuthErrorController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /test-auth-error/protected returns standardized 401 error response payload', async () => {
    const response = await request(app.getHttpServer())
      .get('/test-auth-error/protected')
      .expect(401);

    expect(response.body).toEqual({
      statusCode: 401,
      errorCode: 'UNAUTHORIZED_ACCESS',
      message: expect.any(String),
      path: '/test-auth-error/protected',
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      retryable: false,
    });
  });
});