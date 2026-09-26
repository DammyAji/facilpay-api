import { CustomerPaymentsController } from './customer-payments.controller';
import { GetPaymentsDto } from './dto/get-payments.dto';

describe('CustomerPaymentsController', () => {
  it('delegates history lookup with the authenticated merchant scope', async () => {
    const result = { data: [], total: 0, page: 1, limit: 20, summary: [] };
    const paymentsService = {
      findCustomerPayments: jest.fn().mockResolvedValue(result),
    };
    const controller = new CustomerPaymentsController(paymentsService as any);
    const query = new GetPaymentsDto();

    await expect(
      controller.findCustomerPayments('customer-123', query, {
        user: { id: 'merchant-456' },
      } as any),
    ).resolves.toBe(result);

    expect(paymentsService.findCustomerPayments).toHaveBeenCalledWith(
      'customer-123',
      'merchant-456',
      query,
    );
  });
});