const getAccounts = web3 => new Promise((resolve, reject) => {
  web3.eth.getAccounts((err, acc) => err ? reject(err) : resolve(acc.map(a => a.toLowerCase()))); // eslint-disable-line
});

module.exports = {
  getAccounts,
};
