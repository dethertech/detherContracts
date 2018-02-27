

const DetherCore = artifacts.require('./DetherCore');


module.exports = async (callback) => {

  console.log(web3);
  console.log(DetherCore.abi);
  const contractAbi  = DetherCore.abi;



  callback();
};
