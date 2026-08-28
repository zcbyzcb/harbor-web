<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { hotelApi, statusText, dateTime } from "@/api/hotel-api";
import { useQuery } from "@/composables/use-query";
const filters = reactive({
  orderNo: "",
  phone: "",
  name: "",
  status: "",
  arrivalFrom: "",
  arrivalTo: "",
});
const applied = ref<object>({});
const pageNo = ref(1);
const { data, loading, error, load } = useQuery(() =>
  hotelApi.orders({ ...applied.value, pageNo: pageNo.value, pageSize: 20 }),
);
function search() {
  applied.value = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== ""),
  );
  pageNo.value = 1;
  void load();
}
function clear() {
  Object.assign(filters, {
    orderNo: "",
    phone: "",
    name: "",
    status: "",
    arrivalFrom: "",
    arrivalTo: "",
  });
  search();
}
onMounted(load);
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">ORDERS</p>
      <h1>订单管理</h1>
      <p class="muted">查询预订记录，分配房间并办理入住。</p>
    </div>
    <RouterLink to="/booking">
      <el-button type="primary">新建预订</el-button>
    </RouterLink>
  </div>
  <section class="panel">
    <el-form :inline="true" label-position="top" @submit.prevent="search">
      <el-form-item label="订单号">
        <el-input
          v-model.trim="filters.orderNo"
          placeholder="完整订单号"
          clearable
        />
      </el-form-item><el-form-item label="联系电话">
        <el-input
          v-model.trim="filters.phone"
          placeholder="完整电话号码"
          clearable
        />
      </el-form-item><el-form-item label="联系人">
        <el-input
          v-model.trim="filters.name"
          placeholder="姓名关键词"
          clearable
        />
      </el-form-item><el-form-item label="状态">
        <el-select
          v-model="filters.status"
          style="width: 150px"
          clearable
          placeholder="全部状态"
        >
          <el-option
            v-for="(label, value) in statusText"
            :key="value"
            :label="label"
            :value="value"
          />
        </el-select>
      </el-form-item>
      <div class="filters">
        <label>计划入住起始日<input
          v-model="filters.arrivalFrom"
          type="date"
        /></label><label>计划入住截止日<input
          v-model="filters.arrivalTo"
          type="date"
        /></label><el-button type="primary" native-type="submit" :loading="loading">
          查询订单
        </el-button><el-button @click="clear">重置</el-button>
      </div>
    </el-form>
  </section>
  <el-alert
    v-if="error"
    :title="error"
    type="error"
    :closable="false"
    show-icon
  />
  <section v-else class="panel">
    <el-table
      v-loading="loading"
      :data="data?.items ?? []"
      empty-text="没有符合条件的订单"
    >
      <el-table-column
        prop="orderNo"
        label="订单号"
        min-width="245"
      /><el-table-column
        prop="bookerName"
        label="联系人"
        width="100"
      /><el-table-column
        prop="bookerPhone"
        label="联系电话"
        width="140"
      /><el-table-column label="房型 / 间数" min-width="140">
        <template #default="{ row }">
          {{ row.roomTypeName }} × {{ row.roomCount }}
        </template>
      </el-table-column><el-table-column label="计划入住" min-width="155">
        <template #default="{ row }">
          {{ dateTime(row.plannedCheckinTime) }}
        </template>
      </el-table-column><el-table-column label="状态" width="100">
        <template #default="{ row }">
          <span :class="['status', row.status]">{{
            statusText[row.status as keyof typeof statusText]
          }}</span>
        </template>
      </el-table-column><el-table-column label="总价" width="105">
        <template #default="{ row }">
          ¥{{ row.totalAmount }}
        </template>
      </el-table-column><el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <RouterLink :to="`/orders/${row.id}`">详情</RouterLink>
        </template>
      </el-table-column>
    </el-table><el-pagination
      v-if="data"
      v-model:current-page="pageNo"
      :total="data.total"
      :page-size="20"
      layout="total, prev, pager, next"
      @current-change="load"
    />
  </section>
</template>
