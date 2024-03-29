
## 版本更新记录

### 0.0.9
- 增加websocket接口的支持（目前只支持服务url的查询接口）

### 0.0.8
- 获取微服务访问地址的时候，如果设定的app版本没有找到目标地址，则在默认app版本中查找。这样，测试版本就不需要构建完整的app服务树了。
- 配置文件用yml格式改写
- zk状态保持的日志设置为trace级别

### 0.0.7
- 更新Readme文件，增加服务节点池和注册树的数据结构描述
- 配置文件中把服务节点池和注册树的根节点进行了区分
- 完成获取服务url接口的实现
- 完成首个负载均衡（P2c算法的实现）
- 增加zookeeper的session维持机制
- 增加系统的健壮性

### 0.0.6
- 完成服务激活和取消激活的接口
- 完成服务默认版本的设置

### 0.0.5
- 完成服务注册接口的开发和调试
- 完成事件日志的优化，简化显示内容

### 0.0.4
- 移动servicepool.js到src/model下面

### 0.0.3
- 完成src/zk/servicepool.js
- 用于维护微服务池

### 0.0.2  
- 完成src/model/service.js

### 0.0.1
- 初始版本