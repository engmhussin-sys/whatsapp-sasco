import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { WebhookEventType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * WEBHOOK ENGINE — delivers the 6 event types the spec lists (Payment
 * Success/Failed, Subscription Renewed/Expired, Invoice Paid/Overdue)
 * to every ACTIVE endpoint a company registered for that event type.
 * Every delivery attempt (success or failure) is recorded in
 * WebhookDelivery for auditing/retry visibility — deliveries are
 * fire-and-forget from the caller's perspective (billing operations
 * must never fail because a customer's webhook endpoint is down).
 */
@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(private prisma: PrismaService) {}

  async dispatch(companyId: string, eventType: WebhookEventType, payload: Record<string, unknown>): Promise<void> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { companyId, isActive: true, events: { has: eventType } },
    });

    await Promise.all(endpoints.map((endpoint: { id: string; url: string; secret: string }) => this.deliver(endpoint, eventType, payload)));
  }

  private async deliver(
    endpoint: { id: string; url: string; secret: string },
    eventType: WebhookEventType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const body = JSON.stringify({ eventType, payload, timestamp: new Date().toISOString() });
    const signature = createHmac('sha256', endpoint.secret).update(body).digest('hex');

    let statusCode: number | undefined;
    let succeeded = false;
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature },
        body,
      });
      statusCode = response.status;
      succeeded = response.ok;
    } catch (err) {
      this.logger.warn(`Webhook delivery to ${endpoint.url} failed: ${(err as Error).message}`);
    }

    await this.prisma.webhookDelivery.create({
      data: { endpointId: endpoint.id, eventType, payload: payload as never, statusCode, succeeded, attempts: 1 },
    });
  }
}
