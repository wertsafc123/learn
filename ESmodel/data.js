// esm有两种导出方式
// 1、default
export default {
    x:1,
    y:2
}

// 2、name导出
export const x = 3
export var y = 4

setTimeout(() => {
    y = 5
}, 1000)
// 前端项目代码中禁用commonjs
