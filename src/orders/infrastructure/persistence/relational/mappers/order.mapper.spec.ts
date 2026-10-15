import { OrderMapper } from './order.mapper';
import { OrderEntity } from '../entities/order.entity';
import { Order } from '../../../../domain/order';

/**
 * The fraud-watch marks of an affiliate order (#036) must survive the trip to
 * and from the database: left out of the mapper, they were computed on every
 * order and never saved (doitac-1410 #025).
 */
describe('OrderMapper — fraud-watch fields (doitac-1410 #025)', () => {
  it('should save the buyer origin and the warning', () => {
    const domain = Object.assign(new Order(), {
      id: 1,
      buyerIpHash: 'a'.repeat(32),
      buyerVisitorId: 'visitor-1',
      attributionWarning: 'partner_device',
    });

    const entity = OrderMapper.toPersistence(domain);

    expect(entity.buyerIpHash).toBe('a'.repeat(32));
    expect(entity.buyerVisitorId).toBe('visitor-1');
    expect(entity.attributionWarning).toBe('partner_device');
  });

  it('should read them back', () => {
    const raw = Object.assign(new OrderEntity(), {
      id: 1,
      buyerIpHash: 'b'.repeat(32),
      buyerVisitorId: 'visitor-2',
      attributionWarning: 'same_device_or_ip,partner_ip',
    });

    const domain = OrderMapper.toDomain(raw);

    expect(domain.buyerIpHash).toBe('b'.repeat(32));
    expect(domain.buyerVisitorId).toBe('visitor-2');
    expect(domain.attributionWarning).toBe('same_device_or_ip,partner_ip');
  });
});
