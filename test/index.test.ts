import { Logger, CLS } from '../';

test('Log format', () => {
  Logger.debug('(C)hronicled debug');
  Logger.info('(C)hronicled info');
  Logger.warn('(C)hronicled warning');
  Logger.warning('(C)hronicled warning2');
  Logger.crit('Crit: Reactor over temp!');
  Logger.alert('Alert: Oh noes!');
  Logger.emerg('Emergency: Run!');
  Logger.logf('info', 'Hello %s', 'world!');
});

test('Session IDs', async () =>
  new Promise((success, fail) => {
    CLS.bind(function() {
      const sessionId = 'Session1234';
      Logger.debug('Before setting sessionId');
      CLS.set('sessionId', sessionId);
      Logger.debug('After setting sessionId');
      expect(CLS.get('sessionId') === sessionId).toBe(true);
      return success();
    }, CLS.createContext())();
  }));
