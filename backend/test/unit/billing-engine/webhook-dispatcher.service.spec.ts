import { Test } from '@nestjs/testing';
import { WebhookEventType } from '@prisma/client';
import { WebhookDispatcherService } from '../../../src/modules/billing-engine/webhook-dispatcher.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';

describe('WebhookDispatcherService', () => {
  let service: WebhookDispatcherService;
  let prisma: any;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    prisma = { webhookEndpoint: { findMany: jest.fn() }, webhookDelivery: { create: jest.fn() } };
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    const moduleRef = await Test.createTestingModule({
      providers: [WebhookDispatcherService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(WebhookDispatcherService);
  });

  it('only dispatches to endpoints subscribed to the given event type (query-level filter)', async () => {
    prisma.webhookEndpoint.findMany.mockResolvedValue([]);
    await service.dispatch('company-A', WebhookEventType.PAYMENT_SUCCESS, { amount: 100 });

    expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-A', isActive: true, events: { has: WebhookEventType.PAYMENT_SUCCESS } },
    });
  });

  it('signs the payload with HMAC and records a SUCCESSFUL delivery', async () => {
    prisma.webhookEndpoint.findMany.mockResolvedValue([{ id: 'ep-1', url: 'https://example.com/hook', secret: 'shh' }]);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await service.dispatch('company-A', WebhookEventType.INVOICE_PAID, { invoiceId: 'inv-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Webhook-Signature': expect.any(String) }) }),
    );
    expect(prisma.webhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ succeeded: true, statusCode: 200 }) }),
    );
  });

  it('records a FAILED delivery (never throws) when the endpoint is unreachable', async () => {
    prisma.webhookEndpoint.findMany.mockResolvedValue([{ id: 'ep-1', url: 'https://down.example.com', secret: 'shh' }]);
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      service.dispatch('company-A', WebhookEventType.PAYMENT_FAILED, { reason: 'card_declined' }),
    ).resolves.not.toThrow();

    expect(prisma.webhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ succeeded: false }) }),
    );
  });
});
