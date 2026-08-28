<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import { hotelApi, dateTime } from "@/api/hotel-api";
import { useQuery } from "@/composables/use-query";
const { data, loading, error, load } = useQuery(hotelApi.dashboard);
onMounted(() => {
  void load();
  window.addEventListener("hotel:changed", load);
});
onBeforeUnmount(() => window.removeEventListener("hotel:changed", load));
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">TODAY AT HARBOR</p>
      <h1>今日概览</h1>
      <p class="muted">掌握今日入住与可售房量，安排每一次到店。</p>
    </div>
    <div>
      <el-button :loading="loading" @click="load">刷新看板</el-button><RouterLink to="/booking">
        <el-button type="primary">新建预订</el-button>
      </RouterLink>
    </div>
  </div>
  <el-alert
    v-if="error"
    :title="error"
    type="error"
    :closable="false"
    show-icon
  />
  <template v-if="data">
    <section class="stats" aria-label="今日房间统计">
      <article class="stat">
        <span>今日已入住</span><strong>{{ data.checkedInRooms }}<small>间</small></strong>
        <p>按今日实际办理房间数统计</p>
      </article>
      <article class="stat">
        <span>今日待入住</span><strong>{{ data.pendingCheckInRooms }}<small>间</small></strong>
        <p>计划今日到店、尚未入住</p>
      </article>
      <article class="stat accent">
        <span>剩余可售房间</span><strong>{{ data.availableRooms }}<small>间</small></strong>
        <p>今晚库存 · 含预订占用后的余量</p>
      </article>
    </section>
    <section class="panel">
      <div class="panel-title">
        <h2>今日待入住订单</h2>
        <RouterLink to="/orders">查看全部订单 →</RouterLink>
      </div>
      <el-table :data="data.pendingOrders" empty-text="今日暂无待入住订单">
        <el-table-column
          prop="orderNo"
          label="订单号"
          min-width="235"
        /><el-table-column prop="bookerName" label="联系人" /><el-table-column
          prop="roomTypeName"
          label="房型"
        /><el-table-column
          prop="roomCount"
          label="房间数"
          width="90"
        /><el-table-column label="计划到店" min-width="155">
          <template #default="{ row }">
            {{ dateTime(row.plannedCheckinTime) }}
          </template>
        </el-table-column><el-table-column label="操作" width="110">
          <template #default="{ row }">
            <RouterLink :to="`/orders/${row.orderId}`">
              查看 / 入住
            </RouterLink>
          </template>
        </el-table-column>
      </el-table>
    </section>
    <p class="footnote">
      可售库存与可交付房号分别管理。已占用的物理房间不会按计划离店时间自动恢复。
    </p>
  </template>
  <el-skeleton v-else-if="loading" :rows="8" animated />
</template>
