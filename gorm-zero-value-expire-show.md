# GORM 零值省略坑：`expire_show=0` 落不成库

## 背景

工作项有个字段 `expire_show`：过期后还展不展示。任务类型固定为「展示」(1)，机会类型可以选「不展示」(0)。

表上这列是 `DEFAULT '1'`——没写进 INSERT 时，库会自动填 1。业务侧用 `int32`，`0`/`1` 表示否/是。

踩坑现场：机会场景明确传了 `ExpireShow: 0`，落库后永远是 1，过期自动取消等依赖 `expire_show=0` 的逻辑全对不上。

## 原因

不是 Go 语言的问题。Go 里 `0` 是合法值。

是 GORM 的约定：`Create(struct)` / 用 struct 做部分 `Updates` 时，默认把 Go 零值（`0`、`false`、`""`）当成「没设这个字段」，SQL 里就不带这列。

叠起来就是：

1. 业务写 `ExpireShow: 0`
2. GORM 跳过零值 → INSERT 没有 `expire_show`
3. MySQL 用列默认值 → 库里是 `1`

还有第二层：PO 的 GORM tag 如果写了 `default:1`，插入前回调还可能把显式的 `0` 直接改成 `1`。tag 去掉只挡住这层改写；Create 照样可能因零值省略不带列，表 DEFAULT 还是会顶上。

```15:17:internal/adapter/driven/mysql/workitem/po/scene_config.go
	// 不在 GORM tag 声明 default:1；否则显式的机会场景 false(0)会被 GORM 默认值回调改写为1。
	// 数据库 schema 默认值仍保留为1，任务场景由应用层显式写入1。
	ExpireShow    int32 `gorm:"column:expire_show;not null" json:"expire_show"`
```

所以：**GORM 零值省略约定 + 「0 有业务含义」的字段 + 表 DEFAULT 与显式 0 相反**，三者撞在一起。

## 解法

0 有业务含义时，别指望默认 `Create(struct)`。

### 错误写法

```go
// ExpireShow=0 是 Go 零值，GORM 默认不写进 INSERT
db.Create(&po.WorkItem{
    // ...
    ExpireShow: 0, // 想表示「不展示」，实际被省略
})
// 生成的 SQL 大致是：
// INSERT INTO work_item (..., has_expire, expire_time, ...) VALUES (...)
// ← 没有 expire_show → 库用 DEFAULT 1
```

用 struct 做部分更新同样会踩：

```go
// Updates(struct) 也会跳过零值，expire_show 改不成 0
db.Model(&po.WorkItem{}).Where("id = ?", id).Updates(po.WorkItem{
    ExpireShow: 0,
})
```

### 正确写法

**1. map 插入 / 更新**（有 key 就会写，含 `0`）

```go
// 插入：主行保存走 dirty map
columns := map[string]any{
    // ...
    "expire_show": int32(0),
}
db.Model(&po.WorkItem{}).Create(columns)

// 更新：局部字段用 map
db.Model(&po.WorkItem{}).Where("id = ?", id).Updates(map[string]any{
    "expire_show": int32(0),
})
```

本仓库同类写法：`SaveWithAttach` 主行 `Create(columns)`；`DispatchExecutionRepo.updateColumns(..., columns map[string]any)`。

**2. Select 强制带列**（仍用 struct，但点名要写的字段）

```go
db.Model(&po.WorkItem{}).
    Select("expire_show", "has_expire", "expire_time" /* ... */).
    Create(&po.WorkItem{ExpireShow: 0 /* ... */})
```

批量派发插入用的是 `Select(dispatchWorkItemInsertColumns).CreateInBatches(...)`，单测会断言 INSERT 里必须出现 `expire_show`。

struct 零值 ≈ 没传；map 有 key ≈ 要写。去掉 tag `default` 不够，INSERT/UPDATE 里得真出现这列。

## 拓展

同类字段都要留心：

- 布尔语义用 `int32`/`int`（0/1），且 **0 是合法业务值**
- 列上有与「显式 0」**相反**的 `DEFAULT`
- 批量 Create、部分字段 Updates 还在走默认 struct API

可选建模：指针 `*int32`（`nil`=未设，`&0`=显式 0），语义更清楚，但模型更重，本仓库没全面改成这套：

```go
type WorkItem struct {
    ExpireShow *int32 // nil 未设；非 nil 则 0/1 都会进 SQL
}
v := int32(0)
db.Create(&po.WorkItem{ExpireShow: &v})
```

一句话：这是 GORM 下的常见坑，不是框架坏了——默认 Create 不适合「0 必须落库」的字段。
