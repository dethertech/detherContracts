const addNumberDots = num => (
  num.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1.')
);

module.exports = {
  addNumberDots,
};
