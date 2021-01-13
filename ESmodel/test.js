
// commonjs写法
//test.js 导出
module.exports = {
  a: 1,
  b: 2
}
// 和上面等价，算一种
exports.a = 1;
exports.b = 2;


//main.js 导入
const test = require('./test');
console.log('a:',test.a);
console.log('b:',test.b);


// 当你在cmjs里导入esm的模块时
// 如果你的esm导出的是default模块将会导致很多问题（不同编译器）
// 除非用户这样写 const fn = require('secret').default
// babel会将cjs模块导出编译为Object.defineProperty(exports, '__esModule', { value: true });以此做到兼容