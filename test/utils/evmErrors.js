const forgeErrorMessage = str => `Returned error: VM Exception while processing transaction: revert ${str} -- Reason given: ${str}.`;
// const forgeErrorMessage = str => `VM Exception while processing transaction: revert ${str}`;
const forgeErrorMessage2 = str => `Returned error: VM Exception while processing transaction: revert ${str}`;

const expectRevert = async (fn, errMsg) => {
  try {
    await fn;
  } catch (err) {
    if (!err.message.includes(errMsg)) {
      throw err;
    }
    return;
  }
  throw new Error('should have thrown');
};

const expectRevert2 = async (fn, errMsg) => {
  try {
    await fn;
  } catch (err) {
    if (!err.message.includes(errMsg)) {
      throw err;
    }
    return;
  }
  throw new Error('should have thrown');
};
const expectRevert3 = async (fn, errMsg) => {
  try {
    const ret = await fn;
    console.log('ret => ', ret);
  } catch (err) {
    console.log('err', err);
    // if (!err.message.includes(errMsg)) {
    //   throw err;
    // }
    return;
  }
  throw new Error('should have thrown');
};
module.exports = {
  expectRevert,
  expectRevert2,
  expectRevert3,
};
