const mockChainable = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue({ error: null })
};

const mockSupabase = {
  from: jest.fn().mockReturnValue(mockChainable)
};

jest.mock('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn(() => mockSupabase)
  };
});

describe('Gym Events', () => {
  let gymEmitter;
  const oldEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...oldEnv };
    process.env.SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';

    // Clear mock calls
    jest.clearAllMocks();

    // Set up standard mock responses
    mockChainable.select.mockReturnThis();
    mockChainable.eq.mockReturnThis();

    // For update().eq() to work, update must return the chainable
    mockChainable.update.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null })
    });

    mockChainable.insert.mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue(mockChainable);

    gymEmitter = require('../events');
  });

  afterEach(() => {
    process.env = oldEnv;
  });

  describe('payment.failed', () => {
    it('should create a notification and update an existing analytics snapshot', async () => {
      mockChainable.single.mockResolvedValueOnce({ data: { id: 123 }, error: null });

      const mockEqAfterUpdate = jest.fn().mockResolvedValue({ error: null });
      mockChainable.update.mockReturnValueOnce({
        eq: mockEqAfterUpdate
      });

      const promise = new Promise((resolve) => setTimeout(resolve, 50));
      gymEmitter.emit('payment.failed', {
        tenant_id: 't1',
        profile_id: 'p1',
        amount: 50,
        reason: 'Insufficient funds',
        email: 'test@example.com'
      });
      await promise;

      expect(mockSupabase.from).toHaveBeenCalledWith('analytics_snapshots');
      expect(mockChainable.update).toHaveBeenCalledWith({ churn_risk_score: 90 });
      expect(mockEqAfterUpdate).toHaveBeenCalledWith('id', 123);
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_queue');
      expect(mockChainable.insert).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: 't1',
        profile_id: 'p1',
        channel: 'email',
        recipient: 'test@example.com',
        subject: 'Payment Failed',
        status: 'pending'
      }));
    });

    it('should create a notification and insert a new analytics snapshot if none exists', async () => {
      mockChainable.single.mockResolvedValueOnce({ data: null, error: null });

      const promise = new Promise((resolve) => setTimeout(resolve, 50));
      gymEmitter.emit('payment.failed', {
        tenant_id: 't2',
        profile_id: 'p2'
      });
      await promise;

      expect(mockChainable.insert).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: 't2',
        profile_id: 'p2',
        churn_risk_score: 90
      }));
      expect(mockChainable.insert).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: 't2',
        profile_id: 'p2',
        recipient: 'member@example.com'
      }));
    });
  });

  describe('checkin.denied', () => {
    it('should create an SMS notification in the queue', async () => {
      const promise = new Promise((resolve) => setTimeout(resolve, 50));
      gymEmitter.emit('checkin.denied', {
        tenant_id: 't3',
        profile_id: 'p3',
        phone: '1234567890',
        reason: 'Unpaid dues'
      });
      await promise;

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_queue');
      expect(mockChainable.insert).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: 't3',
        profile_id: 'p3',
        channel: 'sms',
        recipient: '1234567890',
        subject: 'Check-in Denied',
        content: 'Your check-in was denied. Reason: Unpaid dues',
        status: 'pending'
      }));
    });
  });
});
