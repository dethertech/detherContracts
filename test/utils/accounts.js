const getAccounts = web3 => new Promise((resolve, reject) => {
  web3.eth.getAccounts((err, acc) => err ? reject(err) : resolve(acc)); // eslint-disable-line
});

module.exports = {
  getAccounts,
};
