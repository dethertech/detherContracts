/* eslint-disable no-underscore-dangle */
class TimeTravel {
  constructor(web3) {
    this.web3 = web3;
  }

  saveState() {
    return new Promise((resolve, reject) => {
      this.web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_snapshot',
        id: 0,
      }, (e, d) => (
        e ? reject(e) : resolve(d)
      ));
    });
  }

  revertState(id) {
    return new Promise((resolve, reject) => {
      this.web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_revert',
        params: [id],
        id: 0,
      }, (e, d) => (
        e ? reject(e) : resolve(d)
      ));
    });
  }

  _evmSend(method, params = []) {
    return new Promise((resolve, reject) => {
      // NOTE: why is this not yet a promise, we're using web3 v1.0?
      this.web3.currentProvider.send({ id: '2.0', method, params }, (e, d) => (
        e ? reject(e) : resolve(d)
      ));
    });
  }

  async inSecs(seconds) {
    await this._evmSend('evm_increaseTime', [seconds]);
    await this._evmSend('evm_mine');
  }
}

module.exports = TimeTravel;