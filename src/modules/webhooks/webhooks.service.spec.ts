import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { validate, ValidationError } from 'class-validator';
import { WebhooksService } from './webhooks.service';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { WebhookDelivery, WebhookDeliveryStatus } from './entities/webhook-delivery.entity';
import { AppLogger } from '../logger/logger.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { WebhookReplay } from './entities/webhook-replay.entity';
import { UsersService } from '../users/users.service';
import { EmailNotificationService } from '../notifications/email-notification.service';

describe('WebhooksService', () => {
    let service: WebhooksService;
    let endpointRepo: any;
    let deliveryRepo: any;
    let replayRepo: any;
    let webhooksQueue: any;
    let appLogger: any;

    beforeEach(async () => {
        endpointRepo = {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            remove: jest.fn(),
        };

        deliveryRepo = {
            create: jest.fn((data) => ({ ...data })),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        replayRepo = {
            create: jest.fn((data) => ({ ...data })),
            save: jest.fn((entity) => Promise.resolve({ id: 'replay-1', ...entity })),
            findOneBy: jest.fn(),
        };

        webhooksQueue = {
            add: jest.fn(),
        };

        appLogger = {
            child: jest.fn().mockReturnValue({
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebhooksService,
                { provide: getRepositoryToken(WebhookEndpoint), useValue: endpointRepo },
                { provide: getRepositoryToken(WebhookDelivery), useValue: deliveryRepo },
                { provide: getRepositoryToken(WebhookReplay), useValue: replayRepo },
                { provide: getQueueToken('webhooks'), useValue: webhooksQueue },
                { provide: ConfigService, useValue: { get: jest.fn((_key, fallback) => fallback) } },
                { provide: UsersService, useValue: { findOne: jest.fn() } },
                { provide: EmailNotificationService, useValue: { sendWebhookEndpointDisabled: jest.fn() } },
                { provide: AppLogger, useValue: appLogger },
            ],
        }).compile();

        service = module.get<WebhooksService>(WebhooksService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('CreateWebhookEndpointDto validation', () => {
        it('rejects http webhook URLs and protocol-less values', async () => {
            const invalidPayloads = [
                { url: 'http://merchant.example.com/webhooks', events: ['payment.created'] },
                { url: 'merchant.example.com/webhooks', events: ['payment.created'] },
            ];

            for (const payload of invalidPayloads) {
                const dto = Object.assign(new CreateWebhookEndpointDto(), payload);
                const errors: ValidationError[] = await validate(dto);

                expect(errors).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ property: 'url' }),
                    ]),
                );
            }
        });

        it('accepts secure https webhook URLs', async () => {
            const dto = Object.assign(new CreateWebhookEndpointDto(), {
                url: 'https://merchant.example.com/webhooks',
                events: ['payment.created'],
            });

            const errors = await validate(dto);

            expect(errors).toHaveLength(0);
        });
    });

    describe('retryFailedDelivery', () => {
        it('should throw NotFoundException when delivery does not exist', async () => {
            deliveryRepo.findOne.mockResolvedValue(null);

            await expect(
                service.retryFailedDelivery('non-existent-id', 'merchant-123'),
            ).rejects.toThrow(NotFoundException);
            await expect(
                service.retryFailedDelivery('non-existent-id', 'merchant-123'),
            ).rejects.toThrow('Webhook delivery non-existent-id not found');
        });

        it('should throw ForbiddenException when delivery belongs to a different merchant', async () => {
            const endpoint = new WebhookEndpoint();
            endpoint.id = 'endpoint-1';
            endpoint.merchantId = 'merchant-123';

            const delivery = new WebhookDelivery();
            delivery.id = 'delivery-1';
            delivery.endpointId = 'endpoint-1';
            delivery.endpoint = endpoint;
            delivery.status = WebhookDeliveryStatus.FAILED;

            deliveryRepo.findOne.mockResolvedValue(delivery);

            // Attempt to retry with a different merchant ID
            await expect(
                service.retryFailedDelivery('delivery-1', 'merchant-456'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should throw ForbiddenException when delivery is not in FAILED or DEAD_LETTER status', async () => {
            const endpoint = new WebhookEndpoint();
            endpoint.id = 'endpoint-1';
            endpoint.merchantId = 'merchant-123';

            const delivery = new WebhookDelivery();
            delivery.id = 'delivery-1';
            delivery.endpointId = 'endpoint-1';
            delivery.endpoint = endpoint;
            delivery.status = WebhookDeliveryStatus.SUCCESS;

            deliveryRepo.findOne.mockResolvedValue(delivery);

            await expect(
                service.retryFailedDelivery('delivery-1', 'merchant-123'),
            ).rejects.toThrow(ForbiddenException);
            await expect(
                service.retryFailedDelivery('delivery-1', 'merchant-123'),
            ).rejects.toThrow('Only failed or dead-letter deliveries can be retried');
        });

        it('should successfully retry a FAILED delivery belonging to the authenticated merchant', async () => {
            const endpoint = new WebhookEndpoint();
            endpoint.id = 'endpoint-1';
            endpoint.merchantId = 'merchant-123';

            const delivery = new WebhookDelivery();
            delivery.id = 'delivery-1';
            delivery.endpointId = 'endpoint-1';
            delivery.endpoint = endpoint;
            delivery.status = WebhookDeliveryStatus.FAILED;
            delivery.payload = { event: 'payment.completed' };

            deliveryRepo.findOne.mockResolvedValue(delivery);
            deliveryRepo.save.mockResolvedValue(delivery);

            await service.retryFailedDelivery('delivery-1', 'merchant-123');

            expect(delivery.status).toBe(WebhookDeliveryStatus.PENDING);
            expect(deliveryRepo.save).toHaveBeenCalledWith(delivery);
            expect(webhooksQueue.add).toHaveBeenCalledWith(
                'deliver',
                {
                    deliveryId: 'delivery-1',
                    endpointId: 'endpoint-1',
                    payload: { event: 'payment.completed' },
                },
                {
                    attempts: 6,
                    backoff: {
                        type: 'exponential',
                        delay: 1000,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            );
        });

        it('should successfully retry a DEAD_LETTER delivery belonging to the authenticated merchant', async () => {
            const endpoint = new WebhookEndpoint();
            endpoint.id = 'endpoint-1';
            endpoint.merchantId = 'merchant-123';

            const delivery = new WebhookDelivery();
            delivery.id = 'delivery-1';
            delivery.endpointId = 'endpoint-1';
            delivery.endpoint = endpoint;
            delivery.status = WebhookDeliveryStatus.DEAD_LETTER;
            delivery.payload = { event: 'refund.issued' };

            deliveryRepo.findOne.mockResolvedValue(delivery);
            deliveryRepo.save.mockResolvedValue(delivery);

            await service.retryFailedDelivery('delivery-1', 'merchant-123');

            expect(delivery.status).toBe(WebhookDeliveryStatus.PENDING);
            expect(deliveryRepo.save).toHaveBeenCalledWith(delivery);
            expect(webhooksQueue.add).toHaveBeenCalled();
        });

        it('should load the endpoint relation when finding the delivery', async () => {
            const endpoint = new WebhookEndpoint();
            endpoint.id = 'endpoint-1';
            endpoint.merchantId = 'merchant-123';

            const delivery = new WebhookDelivery();
            delivery.id = 'delivery-1';
            delivery.endpointId = 'endpoint-1';
            delivery.endpoint = endpoint;
            delivery.status = WebhookDeliveryStatus.FAILED;
            delivery.payload = { event: 'test' };

            deliveryRepo.findOne.mockResolvedValue(delivery);
            deliveryRepo.save.mockResolvedValue(delivery);

            await service.retryFailedDelivery('delivery-1', 'merchant-123');

            expect(deliveryRepo.findOne).toHaveBeenCalledWith({
                where: { id: 'delivery-1' },
                relations: ['endpoint'],
            });
        });

        it('should prevent cross-merchant retry attempts (regression test)', async () => {
            // Merchant A creates an endpoint and has a failed delivery
            const merchantAEndpoint = new WebhookEndpoint();
            merchantAEndpoint.id = 'endpoint-A';
            merchantAEndpoint.merchantId = 'merchant-A';

            const merchantADelivery = new WebhookDelivery();
            merchantADelivery.id = 'delivery-A';
            merchantADelivery.endpointId = 'endpoint-A';
            merchantADelivery.endpoint = merchantAEndpoint;
            merchantADelivery.status = WebhookDeliveryStatus.FAILED;

            deliveryRepo.findOne.mockResolvedValue(merchantADelivery);

            // Merchant B attempts to retry Merchant A's delivery
            await expect(
                service.retryFailedDelivery('delivery-A', 'merchant-B'),
            ).rejects.toThrow(ForbiddenException);

            // Verify that the delivery status was NOT changed
            expect(deliveryRepo.save).not.toHaveBeenCalled();
            // Verify that the webhook was NOT queued
            expect(webhooksQueue.add).not.toHaveBeenCalled();
        });
    });

    describe('replayEvents', () => {
        const replayDto = {
            from: '2026-01-01T00:00:00.000Z',
            to: '2026-01-02T00:00:00.000Z',
            eventTypes: ['payment.completed'],
        };

        const createSourceQuery = (rows: any[]) => {
            const query: any = {};
            query.where = jest.fn().mockReturnValue(query);
            query.andWhere = jest.fn().mockReturnValue(query);
            query.orderBy = jest.fn().mockReturnValue(query);
            query.addOrderBy = jest.fn().mockReturnValue(query);
            query.take = jest.fn().mockReturnValue(query);
            query.getMany = jest.fn().mockResolvedValue(rows);
            deliveryRepo.createQueryBuilder.mockReturnValue(query);
            return query;
        };

        it('filters events, queues them chronologically, and preserves original payload IDs', async () => {
            const payloadLater = { event: 'payment.completed', eventId: 'event-2' };
            const payloadEarlier = { event: 'payment.completed', eventId: 'event-1' };
            const sourceRows = [
                { id: 'source-1', payload: payloadEarlier },
                { id: 'source-2', payload: payloadLater },
            ];
            const query = createSourceQuery(sourceRows);
            endpointRepo.findOneBy.mockResolvedValue({
                id: 'endpoint-1',
                merchantId: 'merchant-1',
            });
            deliveryRepo.save.mockImplementation(async (delivery) => ({
                id: `replay-delivery-${deliveryRepo.save.mock.calls.length}`,
                ...delivery,
            }));

            const result = await service.replayEvents(
                'endpoint-1',
                'merchant-1',
                replayDto as any,
            );

            expect(result).toEqual({ jobId: 'replay-1', total: 2, status: 'processing' });
            expect(query.andWhere).toHaveBeenCalledWith(
                "delivery.payload->>'event' IN (:...eventTypes)",
                { eventTypes: ['payment.completed'] },
            );
            expect(query.andWhere).toHaveBeenCalledWith('delivery.replayId IS NULL');
            expect(query.orderBy).toHaveBeenCalledWith('delivery.createdAt', 'ASC');
            expect(query.addOrderBy).toHaveBeenCalledWith('delivery.id', 'ASC');
            expect(query.take).toHaveBeenCalledWith(10001);
            expect(webhooksQueue.add.mock.calls[0][1].payload).toBe(payloadEarlier);
            expect(webhooksQueue.add.mock.calls[1][1].payload).toBe(payloadLater);
        });

        it('rejects replay windows longer than seven days', async () => {
            endpointRepo.findOneBy.mockResolvedValue({
                id: 'endpoint-1',
                merchantId: 'merchant-1',
            });

            await expect(
                service.replayEvents('endpoint-1', 'merchant-1', {
                    from: '2026-01-01T00:00:00.000Z',
                    to: '2026-01-09T00:00:00.000Z',
                } as any),
            ).rejects.toThrow(BadRequestException);
            expect(deliveryRepo.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('rejects more than 10000 matching events', async () => {
            const query = createSourceQuery(Array.from({ length: 10001 }, () => ({})));
            endpointRepo.findOneBy.mockResolvedValue({
                id: 'endpoint-1',
                merchantId: 'merchant-1',
            });

            await expect(
                service.replayEvents('endpoint-1', 'merchant-1', replayDto as any),
            ).rejects.toThrow('Replay cannot exceed 10000 events');
            expect(replayRepo.save).not.toHaveBeenCalled();
            expect(webhooksQueue.add).not.toHaveBeenCalled();
            expect(query.take).toHaveBeenCalledWith(10001);
        });

        it('enforces endpoint ownership before selecting deliveries', async () => {
            endpointRepo.findOneBy.mockResolvedValue({
                id: 'endpoint-1',
                merchantId: 'another-merchant',
            });

            await expect(
                service.replayEvents('endpoint-1', 'merchant-1', replayDto as any),
            ).rejects.toThrow(ForbiddenException);
            expect(deliveryRepo.createQueryBuilder).not.toHaveBeenCalled();
            expect(webhooksQueue.add).not.toHaveBeenCalled();
        });
    });

    describe('getReplayProgress', () => {
        it('enforces ownership of the replay job', async () => {
            replayRepo.findOneBy.mockResolvedValue({
                id: 'replay-1',
                merchantId: 'another-merchant',
                totalEvents: 1,
            });

            await expect(
                service.getReplayProgress('replay-1', 'merchant-1'),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('findOwned', () => {
        it('should throw NotFoundException when endpoint does not exist', async () => {
            endpointRepo.findOneBy.mockResolvedValue(null);

            await expect(
                service['findOwned']('non-existent-id', 'merchant-123'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException when endpoint belongs to a different merchant', async () => {
            const endpoint = new WebhookEndpoint();
            endpoint.id = 'endpoint-1';
            endpoint.merchantId = 'merchant-123';

            endpointRepo.findOneBy.mockResolvedValue(endpoint);

            await expect(
                service['findOwned']('endpoint-1', 'merchant-456'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should return endpoint when it belongs to the authenticated merchant', async () => {
            const endpoint = new WebhookEndpoint();
            endpoint.id = 'endpoint-1';
            endpoint.merchantId = 'merchant-123';

            endpointRepo.findOneBy.mockResolvedValue(endpoint);

            const result = await service['findOwned']('endpoint-1', 'merchant-123');

            expect(result).toBe(endpoint);
        });
    });


    describe('multi-sig webhook event types', () => {
        it('CreateWebhookEndpointDto accepts transaction.multisig_required as an event', async () => {
            const dto = Object.assign(new CreateWebhookEndpointDto(), {
                url: 'https://merchant.example.com/webhooks',
                events: ['transaction.multisig_required'],
            });
            const errors = await validate(dto);
            expect(errors).toHaveLength(0);
        });

        it('CreateWebhookEndpointDto accepts transaction.multisig_completed as an event', async () => {
            const dto = Object.assign(new CreateWebhookEndpointDto(), {
                url: 'https://merchant.example.com/webhooks',
                events: ['transaction.multisig_completed'],
            });
            const errors = await validate(dto);
            expect(errors).toHaveLength(0);
        });

        it('CreateWebhookEndpointDto rejects unknown transaction event types', async () => {
            const dto = Object.assign(new CreateWebhookEndpointDto(), {
                url: 'https://merchant.example.com/webhooks',
                events: ['transaction.unknown_event'],
            });
            const errors = await validate(dto);
            expect(errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ property: 'events' }),
                ]),
            );
        });
    });

    describe('dispatchEventToMerchant with multi-sig events', () => {
        it('delivers transaction.multisig_required to a subscribed endpoint', async () => {
            const endpoint = new WebhookEndpoint();
            endpoint.id = 'endpoint-1';
            endpoint.merchantId = 'merchant-123';
            endpoint.isActive = true;
            endpoint.events = ['transaction.multisig_required'] as any;

            endpointRepo.find.mockResolvedValue([endpoint]);
            deliveryRepo.create.mockReturnValue({ id: 'delivery-1', status: null, payload: null, endpointId: 'endpoint-1' });
            deliveryRepo.save.mockResolvedValue({ id: 'delivery-1' });

            await service.dispatchEventToMerchant('merchant-123', 'transaction.multisig_required', {
                transactionId: 'tx-1',
                requiredSignatures: 2,
                collectedSignatures: 1,
            });

            expect(deliveryRepo.create).toHaveBeenCalled();
            expect(deliveryRepo.save).toHaveBeenCalled();
            expect(webhooksQueue.add).toHaveBeenCalledWith(
                'deliver',
                expect.objectContaining({ endpointId: 'endpoint-1' }),
                expect.any(Object),
            );
        });

        it('delivers transaction.multisig_completed to a subscribed endpoint', async () => {
            const endpoint = new WebhookEndpoint();
            endpoint.id = 'endpoint-2';
            endpoint.merchantId = 'merchant-456';
            endpoint.isActive = true;
            endpoint.events = ['transaction.multisig_completed'] as any;

            endpointRepo.find.mockResolvedValue([endpoint]);
            deliveryRepo.create.mockReturnValue({ id: 'delivery-2', status: null, payload: null, endpointId: 'endpoint-2' });
            deliveryRepo.save.mockResolvedValue({ id: 'delivery-2' });

            await service.dispatchEventToMerchant('merchant-456', 'transaction.multisig_completed', {
                transactionId: 'tx-2',
                hash: 'abc123hash',
            });

            expect(deliveryRepo.create).toHaveBeenCalled();
            expect(deliveryRepo.save).toHaveBeenCalled();
            expect(webhooksQueue.add).toHaveBeenCalledWith(
                'deliver',
                expect.objectContaining({ endpointId: 'endpoint-2' }),
                expect.any(Object),
            );
        });

        it('does not deliver transaction.multisig_required to an endpoint not subscribed to it', async () => {
            const endpoint = new WebhookEndpoint();
            endpoint.id = 'endpoint-3';
            endpoint.merchantId = 'merchant-789';
            endpoint.isActive = true;
            endpoint.events = ['payment.created'] as any;

            endpointRepo.find.mockResolvedValue([endpoint]);

            await service.dispatchEventToMerchant('merchant-789', 'transaction.multisig_required', {
                transactionId: 'tx-3',
                requiredSignatures: 3,
                collectedSignatures: 1,
            });

            expect(deliveryRepo.create).not.toHaveBeenCalled();
            expect(webhooksQueue.add).not.toHaveBeenCalled();
        });

        it('does not deliver transaction.multisig_completed to an endpoint not subscribed to it', async () => {
            const endpoint = new WebhookEndpoint();
            endpoint.id = 'endpoint-4';
            endpoint.merchantId = 'merchant-999';
            endpoint.isActive = true;
            endpoint.events = ['payment.completed', 'refund.issued'] as any;

            endpointRepo.find.mockResolvedValue([endpoint]);

            await service.dispatchEventToMerchant('merchant-999', 'transaction.multisig_completed', {
                transactionId: 'tx-4',
                hash: 'xyz789hash',
            });

            expect(deliveryRepo.create).not.toHaveBeenCalled();
            expect(webhooksQueue.add).not.toHaveBeenCalled();
        });
    });
});
