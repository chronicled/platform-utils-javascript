const { Logger, CLS } = require('.');

Promise.resolve()
  .then(CLS.bind(function () {
    const sessionId = 'SessionId';
    Logger.debug('Before setting sessionId');
    CLS.set('sessionId', sessionId);
    Logger.debug('After setting sessionId');
    const isRightId = CLS.get('sessionId') === sessionId;
    isRightId ? Logger.debug('Got correct id from CLS') : Logger.error('Got incorrect id from CLS');
  }, CLS.createContext()));
