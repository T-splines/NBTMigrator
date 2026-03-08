```ascii
╔══════════════════════════════════╗
║         NBTMigrator v1.1         ║
║       Minecraft 蓝图迁移工具      ║
╚══════════════════════════════════╝
```

# NBTMigrator 🛠️

[English](README_EN.md) | [中文](README.md)

> 用于Minecraft机械动力(Create)模组的NBT蓝图版本迁移工具v1.0
> v1.1版本实现了完整的NBT解析重建，并新增针对嵌套过滤器、剪贴板的支持

## ✨ 特性

- **安全私有**：100%本地运行，不上传任何数据到服务器
- **批量处理**：支持拖拽批量上传NBT文件
- **版本覆盖**：支持1.18~1.20 → 1.21的NBT格式迁移
- **智能修复**：自动处理机械动力特有的组件化NBT问题
- **离线可用**：本地启动index.html，无需网络连接

## 🎯 解决的问题

Minecraft 1.21更新要求NBT数据严格遵循组件化格式，机械动力官方的过滤器内NBT数据迁移异常。

## 🚀 快速使用

### 在线版本
访问 [mc2.top/nbtm](https://mc2.top/nbtm)

### 本地运行
```bash
# 克隆项目
git clone https://github.com/T-splines/NBTMigrator.git

# 直接双击 index.html 文件
ui/index.html
