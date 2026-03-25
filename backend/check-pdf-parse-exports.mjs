import * as pdfParseModule from 'pdf-parse';

console.log('pdf-parse exports:');
console.log(Object.keys(pdfParseModule));
console.log('\nModule:', pdfParseModule);
console.log('\nDefault:', pdfParseModule.default);
console.log('\nType of default:', typeof pdfParseModule.default);

// Try to use it
if (typeof pdfParseModule.default === 'function') {
  console.log('\n✅ default is a function');
} else if (typeof pdfParseModule === 'function') {
  console.log('\n✅ module itself is a function');
} else {
  console.log('\n❌ Neither default nor module is a function');
  console.log('Available exports:', Object.keys(pdfParseModule));
}
