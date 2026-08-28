<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import {
  hotelApi,
  dateTime,
  statusText,
  changed,
  type Candidate,
  type CheckInInput,
} from "@/api/hotel-api";
import { messageOf, resultUnknown } from "@/api/http";
import { useQuery } from "@/composables/use-query";
import { useAuthStore } from "@/stores/auth-store";
const id = String(useRoute().params.id);
const auth = useAuthStore();
const { data, loading, error, load } = useQuery(() => hotelApi.detail(id));
const order = computed(() => data.value?.order);
const showCheckin = ref(false);
const showCancel = ref(false);
const busy = ref(false);
const failure = ref("");
const candidates = ref<Candidate[]>([]);
const candidateLoading = ref(false);
const roomIds = ref<string[]>([]);
const guests = reactive<
  Record<string, { key: string; name: string; phone: string }[]>
>({});
const reason = ref("");
const pending = ref<
  | { kind: "checkin"; key: string; body: CheckInInput }
  | { kind: "cancel"; key: string; body: { reason: string } }
>();
onMounted(load);
function newGuestKey() {
  return crypto.randomUUID();
}
function roomGuests(roomId: string) {
  return (guests[roomId] ??= [
    { key: crypto.randomUUID(), name: "", phone: "" },
  ]);
}
async function openCheckin() {
  showCheckin.value = true;
  failure.value = "";
  roomIds.value = [];
  candidateLoading.value = true;
  try {
    candidates.value = await hotelApi.candidates(id);
  } catch (e) {
    failure.value = messageOf(e);
    candidates.value = [];
  } finally {
    candidateLoading.value = false;
  }
}
function openCancel() {
  reason.value = "";
  failure.value = "";
  showCancel.value = true;
}
function prepareCheckin() {
  if (pending.value) {
    void execute();
    return;
  }
  if (roomIds.value.length !== order.value?.roomCount) {
    failure.value = `请一次选择 ${order.value?.roomCount} 间不同的房间`;
    return;
  }
  const rooms = roomIds.value.map((roomId) => ({
    roomId,
    guests: roomGuests(roomId).map((g) => ({
      name: g.name.trim(),
      phone: g.phone.trim(),
    })),
  }));
  if (rooms.some((r) => r.guests.some((g) => !g.name))) {
    failure.value = "请填写每间房的实际入住人姓名";
    return;
  }
  pending.value = {
    kind: "checkin",
    key: crypto.randomUUID(),
    body: { rooms },
  };
  void execute();
}
function prepareCancel() {
  pending.value ??= {
    kind: "cancel",
    key: crypto.randomUUID(),
    body: { reason: reason.value.trim() },
  };
  void execute();
}
async function execute() {
  if (!pending.value || busy.value) return;
  busy.value = true;
  failure.value = "";
  try {
    const action = pending.value;
    if (action.kind === "checkin")
      await hotelApi.checkIn(id, action.body, action.key);
    else await hotelApi.cancel(id, action.body, action.key);
    pending.value = undefined;
    showCheckin.value = false;
    showCancel.value = false;
    changed();
    ElMessage.success("办理成功");
    await load();
  } catch (e) {
    failure.value = messageOf(e);
    if (!resultUnknown(e)) {
      pending.value = undefined;
      await load();
    }
  } finally {
    busy.value = false;
  }
}
async function confirmResult() {
  if (busy.value || !pending.value) return;
  busy.value = true;
  try {
    const current = await hotelApi.detail(id);
    if (current.order.status !== "PENDING") {
      pending.value = undefined;
      showCheckin.value = false;
      showCancel.value = false;
      changed();
      await load();
      ElMessage.info(`当前订单状态：${statusText[current.order.status]}`);
    } else failure.value = "订单仍待入住，请使用原请求重试，避免重复操作。";
  } catch (e) {
    failure.value = messageOf(e);
  } finally {
    busy.value = false;
  }
}
onBeforeRouteLeave(() => {
  if (pending.value && auth.isAuthenticated) {
    ElMessage.warning("请先查询并确认当前操作结果");
    return false;
  }
  return true;
});
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">ORDER DETAILS</p>
      <h1>订单详情</h1>
      <RouterLink to="/orders">← 返回订单列表</RouterLink>
    </div>
    <el-button :loading="loading" @click="load">刷新订单</el-button>
  </div>
  <el-alert v-if="error" :title="error" type="error" :closable="false" />
  <template v-if="order">
    <section class="panel">
      <div class="panel-title">
        <h2>{{ order.orderNo }}</h2>
        <span :class="['status', order.status]">{{
          statusText[order.status]
        }}</span>
      </div>
      <div class="detail-grid">
        <div>
          <label>联系人</label>{{ order.bookerName }} · {{ order.bookerPhone }}
        </div>
        <div>
          <label>房型与间数</label>{{ order.roomTypeName }} ×
          {{ order.roomCount }} 间
        </div>
        <div><label>订单金额</label>¥{{ order.totalAmount }}</div>
        <div>
          <label>计划入住</label>{{ dateTime(order.plannedCheckinTime) }}
        </div>
        <div>
          <label>计划离店</label>{{ dateTime(order.plannedCheckoutTime) }}
        </div>
        <div>
          <label>成交单价 / 晚数</label>¥{{ order.nightlyPrice }} / 间 / 晚 ·
          {{ order.nights }} 晚
        </div>
        <div><label>备注</label>{{ order.remark || "—" }}</div>
      </div>
      <div v-if="order.status === 'PENDING'" class="actions">
        <el-button type="danger" plain @click="openCancel">取消预订</el-button><el-button type="primary" @click="openCheckin">
          分配房间 / 办理入住
        </el-button>
      </div>
    </section>
    <section v-if="order.status === 'CANCELLED'" class="panel">
      <h2>取消记录</h2>
      <p>
        {{ dateTime(order.cancelTime) }} ·
        {{ order.cancelReason || "未填写原因" }}
      </p>
      <p class="muted">预订占用已释放，不影响其他订单。</p>
    </section>
    <section v-if="data?.rooms.length" class="panel">
      <h2>入住登记</h2>
      <article v-for="room in data.rooms" :key="room.roomId" class="allocation">
        <strong>{{ room.roomNo }} 房</strong>
        <p class="muted">实际入住 {{ dateTime(room.checkinTime) }}</p>
        <p
          v-for="(guest, index) in room.guests"
          :key="`${room.roomId}-${index}`"
        >
          {{ guest.name }} {{ guest.phone || "" }}
        </p>
      </article>
    </section>
  </template>
  <el-dialog
    v-model="showCheckin"
    title="整单办理入住"
    width="650px"
    :close-on-click-modal="false"
    :close-on-press-escape="!pending"
    :show-close="!pending"
  >
    <p>
      请分配
      {{ order?.roomCount }}
      间房。候选房间覆盖订单全部住宿日期，提交时将再次校验。
    </p>
    <el-alert
      v-if="failure"
      :title="failure"
      :type="pending ? 'warning' : 'error'"
      :closable="false"
      show-icon
    /><el-skeleton v-if="candidateLoading" :rows="3" animated /><template
      v-else
    >
      <el-empty
        v-if="!candidates.length"
        description="暂无全程可入住的房间"
      /><el-checkbox-group
        v-model="roomIds"
        :max="order?.roomCount"
        :disabled="!!pending || busy"
      >
        <el-checkbox
          v-for="room in candidates"
          :key="room.roomId"
          :value="room.roomId"
          border
        >
          {{ room.roomNo }} 房
        </el-checkbox>
      </el-checkbox-group>
      <section v-for="roomId in roomIds" :key="roomId" class="allocation">
        <strong>{{ candidates.find((r) => r.roomId === roomId)?.roomNo }} 房 ·
          实际入住人</strong>
        <div
          v-for="guest in roomGuests(roomId)"
          :key="guest.key"
          class="guest-row"
        >
          <el-input
            v-model="guest.name"
            :disabled="!!pending"
            aria-label="入住人姓名"
            placeholder="姓名（必填）"
            maxlength="64"
          /><el-input
            v-model="guest.phone"
            :disabled="!!pending"
            aria-label="入住人电话"
            placeholder="电话（选填）"
            maxlength="32"
          /><el-button
            v-if="roomGuests(roomId).length > 1"
            :disabled="!!pending"
            @click="
              guests[roomId] = roomGuests(roomId).filter(
                (g) => g.key !== guest.key,
              )
            "
          >
            移除
          </el-button>
        </div>
        <el-button
          text
          :disabled="!!pending || roomGuests(roomId).length >= (order?.maxGuests ?? 1)"
          @click="
            roomGuests(roomId).push({
              key: newGuestKey(),
              name: '',
              phone: '',
            })
          "
        >
          + 添加入住人
        </el-button>
      </section>
    </template>
    <div class="actions">
      <el-button v-if="pending" :disabled="busy" @click="confirmResult">
        查询原结果
      </el-button><el-button v-else @click="showCheckin = false">返回</el-button><el-button
        type="primary"
        :disabled="candidateLoading || !candidates.length"
        :loading="busy"
        @click="prepareCheckin"
      >
        {{ pending ? "原请求重试" : "确认入住" }}
      </el-button>
    </div>
  </el-dialog>
  <el-dialog
    v-model="showCancel"
    title="取消预订"
    width="480px"
    :close-on-click-modal="false"
    :close-on-press-escape="!pending"
    :show-close="!pending"
  >
    <p>
      {{ order?.bookerName }} · {{ order?.roomTypeName }} ×
      {{ order?.roomCount }} 间
    </p>
    <p class="muted">确认后将取消整张订单，释放全部住宿晚的预订库存。</p>
    <el-alert
      v-if="failure"
      :title="failure"
      :type="pending ? 'warning' : 'error'"
      :closable="false"
    /><el-input
      v-model="reason"
      :disabled="!!pending"
      type="textarea"
      maxlength="500"
      show-word-limit
      aria-label="取消原因"
      placeholder="取消原因（选填）"
    />
    <div class="actions">
      <el-button v-if="pending" :disabled="busy" @click="confirmResult">
        查询原结果
      </el-button><el-button v-else @click="showCancel = false">保留预订</el-button><el-button type="danger" :loading="busy" @click="prepareCancel">
        {{ pending ? "原请求重试" : "确认取消" }}
      </el-button>
    </div>
  </el-dialog>
</template>
