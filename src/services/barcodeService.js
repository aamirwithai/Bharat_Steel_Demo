const bwipjs = require('bwip-js');

const buildBarcodeValue = ({ productId, warehouseId }) => `BHS-${productId}-${warehouseId}-${Date.now()}`;

const generateBarcodeSvg = (barcodeValue) => bwipjs.toSVG({
  bcid: 'code128',
  text: barcodeValue,
  scale: 3,
  height: 12,
  includetext: true,
  textxalign: 'center'
});

module.exports = { buildBarcodeValue, generateBarcodeSvg };
