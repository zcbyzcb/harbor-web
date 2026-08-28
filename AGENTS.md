# 酒店管理系统开发规范

版本：v1.2 ｜ 更新日期：2026-08-28 ｜ 状态：开发基线（补充后端模块边界）

本文约束后续前后端编码、数据库访问、任务、日志及测试，不表示脚手架、业务接口或部署环境已经实现。

业务范围以 [需求文档](酒店管理系统需求文档.md) 为准，库存、事务和表结构以 [技术方案](酒店管理系统技术方案.md) 及 [建表 SQL](../db/schema.sql) 为准。保持单酒店、前后端分离、单个后端应用，不新增退房、清洁、支付、多酒店或员工管理功能。

员工登录与退出属于MVP必做功能，包含登录页、身份恢复、业务访问拦截和退出清理；不因此增加注册、员工管理或复杂角色权限页面。认证契约以技术方案第5.3—5.4节为准。

## 目录

- [1. 核心约束与技术选型](#baseline)
- [2. 前端开发规范](#frontend)
- [3. 后端 DDD 架构](#architecture)
- [4. Processor 与 Qurier](#cqrs)
- [5. 充血领域模型](#domain)
- [6. MyBatis XML 与数据库](#persistence)
- [7. 事务、并发与幂等](#transaction)
- [8. API 与前后端协作](#api)
- [9. XXL-JOB 定时任务](#job)
- [10. SLF4J 日志与文件](#logging)
- [11. Java 编码、异常与安全](#java)
- [12. 测试、交付与评审](#quality)
- [13. 待确认事项与维护](#decisions)

<a id="baseline"></a>

## 1. 核心约束与技术选型

### 1.1 规范等级

**强制**：开发及代码评审必须满足；**推荐**：一般采用，偏离时说明理由；**待确认**：尚未形成业务或运维决策，不可作为已确认规则实现。未另行标注的规范性要求按强制执行。

| 项目 | 约束 |
|---|---|
| 前端 | Vue 3；其他组件采用本文默认选择，不混用多套 UI 框架。 |
| 后端 | JDK 21、Spring Boot 3.5.x、MyBatis XML、XXL-JOB。 |
| 架构 | 严格 DDD 分层和充血模型；业务状态和规则由领域模型维护。 |
| 写操作 | 所有运行时业务写用例定义为 `XxxProcessor`，通过领域行为和 Repository 持久化。 |
| 查询 | 查询用例定义为 `XxxQurier`，允许直接使用只读 Mapper 查库。 |
| 编码 | 遵守《阿里巴巴 Java 开发手册（黄山版）》，本文补充项目约束，不替代原手册。 |
| 日志 | 门面统一为 SLF4J，默认实现 Logback；生产日志落盘、分级、滚动、脱敏。 |
| 一致性 | 沿用现有同库事务、统一锁顺序、唯一键和业务幂等；禁止以按钮禁用代替并发控制。 |

**命名说明：**按需求保留 `Qurier` 拼写，代码、包名和文档统一，不混用 `Querier`、`QueryService`。日志 API 的正式名称为 `SLF4J`，对应需求中的“sl4j”。

与黄山版强制条款有冲突时须记录评审结论，不能静默绕过；`Qurier` 是用户明确指定的项目命名约定。

### 1.2 前端技术基线

| 类别 | 选型 | 约定 |
|---|---|---|
| 框架/语言 | Vue 3 + TypeScript | Composition API、`<script setup lang="ts">`、严格类型检查。 |
| 构建 | Vite | 使用 create-vue 初始化，不使用旧 Vue CLI 新建项目。 |
| 路由/状态 | Vue Router + Pinia | 页面懒加载；Pinia 仅保存跨页面共享状态。 |
| UI | Element Plus | 统一表格、表单、日期、弹窗及消息反馈。 |
| HTTP | Axios | 单一请求实例，统一超时、错误转换和追踪标识。 |
| 样式 | SCSS + CSS 变量 | 统一颜色、字号、间距、层级，局部样式使用 scoped。 |
| 工程检查 | ESLint + Prettier + vue-tsc | 分别负责规则、格式和类型检查。 |
| 测试 | Vitest + Vue Test Utils；Playwright | 逻辑/组件测试与核心端到端流程。 |
| 包管理 | pnpm | 提交 pnpm-lock.yaml，CI 冻结锁文件安装。 |

Vue 提供基于 Vite 的 TypeScript 脚手架；Vite 构建本身不完成类型检查，必须单独执行 vue-tsc。[Vue TypeScript 文档](https://vuejs.org/guide/typescript/overview.html)

Element Plus 用于统一桌面前台的交互和反馈，不扩展当前 MVP 页面范围。[Element Plus 设计指南](https://element-plus.org/en-US/guide/design.html)

### 1.3 后端技术基线

| 类别 | 选型 | 约定 |
|---|---|---|
| Java | JDK 21 | 编译、测试、运行一致，不默认开启预览特性。 |
| 应用框架 | Spring Boot 3.5.x + Spring MVC | 固定补丁版本，不自行升级到 4.x；不混用 WebFlux 执行 JDBC 业务。 |
| 构建 | Maven 3.9.x + Maven Wrapper | 父 POM 管理依赖/插件，编译目标 21。 |
| 持久化 | MyBatis + Spring Boot Starter 3.0.x | 所有业务 SQL 使用 XML；不引入 JPA、MyBatis-Plus 替代领域设计。 |
| 数据库/连接池 | MySQL 8.4 / InnoDB + HikariCP | 数据库沿用当前暂定设计；连接池采用 Boot 默认集成。 |
| 任务 | XXL-JOB | 调度中心与执行器版本匹配，Handler 调用 Processor。 |
| 日志 | SLF4J + Logback | 使用 Boot 依赖管理，避免多个日志提供者。 |
| 校验/安全 | Jakarta Bean Validation + Spring Security | 边界参数校验、统一认证授权；领域层继续校验业务规则。 |
| 测试 | JUnit 5、Mockito、ArchUnit、Testcontainers | 单测、架构检查和目标 MySQL 集成测试。 |

JDK 21 在 Boot 3.5 的兼容范围内；MyBatis Starter 3.0 系列支持 Boot 3.2—3.5。不能直接复制官方首页面向 Boot 4 的 Starter 版本。[Boot 系统要求](https://docs.spring.io/spring-boot/3.5/system-requirements.html)、[MyBatis 兼容表](https://mybatis.org/spring-boot-starter/mybatis-spring-boot-autoconfigure/)

### 1.4 版本治理

- 建工程时选择经安全审查和兼容测试的具体补丁版本，写入父 POM、Wrapper、packageManager 和锁文件；上表版本系列不是浮动依赖写法。
- Node.js 选择满足所选 Vite 要求且仍维护的 LTS，使用 .node-version 固定。[Vite 环境要求](https://vite.dev/guide/)
- Boot 受管依赖优先遵循 BOM；新增或覆盖依赖须说明原因、安全与许可证风险，并验证。
- 不默认引入 Redis、消息队列、微服务网关或分布式事务。本版保持单个业务后端和同库事务。
- 上线前核对指定技术栈的支持期限及补丁计划；有维护风险时提出升级或支持方案，不擅自改变用户指定技术栈。

<a id="frontend"></a>

## 2. 前端开发规范

### 2.1 工程结构与命名

以下是后续脚手架目标，不表示当前已有代码：

```text
frontend/
  src/
    api/                 # HTTP 实例、业务 API、接口 DTO
    assets/
    components/          # 通用展示组件
    composables/         # useXxx 组合函数
    layouts/
    router/
    stores/
    styles/
    types/               # 公共类型，业务类型优先就近维护
    utils/               # 纯函数，不堆放业务流程
    views/
      login/
      dashboard/
      booking/
      orders/
    App.vue
    main.ts
  tests/
  e2e/
```

- 组件 PascalCase，如 OrderDetail.vue；组合函数 useOrderSearch.ts；普通模块 kebab-case，如 order-api.ts。
- 组件使用多词名称，App.vue 除外；路由名唯一，路径 kebab-case，页面懒加载。
- 页面只编排交互，不直接拼 URL、处理通用鉴权或重复定义错误码。业务专属组件放在对应页面目录。
- props/emits 必须声明类型；禁止直接修改 props、通过 DOM 操作绕过 Vue 状态、用大量 any 规避检查。
- 派生值使用 computed；watch 只用于必要副作用，避免相互触发的监听链。
- 编辑型列表使用稳定业务标识作为 key，不用数组下标识别入住人或房间。

### 2.2 状态、表单与交互

- 表单、弹窗、分页状态优先留在页面；Pinia 只管理跨页面状态，不长期缓存所有接口数据。
- 组件卸载清理监听器、定时器和未完成查询；禁止将完整客人资料保存到浏览器持久存储、URL 或错误监控。
- 每页处理加载、空数据、失败和无权限状态；查询失败不能显示成“没有订单”。
- 查询条件变化重置页码；取消旧请求或使用请求序号丢弃过期响应，避免旧结果覆盖新筛选。
- 表单有标签、必填与格式提示；客户端校验改善体验，后端仍是业务校验依据。
- 提交中禁用重复点击，取消预订需明确订单及影响；多房入住一次提交整批房间和各房入住人。
- 超时/断网不等于写入失败，显示“结果待确认”；查询原结果或原键重试，不自动新建订单或取消。
- 库存不足、房间冲突、报价变化提示刷新和重新确认；库存缺行显示“库存待同步”，不能当成售罄或满库存。
- 日期限制依据服务端酒店日期、预订窗口及订单原日期，不依赖浏览器时区或电脑时钟判断业务资格。
- 成功后刷新订单、候选房间和首页相关数据；状态用文字配合颜色表达，支持键盘、焦点和错误定位。

### 2.3 请求、金额与权限

- API 层统一超时、通用请求头和错误对象；页面按业务 code 判断，不解析中文 message。
- 写请求不得在通用拦截器中无条件自动重试；读取请求重试必须有限且可取消。
- 创建预订与整批入住各使用逻辑操作 UUID，放在 Idempotency-Key；结果未确认前保留原键和原参数，改变参数不得复用原键。
- ID、订单号和房号使用字符串；金额传十进制字符串。最终金额后端计算，前端浮点计算不能成为结算依据。
- 路由/按钮权限只控制展示，服务端必须再次授权；401 引导认证，403 展示无权限，不混为一类。
- 不对不可信内容直接使用 v-html；VITE_* 会进入前端产物，不放密码、服务端密钥或调度 token。
- 样式使用统一主题变量，控制全局选择器；图片失败显示统一占位图，不填虚假图片 URL。

### 2.4 登录页面与会话交互

- `/login` 为独立页面，账号、密码必填，密码默认隐藏；登录成功进入首页，顶部展示当前员工姓名和退出入口。
- 启动、刷新与路由守卫通过 `GET /api/auth/me` 确认身份。不得用本地布尔值放行，也不把会话凭证、密码或客人资料写入localStorage；已登录访问登录页跳回首页。
- 登录前请求 `/api/auth/csrf`，登录成功后重新获取令牌；所有业务POST和退出携带令牌。403 `CSRF_INVALID` 时先确认会话并刷新令牌，不自动重放写请求。
- 401清理页面身份和敏感数据后提示重新登录；403权限不足不误判为未登录。登录响应丢失先查当前身份，退出只有服务端确认后才能提示成功。
- 退出、换账号清除Pinia中的身份、订单数据和表单，停止旧页面请求并丢弃迟到响应，避免上一员工数据再次显示。提交中的业务结果未知时先查询原结果，不换键或换员工自动重试。

<a id="architecture"></a>

## 3. 后端 DDD 架构

### 3.1 业务边界

采用模块化单体。核心限界上下文为酒店前台履约，内部按预订、库存、入住组织领域包，认证为支撑能力。领域包不是独立微服务，数据库表不直接等于聚合。

| 概念 | 建议模型 | 职责 |
|---|---|---|
| 预订 | BookingOrder 聚合根 | 状态、住宿区间、间数、成交快照及取消规则。 |
| 房型日期库存 | RoomTypeInventory 聚合根 | 单房型单晚容量、预订/入住/可售数量及守恒。 |
| 库存占用凭证 | InventoryReservation 实体 | 订单与库存日期的占用和 locked/release/cancel 转换。 |
| 入住 | CheckInRecord 聚合根、CheckInGuest 子实体 | 单房入住事实、房号快照及入住人。 |
| 物理房间 | Room 聚合根 | 可交房状态与入住后的物理状态。 |
| 值对象 | StayPeriod、Money、RoomAllocation | 日期、金额和分房约束，创建后不可变。 |

编码前评审实体归属和 Repository 边界。跨聚合按 ID 关联，不把所有房间、日期和订单放入一个“酒店大聚合”。本版单次预订/入住/取消需要同时修改多个聚合，由应用层协调同库事务；不能为了形式上“一事务一聚合”破坏现有强一致设计。

### 3.2 Maven 模块与依赖

后端固定拆为以下五个 Maven 模块，模块名前缀统一为 `harbor-`：`start`、`api`、`app`、`domain`、`infrastructure`。不得再创建 `adapter`、`bootstrap`、`application` 等并列模块；原有职责归入这五个模块。

| 模块 | 职责 | 允许依赖 |
|---|---|---|
| harbor-start | Spring Boot 启动类、运行装配、全量资源文件和环境配置。 | api、app、domain、infrastructure 及启动所需框架。 |
| harbor-api | Controller、HTTP Request/Response、接口组装、全局 HTTP 异常转换、认证和 XXL-JOB 入口。 | app、领域公开类型及入口框架。 |
| harbor-app | Processor、Qurier、Command、Query、用例 DTO 和应用服务。 | domain；查询侧可依赖 infrastructure 的只读 Mapper。 |
| harbor-domain | 聚合、实体、值对象、Factory、领域服务、Repository 接口和领域异常。 | JDK；经评审的无框架基础库。 |
| harbor-infrastructure | MySQL 访问、MyBatis Mapper/DO、Repository 实现、三方请求及其适配器。 | domain、技术库；不得依赖 api 或 app。 |

依赖方向为 `start → api → app → domain`，`start → infrastructure → domain`；仅 `app` 中的 `XxxQurier` 可单向依赖 `infrastructure` 的只读 Mapper。该例外只服务于已确定的“Qurier 直接查库”规则，禁止 Processor 因此依赖 Mapper 或基础设施实现。不得形成循环依赖。

领域层不依赖 Spring、MyBatis、HTTP、DO 或日志实现。Repository 接口在 domain，实现在 infrastructure；由 start 的装配配置将 Repository 实现注入领域 Factory，再由 Factory 创建携带依赖的领域对象。上层不能直接 new Repository 实现或领域对象。

### 3.3 模块目录与包结构

```text
harbor-start/
  src/main/java/com/harbor/hotel/start/       # HotelApplication、装配配置
  src/main/resources/                         # application*.yml、logback、mapper XML 等全部资源
harbor-api/
  src/main/java/com/harbor/hotel/api/
    auth/                                     # 登录、退出、当前员工接口
    booking/ checkin/ inventory/ dashboard/
    common/{request,response,assembler,exception}
    job/                                      # XXL-JOB Handler，只调用 Processor/Qurier
harbor-app/
  src/main/java/com/harbor/hotel/app/
    booking/{processor,qurier,command,query,dto}
    inventory/{processor,qurier,command,query,dto}
    checkin/{processor,command,dto}
    auth/{processor,qurier,command,dto}
harbor-domain/
  src/main/java/com/harbor/hotel/domain/
    booking/{model,factory,repository,service}
    inventory/{model,factory,repository,service}
    checkin/{model,factory,repository,service}
    room/{model,repository}
    shared/{exception,valueobject}
harbor-infrastructure/
  src/main/java/com/harbor/hotel/infrastructure/
    persistence/{mapper,dataobject,repository,converter}
    integration/                              # 三方 HTTP/RPC 客户端及适配器
```

所有资源文件放在 `harbor-start/src/main/resources`：包括 `application.yml`、日志配置和 MyBatis XML。Mapper 接口、DO、转换器与 Repository 实现仍归 infrastructure 所有；XML 按 `mapper/<业务>` 分目录，由 start 模块配置扫描。花括号表示并列子包，不是实际目录名。不要创建无职责接口、空目录或承载全部业务的 OrderService/BaseService。

### 3.4 各模块实施规则

- 对端（HTTP、任务回调、三方回调）返回对象统一命名为 `XxxVO`；app 内部用例输入、输出和跨类传递对象统一为 `XxxDTO`；MyBatis 的入参、出参和持久化载体统一为 `XxxPO`。禁止 Controller 直接返回 DTO/PO，禁止领域模型、DO/PO 作为接口响应。
- 对象转换统一抽取到业务就近的 `transfer` 包，方法名使用 `toVO`、`toDTO`、`toPO`、`toDomain` 等明确方向。Controller、Processor、Repository 和 Mapper 中不内联字段搬运；一对多、金额、时间、空值与枚举转换必须在 Transfer 中显式处理。
- VO 仅表达对端契约，DTO 仅表达内部用例数据，PO 仅表达数据库访问；三者不得继承或复用为同一类型。新增字段按边界分别评审，避免数据库字段直接泄露到接口。
- api 只负责协议转换、参数校验、认证入口和调用 app；Controller、Job Handler 不直接调用 Mapper、Repository 实现或三方客户端。
- Spring 管理组件中的业务依赖统一使用字段 `@Resource` 注入，不使用构造器注入；字段不声明 `final`。领域对象及由 Factory 创建的对象保留构造参数以表达创建所需状态和依赖，不使用 Spring 注入。
- app 是业务用例编排层：所有写操作为 Processor，查询为 Qurier。Processor 只调用领域 Factory 创建对象并触发领域动作，不直接注入 Repository、Mapper 或实现状态机；Qurier 可注入 infrastructure 中无 DML、无锁定读的只读 Mapper，并直接返回查询 DTO。
- domain 承担业务不变量、状态变更和需要持久化协作的业务动作。领域对象只通过 Factory 创建，Factory 接收 Repository 接口并将其注入对象；不出现 Controller、Mapper、DO、HTTP Client、Spring Security 或 XXL-JOB 类型。
- infrastructure 实现领域 Repository，并封装 MySQL、MyBatis 和三方请求细节；不得包含 Controller、Processor、Qurier 或业务流程编排。
- start 只负责启动和配置，不放 Controller、Processor、Qurier、领域规则、Mapper 接口或 Repository 实现；允许在配置类中完成 Repository 到领域 Factory 的依赖装配。资源文件也不得承载未在 infrastructure 定义归属的业务 SQL。

<a id="cqrs"></a>

## 4. Processor 与 Qurier

### 4.1 写操作统一 Processor

业务新增、修改、删除、状态变更、库存同步、回调、在线导入和运行时修复均通过 Processor。Controller、Job Handler、未来消息入口不得直接写库。DDL 和经审批的一次性离线迁移属于发布流程，不是在线业务绕过模型的借口。

| 用例 | 类名 | 方法 |
|---|---|---|
| 员工登录 | LoginProcessor | process(LoginCommand) |
| 员工退出 | LogoutProcessor | process(LogoutCommand) |
| 创建预订 | CreateBookingProcessor | process(CreateBookingCommand) |
| 整批入住 | CheckInOrderProcessor | process(CheckInOrderCommand) |
| 取消预订 | CancelBookingProcessor | process(CancelBookingCommand) |
| 初始化单房型单日期库存 | InitializeDailyInventoryProcessor | process(InitializeDailyInventoryCommand) |

登录、退出是认证支撑用例，通过认证端口和Spring Security适配层处理；登录不要求已有员工会话。Session/Cookie操作不属于库存写事务，不写订单成功审计。Servlet请求和SecurityContext保留在安全适配层，不传入领域模型。密码只在当前认证调用中使用，不能持久化Command、打印其内容或放进重试队列。

- 一个 Processor 对应一个明确用例，不用 action + Map 混合多个操作。
- Processor 只编排可信身份、事务、幂等入口、Factory 创建和领域动作调用；Repository 加载、持久化协作、状态机、库存算术和业务审计由领域对象完成。
- 写前决策所需读取由携带 Repository 的领域对象完成；不能把 Qurier 的展示 DTO 当作可修改聚合。
- Processor 使用构造器注入 Factory 和不可变 Command；领域对象由 Factory 创建，操作人、当前时间从可信服务端上下文获得。
- 返回用例结果 DTO，不暴露聚合、DO 或数据库异常。
- 默认禁止 Processor 互调；共享业务规则下沉领域模型/领域服务，纯转换提取应用辅助类。
- 不捕获异常返回失败对象而让事务提交；错误在事务回滚后由入口转换。

取消用例编排示意，**不是可编译的完整实现**，辅助类型与具体实现需补齐：

```java
@Component
public class CancelBookingProcessor {
    // Repository、领域服务、Clock 等均通过构造器注入。

    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public CancelBookingResult process(CancelBookingCommand command) {
        Actor actor = actorContext.requireEmployee();
        Long roomTypeId = orderRepository.findRoomTypeId(command.orderId());
        roomTypeRepository.lockById(roomTypeId);
        BookingOrder order = orderRepository.getForUpdate(command.orderId());
        accessPolicy.requireCanCancel(actor, order);
        order.requireRoomType(roomTypeId);
        // Repository 内按原日期顺序锁库存，再锁占用凭证。
        CancellationInventory inventory = inventoryRepository.lockForCancellation(order);
        if (order.isCancelled()) {
            inventory.requireCompleteCancelledReservations(order);
            return resultAssembler.originalCancellation(order);
        }
        cancellationDomainService.cancel(
                order, inventory, actor, clock.instant(), command.reason());
        inventoryRepository.saveCancellation(inventory);
        orderRepository.save(order);
        operationLogRepository.append(order.cancellationFact());
        return resultAssembler.cancellation(order);
    }
}
```

CancellationInventory 是本用例加载的领域对象集合，不是额外的永久大聚合。领域服务验证订单、凭证及跨聚合规则并调用模型行为；Repository 检查条件更新行数。事务代理完成提交后 Controller 才能返回成功，构造结果 DTO 不代表已提交。

### 4.2 查询统一 Qurier

| 用例 | 类名 | 方法 |
|---|---|---|
| 当前登录员工 | GetCurrentEmployeeQurier | query() |
| 分页查订单 | PageOrderQurier | query(PageOrderQuery) |
| 查订单详情 | GetOrderDetailQurier | query(GetOrderDetailQuery) |
| 可订房型 | ListAvailableRoomTypeQurier | query(ListAvailableRoomTypeQuery) |
| 候选房号 | ListAvailableRoomQurier | query(ListAvailableRoomQuery) |
| 首页 | GetDashboardQurier | query(GetDashboardQuery) |

- Qurier 直接调用 XxxReadMapper，允许 XML JOIN/统计/分页并直接返回页面 DTO。
- 必须验证授权范围、参数、分页上限、排序白名单及敏感字段；“直接查库”不等于跳过权限。
- 禁止 DML、写 Repository/Processor、锁定读及有写副作用的存储过程；不能顺便初始化库存、修复状态或写成功业务审计。技术访问日志不属于业务写用例。
- 普通单条查询按需使用只读事务；首页多条统计在同一 REPEATABLE_READ 只读事务中使用一致性非锁定读，或合并为单条 SQL。
- readOnly=true 不是禁写安全边界，还须 Mapper 隔离、XML 检查、测试；条件允许时可加只读账号。
- 详情不存在返回 404；空列表返回 []。查询结果不必经过聚合，展示 DTO 不作为写入依据。

### 4.3 禁止的实现

| 违规 | 正确处理 |
|---|---|
| Controller/Job 直接 Mapper 更新 | 入口 → Processor → 领域行为 → Repository。 |
| Processor 调 setStatus、手工加减库存 | 调 order.cancel、inventory.cancelReservation 等行为。 |
| Qurier 查不到库存就 INSERT | 返回 INVENTORY_NOT_READY，由任务 Processor 初始化。 |
| Repository 接收 HTTP Request 决定业务状态 | 输入在应用层转换、规则在领域层判断。 |
| DomainService 包办所有规则、模型只剩字段 | 聚合维护自身不变量，领域服务仅处理跨对象规则。 |

<a id="domain"></a>

## 5. 充血领域模型

### 5.1 模型设计要求

- 聚合根是聚合修改入口，子实体不得被外部任意修改；集合返回不可变视图或防御性副本。
- 聚合不开放通用 setter，不使用 Lombok @Data 自动暴露全部字段；读取方法只开放必要信息。
- 新建使用明确工厂，如 BookingOrder.create；从库重建使用受控 reconstitute，校验持久化状态但不再次执行下单、扣库存。
- 重建不能用“今天的预订窗口”拒绝合法历史订单；新建规则与历史数据结构校验分开。
- Money 用 BigDecimal，明确币种、精度、舍入和范围；StayPeriod 保证离店日晚于入住日，值对象不可变。
- 领域服务承载不适合单实体的规则，如整批分房、订单与多晚库存的联合校验，不能替代实体自身行为。
- 模型不查 Mapper、不发 HTTP、不提交事务、不写技术日志；当前时间、操作人、外部结果以显式参数传入。

### 5.2 必须保护的不变量

| 模型 | 规则 |
|---|---|
| 订单 | PENDING → CHECKED_IN 或 PENDING → CANCELLED；终态不互转；成交快照不变。 |
| 库存 | total = booked + checkedIn + available，所有数量非负；操作数量至少为 1。 |
| 占用凭证 | 每单每晚唯一、数量等于订单间数；locked → release 或 locked → cancel，终态不可逆。 |
| 入住 | Q 个不同房间、各房人数合法、全部覆盖 N 晚；整批成功或整体失败。 |
| 物理房态 | 候选满足 READY 和日期明细；到点、同步或取消不能把 OCCUPIED 自动改为 READY。 |

现有存储值 release 表示预订占用转为入住占用，不是归还可售库存。领域枚举可命名 CONVERTED_TO_CHECKIN，通过显式转换映射到 release；不使用枚举 ordinal 存库。

库存模型行为节选，省略标识、工厂和访问方法；DomainException 在项目中定义：

```java
public final class RoomTypeInventory {
    private final int totalRooms;
    private int bookedRooms;
    private int checkedInRooms;
    private int availableRooms;

    private RoomTypeInventory(int totalRooms, int bookedRooms,
                              int checkedInRooms, int availableRooms) {
        this.totalRooms = totalRooms;
        this.bookedRooms = bookedRooms;
        this.checkedInRooms = checkedInRooms;
        this.availableRooms = availableRooms;
        verifyInvariant();
    }

    public void cancelReservation(int quantity) {
        verifyInvariant();
        if (quantity <= 0 || bookedRooms < quantity) {
            throw new DomainException("INVENTORY_STATE_CONFLICT");
        }
        bookedRooms -= quantity;
        availableRooms += quantity;
        verifyInvariant();
    }

    private void verifyInvariant() {
        if (totalRooms < 0 || bookedRooms < 0 || checkedInRooms < 0
                || availableRooms < 0
                || (long) bookedRooms + checkedInRooms + availableRooms != totalRooms) {
            throw new DomainException("INVENTORY_DATA_INCONSISTENT");
        }
    }
}
```

该方法仅保护单晚数量；整笔取消仍须验证订单状态、原连续 N 晚和完整凭证，并由同库事务保存。数据库条件更新不可省略。

### 5.3 Repository 与业务事实

- Repository 接口在 domain，使用领域类型；实现在 infrastructure，负责 DO 转换、加载、锁定和持久化异常翻译。
- 按聚合/业务持久化边界设计，不要求一表一个 Repository；不向上层返回 DO，不自行另开事务。
- 方法名明确是否锁定；保存状态变化须条件更新及行数检查，不能通用 updateById 无条件覆盖。
- 成功操作审计由领域事实生成，Processor 经持久化端口与业务同事务写入，不能由技术日志代替。
- 不强制引入事件总线；未来可靠外部通知需要评审 outbox/事务消息。单纯提交后内存回调不能保证故障恢复后的可靠投递。

<a id="persistence"></a>

## 6. MyBatis XML 与数据库

### 6.1 映射与 SQL

- 所有业务 SQL 写 XML；禁止 @Select/@Update/Provider 注解及 Java 拼接 SQL。
- namespace 等于 Mapper 接口全名，statement ID 等于方法名；方法不重载。
- 持久化对象命名 XxxDO，与聚合通过显式 Converter 转换；领域模型不带 ORM 注解。
- 明确列名，不用 SELECT *；使用 resultMap 或经过检查的列别名处理联表重名、布尔字段及类型转换。
- 参数值统一 `#{...}`，禁止原样字符串替换接收用户值；排序列通过服务端枚举和 XML choose 白名单映射。
- 多参数使用明确 @Param 或专用参数对象；提前处理空集合，防止空 IN、漏 WHERE 和全表操作。
- Java 布尔属性不带 is 前缀，如 deleted 显式映射 is_deleted，不因此修改现有数据库列名。
- 所有写入检查预期影响行数；关键并发写使用普通执行器，不依赖无法立即得到逐条行数的批处理结果。
- 禁用 MyBatis 二级缓存，写决策不能读取跨事务陈旧数据；生产禁止输出带敏感值的 SQL 参数。

配置基线，10 秒为待实测调整的初始超时：

```yaml
mybatis:
  mapper-locations: classpath*:mapper/**/*.xml
  configuration:
    map-underscore-to-camel-case: true
    cache-enabled: false
    local-cache-scope: STATEMENT
    default-statement-timeout: 10
    log-impl: org.apache.ibatis.logging.slf4j.Slf4jImpl
```

XML 参数与映射机制参见 [MyBatis Mapper XML](https://mybatis.org/mybatis-3/sqlmap-xml.html)。

### 6.2 条件写入示例

以下仅为取消预订的单晚持久化片段，由 Repository 在领域校验完成且取得统一锁后执行：

```xml
<mapper namespace="com.example.hotel.infrastructure.persistence.mapper.RoomTypeInventoryMapper">
    <update id="cancelReservation">
        UPDATE room_type_inventory
        SET booked_rooms = booked_rooms - #{quantity},
            available_rooms = available_rooms + #{quantity}
        WHERE id = #{inventoryId}
          AND room_type_id = #{roomTypeId}
          AND is_deleted = 0
          AND #{quantity} > 0
          AND booked_rooms >= #{quantity}
          AND total_rooms = booked_rooms + checked_in_rooms + available_rooms
    </update>
</mapper>
```

该语句必须影响 1 行，并将本单该晚凭证从 locked 条件更新为 cancel，也要求影响 1 行。任一失败回滚订单、全部日期、凭证及审计。领域模型保证业务含义，SQL 是并发和数据异常的最终防护，两者均须保留。

### 6.3 数据库规则

- 沿用 id/is_deleted/create_time/update_time；数据库 snake_case，Java camelCase。主键、唯一键和索引以 schema.sql 为准。
- 订单、库存、凭证、入住和审计禁止逻辑/物理删除；取消使用状态，不提供通用删除接口。
- 现有方案不加外键/CHECK，领域校验和条件更新承担逻辑关联及不变量；主键、唯一键、非空等仍保留。
- 金额使用 DECIMAL，禁止 FLOAT/DOUBLE；时间和精度按第 8 章约定。
- 重要 SQL 在目标 MySQL 使用 EXPLAIN 验证；避免 N+1。先分页订单主表，再批量补齐子集合，不联表分页产生重复订单。
- 分页默认 20、最大 100，必须稳定排序，如 create_time DESC, id DESC；筛选类型和范围在服务端验证。
- 已部署库使用版本化、经评审的迁移 SQL；不能重跑空库建表/种子，不能用 REPLACE 或忽略错误掩盖冲突。
- SQL 变更同步字段字典与技术方案。本轮只新增规范，不修改表结构。

<a id="transaction"></a>

## 7. 事务、并发与幂等

### 7.1 事务边界

- 业务数据写Processor公开入口是默认事务边界，使用 @Transactional(rollbackFor = Exception.class)；写隔离级别沿用 READ COMMITTED。登录与退出不修改业务数据，不为会话操作开启库存事务。
- 必须经过 Spring 代理调用；this.process 或同类自调用不能被当作开启了事务。批量任务的单元 Processor 为独立 Bean。
- 一个用例使用同一 DataSource/事务管理器，写 Mapper 和审计参加同一事务；禁止 Repository 偷用 REQUIRES_NEW 提交部分数据。
- 事务内不等待远程请求、用户输入或重试退避，不以异步线程拆散事务。
- 不吞数据库异常后继续提交；确定回滚的瞬态错误才在事务外有限重试，每次新开事务。
- 必须用集成测试验证事务代理与回滚，不能只检查注解存在。[Spring 事务说明](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)

### 7.2 统一锁顺序

**房型 → 已有订单 → 日期升序库存 → 对应占用凭证 → room_id 升序物理房间 → 日期及 room_id 升序库存明细 → 入住记录、入住人及审计。**

不存在的步骤跳过。普通读只能用于定位，拿锁后复核；页面候选不构成最终分房承诺。任一行数不符、任一晚不足或任一房间冲突整笔回滚。JVM 锁、按钮禁用、任务阻塞策略都不能替代数据库锁与唯一键。

### 7.3 幂等与结果未知

| 操作 | 幂等依据 | 重复处理 |
|---|---|---|
| 创建预订 | (create_by, booking_request_id) 唯一键 + 规范化请求摘要 | 同键同参返回原单；异参 409；原单取消也不重新创建。 |
| 整批入住 | 原订单、操作员工、批次键、整批摘要及完整入住事实 | 同批返回原全部结果；更换房间/入住人/身份的冲突重试拒绝。 |
| 取消 | 原订单状态 + 完整 cancel 凭证 | 返回首次结果，不重复还库存，不覆盖首次原因/员工。 |
| 库存初始化 | 房型/日期及库存/房间唯一键 + 完整性校验 | 完整跳过，异常报告，不覆盖或重建。 |

- 摘要在规范化后计算，固定字段、房间排序、金额表示和版本；不直接对顺序不稳定的原 JSON 做摘要。
- requestId、traceId、幂等键用途不同；HTTP 重试可换请求追踪 ID，不能换原业务幂等键。
- 成功重试先读原事实，不因现价、滚动窗口或跨日重新否定成功操作；仍须认证和授权。
- COMMIT 结果未知时不能假定失败并补偿；恢复后查主库、原键确认，接口返回 RESULT_UNKNOWN 时展示“结果待确认”。
- 唯一键冲突先回滚，再开新事务核对原事实；不能在已经失败的事务里继续业务。

<a id="api"></a>

## 8. API 与前后端协作

### 8.1 接口和对象

- 路径以技术方案第5章为准：订单GET接口保留 /api/orders，POST接口使用 /api/booking_orders，对应子路径沿用同一前缀。GET 无业务副作用，命令使用既有 POST 操作接口。
- HTTP Request/Response 属于 adapter，Command/Query/用例 DTO 属于 application；显式转换，不反射全量复制敏感字段。
- 对外 JSON lowerCamelCase，技术方案输入概要中的 room_count 对应 HTTP roomCount；OpenAPI 必须给出精确字段映射。
- 不直接序列化 DO 或聚合；接口契约写清参数、权限、错误码、幂等和超时恢复方法。新增兼容字段可扩展，删除或改义须评审。

统一响应示例：

```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "orderId": "10001",
    "orderNo": "B202608270001",
    "status": "PENDING",
    "totalAmount": "398.00"
  },
  "requestId": "8a23173e-a41b-4cbb-8a6d-c5ca63cc4852",
  "traceId": "97ae12b4d53a4098b0e93f68126c704d"
}
```

分页使用 data.items/total/pageNo/pageSize，空集合 []；错误 data 默认 null，可按契约返回安全的字段错误信息。前端按 code 处理，不解析 message。

| HTTP 状态 | 含义 | 错误码示例 |
|---|---|---|
| 200 / 201 | 查询/操作成功；首次创建可 201 | SUCCESS |
| 400 | 参数格式或范围错误 | INVALID_ARGUMENT |
| 401 / 403 | 未认证 / 无权限 | UNAUTHENTICATED / FORBIDDEN |
| 404 | 授权范围内目标不存在 | ORDER_NOT_FOUND |
| 409 | 状态、库存、价格、房间或幂等冲突 | ORDER_STATE_CONFLICT / IDEMPOTENCY_CONFLICT |
| 503 | 待初始化、依赖暂不可用或结果未知 | INVENTORY_NOT_READY / RESULT_UNKNOWN |
| 500 | 未预期异常、数据不一致 | INTERNAL_ERROR / INVENTORY_DATA_INCONSISTENT |

不得全部返回 HTTP 200；RESULT_UNKNOWN 使用 503 仍不表示写入失败，不允许客户端自动换键重试。

### 8.2 时间、金额与身份

- 日期 YYYY-MM-DD；时刻返回带偏移的值，如 2026-08-27T12:00:00+08:00。
- 酒店时区 Asia/Shanghai；已有 DATETIME(3) 保存酒店本地时间，转换显式指定时区，不直接按 UTC 解释。
- 入住日包含、离店日不包含，晚数按 LocalDate 计算，不使用毫秒除以 24 小时。
- BIGINT ID 转为 JSON 字符串。Java Long 仅支持有符号范围，数据库 UNSIGNED ID 的应用上限仍限制为 Long.MAX_VALUE。
- 金额后端 BigDecimal、数据库 DECIMAL，对外固定小数位字符串，单位人民币元；具体舍入在价格规则中明确。
- 操作员工来自认证上下文，不采信客户端审计员工、最终价格、库存变化量或锁状态。

<a id="job"></a>

## 9. XXL-JOB 定时任务

### 9.1 调用与事务

- 所有业务定时任务统一 XXL-JOB，不用 @Scheduled 重复跑相同任务；这里不是对话提醒或自动化。
- Handler 放 adapter/job，使用 `@XxlJob("syncFutureInventoryJob")` 注册唯一名称。
- Handler 仅解析/验证参数、捕获酒店日期、通过 Qurier 获取处理目标、枚举单元、调用 Processor、汇总和上报，不直接写库或实现状态机。
- 7 天窗口基准在执行开始时捕获一次，避免跨午夜改变窗口；是否含今天仍遵循产品待确认结果。
- 每个“房型 + 日期”通过独立 InitializeDailyInventoryProcessor 事务执行，不给整个批次加大事务。
- 如启用启动补齐，调用同一 Processor；首次部署也可由调度中心手动触发。应用启动成功不等于库存就绪。

### 9.2 重试与运维

- 不假设任务只执行一次，调度重试、重启、手动触发都可能重复；正确性靠领域规则、锁和唯一键。
- 推荐单机串行阻塞策略；部署路由另外确定。调度层防重只减少重复工作，不提供业务恰好一次保证。
- 成功单元可先提交；部分失败必须报告失败单元并标记任务失败，不吞异常上报整体成功。
- 确定已回滚的死锁等瞬态错误，最多额外重试 3 次，间隔 1、3、10 秒，退避在事务外；数据异常不自动重试。
- 默认只做单元重试，不叠加整任务自动重试放大次数；人工整批重跑由幂等跳过已成功单元。
- 连接中断或提交结果未知先核对单元完整性；不能把所有连接异常都当作已回滚。
- 记录 jobName/logId/traceId、范围、成功/跳过/失败数、失败房型日期和耗时；通过锁定版本 API 明确上报失败。
- 建议每日 00:05、Asia/Shanghai 调度；具体时间、超时和告警接收人待确认。
- 调度中心和执行器限制网络访问、配置 token，管理入口不暴露公网，凭证不进仓库。
- XXL-JOB 自身调度数据库单独管理，不属于当前 10 张业务表；业务 executor 仍在同一业务后端。

注册、失败上报及阻塞策略以锁定版本 [XXL-JOB 官方文档](https://github.com/xuxueli/xxl-job/blob/master/doc/XXL-JOB%E5%AE%98%E6%96%B9%E6%96%87%E6%A1%A3.md) 为准；中心和执行器须实测匹配，依赖可下载不代表兼容已验证。

<a id="logging"></a>

## 10. SLF4J 日志与文件

“日志文件要一般写”暂按**日志要规范记录并写入文件**理解；若另有格式或输出目标要求，再调整本章。

### 10.1 门面、级别与记录位置

- 统一 org.slf4j.Logger/LoggerFactory，非领域层可使用 Lombok @Slf4j；禁止 System.out/err、printStackTrace 和业务直接绑定 Logback API。
- 使用 Boot 默认集成的 Logback，配置文件 logback-spring.xml；仅保留一个 SLF4J provider，避免桥接循环。[SLF4J 手册](https://slf4j.org/manual.html)、[Boot 日志配置](https://docs.spring.io/spring-boot/3.5/reference/features/logging.html)

| 级别 | 用途 |
|---|---|
| DEBUG | 开发诊断；生产默认关闭，临时开启须受控且仍要脱敏。 |
| INFO | 关键业务结果、任务摘要、必要运行信息。 |
| WARN | 需要关注的可恢复异常、重试及异常趋势。 |
| ERROR | 未预期失败、数据不一致、关键依赖异常。 |

参数错误、正常售罄、重复已取消请求不刷 ERROR。相同异常只在最外层可处理边界记一次堆栈：HTTP 统一异常处理器或任务 Handler；下层补上下文并抛出，不层层重复打印。

### 10.2 内容、追踪与脱敏

每条日志包含时间、等级、线程、logger、traceId/requestId；关键操作增加 operation、orderId/orderNo、operatorId、result、durationMs，任务增加 jobName/logId。

```java
private static final Logger LOGGER = LoggerFactory.getLogger(BookingController.class);

// 仅展示格式；COMMITTED 摘要应在事务提交后的边界记录。
LOGGER.info("operation={} orderId={} operatorId={} result={} durationMs={}",
        "CREATE_BOOKING", orderId, operatorId, "COMMITTED", durationMs);

// 在统一异常边界记录；safeCause 需经过敏感信息处理策略。
LOGGER.error("operation={} orderId={} errorCode={}",
        operation, orderId, errorCode, safeCause);
```

- 使用 {} 参数化日志，不拼字符串；异常对象放最后，昂贵诊断内容先检查级别。
- 不打印完整 Request/Response/Command/聚合/DO；不打印客人姓名、完整电话/证件、密码、Cookie、Authorization、SQL 绑定值及调度 token。
- 需要电话定位时按明确规则脱敏；证件默认不入技术日志，业务 ID 足够定位时不再增加个人信息。
- 数据库异常消息也可能带敏感键值：统一处理须清理异常消息及 cause 链中的敏感信息，保留异常类型、堆栈位置和错误码。“没有打印请求体”不等于安全。
- 外部文本限制长度、清理 CR/LF 等控制字符，防日志注入；下面的 pattern 不自动完成业务数据脱敏。
- Filter 创建或校验追踪 ID，写 MDC，finally 清理；线程池和任务入口显式传播/初始化，并恢复线程原上下文。
- 客户端追踪头必须限制格式和长度；没有追踪系统时可生成应用相关性 ID，有追踪系统时沿用其 traceId。
- 不能在事务提交前写“已成功”作为唯一事实；提交前只记阶段，成功审计同业务事务落库。
- 查询和框架 SQL 日志默认不输出敏感参数，禁止给整个 Mapper 包打开生产 DEBUG/TRACE。

### 10.3 文件与保留

| 输出 | 内容 | 初始策略 |
|---|---|---|
| application.log | INFO 及以上，包含 WARN/ERROR | 按日且 100MB 滚动，归档 30 天、总上限 10GB。 |
| error.log | 仅 ERROR | 按日且 100MB 滚动，归档 90 天、总上限 5GB。 |
| XXL-JOB 执行日志目录 | 执行器调度日志 | 独立路径和清理策略，建议先按 30 天评估。 |
| order_operation_log | 成功业务事实 | 按业务审计要求保存，不随应用日志删除。 |

天数和容量为工程初始值，需运维确认。容量先满时归档可提前清理，maxHistory 不是保证保存天数。ERROR 同时进入 application/error 是有意路由，采集侧避免重复告警。

### 10.4 Logback 配置基线

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <springProperty scope="context" name="LOG_PATH"
                    source="logging.file.path" defaultValue="./logs"/>
    <property name="LOG_PATTERN"
              value="%d{yyyy-MM-dd'T'HH:mm:ss.SSS,Asia/Shanghai} %-5level [%thread] traceId=%X{traceId:-none} requestId=%X{requestId:-none} %logger{48} - %msg%n%ex"/>
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <charset>UTF-8</charset>
            <pattern>${LOG_PATTERN}</pattern>
        </encoder>
    </appender>
    <appender name="APPLICATION" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_PATH}/application.log</file>
        <filter class="ch.qos.logback.classic.filter.ThresholdFilter">
            <level>INFO</level>
        </filter>
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${LOG_PATH}/archive/application.%d{yyyy-MM-dd,Asia/Shanghai}.%i.log.gz</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>30</maxHistory>
            <totalSizeCap>10GB</totalSizeCap>
            <cleanHistoryOnStart>true</cleanHistoryOnStart>
        </rollingPolicy>
        <encoder>
            <charset>UTF-8</charset>
            <pattern>${LOG_PATTERN}</pattern>
        </encoder>
    </appender>
    <appender name="ERROR_FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_PATH}/error.log</file>
        <filter class="ch.qos.logback.classic.filter.LevelFilter">
            <level>ERROR</level>
            <onMatch>ACCEPT</onMatch>
            <onMismatch>DENY</onMismatch>
        </filter>
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${LOG_PATH}/archive/error.%d{yyyy-MM-dd,Asia/Shanghai}.%i.log.gz</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>90</maxHistory>
            <totalSizeCap>5GB</totalSizeCap>
            <cleanHistoryOnStart>true</cleanHistoryOnStart>
        </rollingPolicy>
        <encoder>
            <charset>UTF-8</charset>
            <pattern>${LOG_PATTERN}</pattern>
        </encoder>
    </appender>
    <root level="INFO">
        <appender-ref ref="CONSOLE"/>
        <appender-ref ref="APPLICATION"/>
        <appender-ref ref="ERROR_FILE"/>
    </root>
</configuration>
```

滚动参数含义见 [Logback Appenders](https://logback.qos.ch/manual/appenders.html)。配置是待接入工程的基线，仍须真实启动、滚动、目录权限和磁盘异常测试。

- 生产 logging.file.path 使用专用绝对路径、最小目录权限，不在 Web 静态资源目录；容器须挂持久卷，不能仅写临时层。
- 多实例使用独立目录/卷，禁止多 JVM 争写同一文件；采集增加服务名、环境、实例标签。
- 控制台可以保留，生产同时满足落盘及采集；磁盘余量、写入失败和采集延迟需告警。
- 不默认启用异步 appender；后续启用须明确队列满时的阻塞/丢弃和停机刷新策略，不宣称日志绝不丢失。
- 技术日志落盘失败须告警，但不能据此推断业务回滚；业务审计表插入失败则必须回滚原业务事务。

<a id="java"></a>

## 11. Java 编码、异常与安全

### 11.1 黄山版执行方式

完整采用黄山版作为编码审查基线，覆盖命名、集合、并发、异常日志、单测、安全、SQL 和工程依赖。以下为项目补充，不是手册原文摘抄：

- 采用兼容 JDK 21 的格式化、Checkstyle/PMD 及人工评审；P3C 只覆盖部分规则，“插件无提示”不代表全部合规。[阿里官方 P3C 仓库与黄山版手册](https://github.com/alibaba/p3c)
- Java 4 空格缩进；类 UpperCamelCase，方法/变量 lowerCamelCase，常量 UPPER_SNAKE_CASE，包名全小写。
- 公共类、方法及复杂规则写清职责、参数、异常和边界；注释解释原因。TODO 写明原因和跟踪事项。
- 禁止魔法值、空 catch、无界线程池/队列；线程池明确名称、容量、拒绝策略及关闭方式。
- BigDecimal 不从 double 构造；数值等价用 compareTo，需要区分 scale 时才用 equals。
- 使用 java.time，业务当前时间通过 Clock 注入；测试不能依赖真实日期。
- equals/hashCode 语义一致；不把可变对象作哈希键，不违规修改迭代中的集合，空集合不返回 null。
- record 可用于不可变 Command/Query/DTO/值对象，可变聚合不机械改为 record。
- 不默认开启 JDK 21 虚拟线程；采用前验证 JDBC 池、上下文传播和并发上限，不能视为无限并发许可。

### 11.2 异常与安全

- 领域异常表达业务失败；基础设施异常翻译为应用可识别的错误，保留安全上下文，不向用户返回 SQL、表结构或堆栈。
- 统一异常处理器映射错误码、返回追踪 ID 并记录一次安全日志；不能吞异常、返回伪成功。
- 认证、授权与字段可见性覆盖查询和写入；不能只查“已登录”就放开任意客人信息。
- 密码仅保存密码哈希算法结果，由认证框架验证；禁止明文、可逆加密或普通快速摘要替代密码哈希。
- 登录默认采用同源部署和服务端Session，按单实例设计；生产Cookie配置HttpOnly、Secure、SameSite=Lax并开启CSRF。空闲超时默认30分钟且配置化，不全局关闭防护解决联调。
- 复用sys_employee验证账号、密码哈希及未删除状态；登录失败统一文案并限流。自定义登录须完整执行Spring Security会话认证策略和认证上下文保存；退出通过框架使会话与上下文失效，不能只删除前端数据。认证响应禁止缓存。
- CORS 只放行必要来源，携带凭证的接口不放任意来源；生产 HTTPS。
- 数据库凭证、XXL-JOB token、会话密钥通过环境/密钥管理提供，仓库仅存无敏感值模板。
- 客人信息最小化采集、显示；敏感信息查看和导出单独授权，采集/加密/保留要求上线前评审，本文不替代合规确认。

<a id="quality"></a>

## 12. 测试、交付与评审

### 12.1 测试层次

| 类型 | 必测内容 |
|---|---|
| 登录与会话 | 预置账号、正确/错误/已删除身份、限流、CSRF、会话恢复与过期、退出后旧Cookie失效、切换员工的数据隔离。 |
| 领域单测 | 状态转换、非法操作、守恒、金额/日期边界和历史重建；不启动 Spring/数据库。 |
| Processor 测试 | 正确领域调用、授权、幂等、保存和异常传播；Mock 不证明真实回滚。 |
| MySQL 集成 | 目标 MySQL 8.4 的 XML、唯一键、条件行数、事务和锁，不以 H2 证明并发正确。 |
| 架构测试 | domain 无框架；Processor 无 Mapper；Qurier 只用 ReadMapper；无层间循环。 |
| 前端组件 | 校验、加载/空/失败态、过期响应丢弃、待确认结果及权限展示。 |
| 端到端 | 预订→多房入住、预订→取消、重复提交、超时恢复及刷新。 |
| 任务/日志 | 重跑、部分失败、跨日基准、失败上报、MDC 清理、泄漏、滚动和目录不可写。 |

关键故障场景：最后一间并发预订；同键同参/异参；入住与取消竞争；Q×N 任一项失败整笔回滚；提交成功响应丢失；提交结果未知；库存同步与预订竞争；审计插入失败。案例复用 [技术方案中的验证记录](酒店管理系统技术方案.md#verification)。

### 12.2 合并门禁

工程建成后配置以下 CI；当前尚无前后端脚手架，不能声称这些命令已通过：

```text
前端：pnpm install --frozen-lockfile
      pnpm lint
      pnpm format:check
      pnpm typecheck
      pnpm test:unit
      pnpm build
      pnpm test:e2e（需专用后端和测试数据）

后端：./mvnw verify
      包含单测、架构/静态检查及已配置的集成测试
```

- 关键领域变化有成功、拒绝和边界测试；事务变化有真实数据库测试，不只追求覆盖率数字。
- 集成测试用隔离环境；环境缺失明确标记未运行，不静默跳过后声称全通过。
- 新增静态检查错误必须解决；自动化不能覆盖的黄山版规则与业务一致性由人工评审补足。
- 小批量提交，说明范围和原因，例如 feat(booking): add cancellation processor。
- PR 包含需求、模型/接口/SQL 变更、兼容性、验证证据、配置和发布步骤；迁移说明备份、回滚或前向修复。
- 数据库与应用分阶段兼容发布；演示种子不导入生产，人工修复须审批、备份、影响核对和审计。

### 12.3 代码评审清单

- [ ] Vue/API/类型/组件规范一致，处理失败及结果待确认。
- [ ] 登录页、me、退出与CSRF接入完整；匿名不能访问业务，密码和会话不泄漏，退出不影响订单库存。
- [ ] 业务写入口统一 Processor，查询入口统一 Qurier。
- [ ] 领域模型充血，无任意 setter，领域服务不包办全部规则。
- [ ] Processor 只经 Repository 写入，ReadMapper 无 DML/锁定读。
- [ ] 分层无环，domain 不引用框架、DO、HTTP。
- [ ] SQL 全在 XML，参数化、分页、排序及敏感字段正确。
- [ ] 事务经代理生效，锁顺序统一，影响行数检查完整。
- [ ] 幂等、原结果查询、结果未知恢复路径完整。
- [ ] 任务不覆盖库存，重跑安全，部分失败正确上报。
- [ ] SLF4J 脱敏、落盘、滚动及 MDC 清理正确，业务审计同事务。
- [ ] 查询与写入都授权，配置无密钥，异常无内部细节。
- [ ] 测试与文档同步，明确已验证与待验证。

<a id="decisions"></a>

## 13. 待确认事项与维护

下列事项不阻碍创建工程，但相关功能验收或上线前必须明确：

1. Spring Boot 3.5、MyBatis Starter、XXL-JOB 及前端组件的具体补丁版本和安全维护计划。
2. Maven groupId/Java 根包、代码托管和 CI；MySQL 8.4 部署方式。
3. 登录默认采用同源Session；确认预置账号交付及重置负责人、空闲时长和限流阈值。若增加后端副本，另定共享/路由方案。
4. 7 天是否含今天、00:05 调度和启动补齐是否采用；既有跨日入住等业务待确认项不在本文擅自决定。
5. 生产日志路径、容量、保留和采集、告警接收人；“日志文件要一般写”是否另有含义。
6. 真实客人信息采集、加密、访问审计和保留；真实运营退房/清洁闭环另行设计。

**维护约定：**本文独立保留、人工维护，不由生成脚本覆盖。技术选型变化同步技术方案第1章概述；技术方案正文也直接在统一文档内维护，字段字典、时序图和SQL附录通过生成脚本同步。

**依据说明：**DDD 边界、Processor/Qurier、锁顺序及业务状态是项目约定，不宣称为框架官方要求。黄山版全文见 [阿里官方仓库](https://github.com/alibaba/p3c)；框架及工具的官方参考已放在对应章节。
