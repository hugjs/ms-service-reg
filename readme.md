# 模块信息

本模块包含了微服务注册和发现相关的实现，微服务体系采用本模块管理微服务集群信息。

需要解决的问题：
1. 微服务节点可以被注册到系统中
2. 微服务下线的时候，自动被发现并切断流量
3. 可以支持ABTest的多版本特性
4. 可以支持微服务的灰度发布
5. 同一个服务的不同服务之间采用负载均衡（多种均衡算法可选，最好带权重，也需要支持实验性节点的涓流测试）

服务发现方案中，使用zookeeper作为服务存储介质，通过[node-zookeeper-client](https://www.npmjs.com/package/node-zookeeper-client)项目访问zookeeper集群。

服务注册表的设计如下图所示：

![](http://otn252ndm.bkt.clouddn.com/17-8-16/3944039.jpg)

# 核心设计思想

整个微服务系统由`应用`和`微服务`两个核心概念组成。系统通过`应用`对`微服务`进行分组。同一个`微服务`可以被注册（关联）到不同的`应用`上，但是为了后面的服务治理的方便，不建议这么做。

微服务首先需要注册到`服务节点池`中，在系统中先声明一个可用服务。然后，再把微服务注册到`服务注册树`中，形成与某个应用版本的关联。

如下图所示：

![](http://otn252ndm.bkt.clouddn.com/17-11-10/80300405.jpg)

## 服务节点池

需要解决的问题：

1. 服务节点断开的时候，自动发现并不再导入流量
2. 服务节点的登记（加入集群）需要尽量简洁，跟APP的版本无关，增强兼容能力
3. 服务注册的时候，服务节点需要先登记好，注册表中只保存服务的SID
4. 需要支持持久化，使得服务重启之后能够快速被恢复

每一个服务节点启动的时候，都统一注册到节点池中。

每一个节点保持一个zookeeper的长连接。登记时在zookeeper的`/ROOT/services/app/`下面，以`EPHEMERAL`模式创建节点，节点的值为连接字符串。然后，服务节点池会自动同步到本地内存中。

在这种模式下，当节点死掉或者停掉的时候，zookeeper连接自动断开，节点自动删除，然后服务节点池自动同步删除。实现服务的准实时状态更新。

服务登记到节点池的时候，默认是待机状态，流量不会导入，需要手动启用之后才会对外服务。这样的好处是能够实现灰度发布。

### 服务节点池的数据结构

![](http://otn252ndm.bkt.clouddn.com/17-11-10/29277249.jpg)

    /${ROOT}/${app}/${sid}

* ROOT是注册树的根目录，默认是`/MICRO/services`，可以通过配置`storage.options.poolroot`修改
* app是应用的名称
* sid是微服务节点的SID。节点的数据是微服务注册时留下的服务信息。数据结构如下：
    - url 微服务访问的url
    - enabled 服务是否激活（0=未激活，1=激活）
    - version 微服务的版本号

## 服务注册树

负责记录不同的APP版本下，支持哪些微服务。微服务登记之后，需要注册到服务注册树才能被识别和导入流量。

需要解决的问题：
1. 不同的应用版本需要可以被继承，使得支持ABtest的时候，不需要为test单独建立整个服务树，并导致服务注册表的多版本注册和同步难题。
2. 需要能够快速找到某个版本的某个服务的服务节点集合（根据app，app_version，service）
3. 需要支持持久化，服务重启之后能够被快速恢复
4. 默认版本迁移的时候，能够自动合并缺失的父版本节点下面的服务

### 服务注册树的数据结构

![](http://otn252ndm.bkt.clouddn.com/17-11-10/71493237.jpg)

    /${ROOT}/${app}/${app_version}/${service}/${sid}

* ROOT是注册树的根目录，默认是`/MICRO/apps`，可以通过配置`storage.options.treeroot`修改
* app是应用的名称
* app_version是应用的版本
* service是服务的名称
* sid是微服务节点的SID。本节点下不存储数据，只存储id。所有的微服务信息通过服务池获取。

### 应用默认版本的数据结构

    /${ROOT}/${app}/_default

* ROOT是注册树的根目录，默认是`/MICRO/apps`，可以通过配置`storage.options.root`修改
* app是应用的名称
* _default, 用于存储应用的默认版本信息。

## 节点的激活

每个服务节点不是注册到服务注册树，就直接对外服务了，需要有一个激活的过程。只有被激活的服务节点才接收流量。

解决的问题：
1. 灰度发布的时候，两个版本的节点可能是逐步替换的，或者同时被替换掉的。也就是节点需要先注册上去，等信号一起上线或者下线。
2. 当某个节点出问题的时候，可以临时先下线，再去掉，防止一下子关停之后正在处理的业务被中断。

基本规则：
1. 服务先注册到节点池，再注册到服务注册树，再被激活
2. 激活操作可以在节点端通过调用接口激活
3. 激活操作也可以在注册树这边调用接口激活。注册树这边，通常都是批量操作，统一对某个版本的服务进行激活或者取消激活
4. 激活的状态需要保留下来，使得注册树服务即使重启了，服务节点的激活状态也是正确的。

## 主版本切换

服务注册树中，每一个app都有自己的主版本和备用（测试、beta）版本。每次创建备用版本的时候，都只维护备用版本特殊的微服务节点，因此备用版本是所有微服务的一个子集。主版本包含了所有的线上微服务（测试的新微服务除外）。

当一个备用或者测试版本达到了升级要求之后，就需要把主版本切换过去。

有两种方式：
1. 把备用版本根据主版本填充完整
2. 把备用或者测试版本的节点部署到主版本上面，并且逐渐增加节点数，直到替换老版本。

第一种方式适合大规模的版本更迭，也就是涉及到整个系统的升级的时候。第二种方式适合小版本迭代和ABtest胜出节点的升级。

首先，实现第二种方式，做到小版本升级和ABTest支持。再支持第一种方式。

## 服务注册树对外接口

所有服务注册树都通过统一的接口提供对外的服务
1. [x] 服务注册（输入：app, app_version, service, service_version, sid，输出：注册到注册树）
2. [x] 获取请求URL接口（输入：app, app_version, service；输出：微服务访问的URL）
3. [x] 服务激活（输入：app, sid|service；输出：成功或者失败）
4. [x] 服务取消激活（输入：app, sid|service；输出：成功或者失败）
5. [x] 设置默认版本（输入：app, version；输出：成功或者失败）
6. [-] 创建ongo版本（输入：app；输出：新版本号）**取消**
7. [ ] 切换主版本（输入：app, version；输出：成功或者失败）
8. [ ] 查看应用的版本号信息（输入：app；输出：应用的版本号列表和当前的默认版本号）



# TODO List

* 微服务池 DONE
* 微服务池的同步（持久化）DONE
* 服务注册树 DONE
* 微服务注册树的同步（持久化）DONE
* 某个版本的微服务节点的快速索引 DONE
* 设计实现节点的激活机制 DONE
* 下线某个微服务版本（非强制情况下，不允许删除整个微服务集群）
* 多应用版本下的微服务节点同步（当某个版本下面没有命中的时候，从默认版本走）

# 使用说明

引入库


