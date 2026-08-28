<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  hotelApi,
  nextDate,
  changed,
  type BookingInput,
  type RoomType,
  type HotelContext,
} from "@/api/hotel-api";
import { messageOf, resultUnknown } from "@/api/http";
import { useQuery } from "@/composables/use-query";
import { useAuthStore } from "@/stores/auth-store";
import standardTwinImage from "@/assets/room-standard-twin.svg";
import deluxeQueenImage from "@/assets/room-deluxe-queen.svg";
import familyImage from "@/assets/room-family.svg";
const router = useRouter();
const auth = useAuthStore();
const context = ref<HotelContext>();
const bootError = ref("");
const filters = reactive({ checkinDate: "", checkoutDate: "", roomCount: 1 });
const signature = computed(() => JSON.stringify(filters));
const results = useQuery(async () => {
  const snapshot = signature.value;
  const data = await hotelApi.availability(
    filters.checkinDate,
    filters.checkoutDate,
    filters.roomCount,
  );
  return { data, signature: snapshot };
});
const selected = ref<RoomType>();
const dialog = ref(false);
const form = reactive({ bookerName: "", bookerPhone: "", remark: "" });
const busy = ref(false);
const failure = ref("");
const pending = ref<{ key: string; body: BookingInput }>();
const roomImages: Record<string, string> = {
  STANDARD_TWIN: standardTwinImage,
  DELUXE_QUEEN: deluxeQueenImage,
  FAMILY: familyImage,
};
function roomImage(type: RoomType) {
  return roomImages[type.typeCode] ?? standardTwinImage;
}
async function initialize() {
  bootError.value = "";
  try {
    context.value = await hotelApi.context();
    filters.checkinDate = context.value.hotelDate;
    filters.checkoutDate = nextDate(context.value.hotelDate);
    await results.load();
  } catch (e) {
    bootError.value = messageOf(e);
  }
}
onMounted(initialize);
function choose(type: RoomType) {
  selected.value = type;
  dialog.value = true;
  failure.value = "";
  pending.value = undefined;
}
async function submit() {
  if (busy.value || !selected.value) return;
  if (!pending.value) {
    if (
      !form.bookerName.trim() ||
      form.bookerPhone.trim().length !== 11 ||
      !/^1[3-9]\d{9}$/.test(form.bookerPhone.trim())
    ) {
      failure.value = "请输入联系人姓名和有效的 11 位手机号";
      return;
    }
    pending.value = {
      key: crypto.randomUUID(),
      body: {
        ...filters,
        ...form,
        roomTypeId: selected.value.roomTypeId,
        confirmedPrice: selected.value.nightlyPrice,
      },
    };
  }
  busy.value = true;
  failure.value = "";
  try {
    const result = await hotelApi.book(pending.value.body, pending.value.key);
    pending.value = undefined;
    dialog.value = false;
    changed();
    ElMessage.success("预订成功");
    await router.push(`/orders/${result.orderId}`);
  } catch (e) {
    failure.value = messageOf(e);
    if (!resultUnknown(e)) pending.value = undefined;
  } finally {
    busy.value = false;
  }
}
async function confirmResult() {
  if (!pending.value || busy.value) return;
  busy.value = true;
  try {
    const page = await hotelApi.orders({ requestId: pending.value.key });
    if (page.items.length) {
      const id = page.items[0]!.id;
      pending.value = undefined;
      dialog.value = false;
      changed();
      await router.push(`/orders/${id}`);
    } else
      failure.value =
        "暂未查到结果；请求可能仍在处理中，请保留原参数并点击原请求重试。";
  } catch (e) {
    failure.value = messageOf(e);
  } finally {
    busy.value = false;
  }
}
onBeforeRouteLeave(() => {
  if (pending.value && auth.isAuthenticated) {
    ElMessage.warning("请先确认当前预订结果");
    return false;
  }
  return true;
});
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">RESERVATIONS</p>
      <h1>房型与预订</h1>
      <p class="muted">先选择住宿日期与间数，入住时再分配具体房号。</p>
    </div>
  </div>
  <el-alert
    v-if="bootError"
    :title="bootError"
    type="error"
    :closable="false"
  /><el-button v-if="bootError" @click="initialize">重新加载</el-button>
  <section v-if="context" class="panel">
    <div class="filters">
      <label>入住日期<input
        v-model="filters.checkinDate"
        type="date"
        :min="context.hotelDate"
        :max="nextDate(context.lastCheckoutDate, -1)"
      /></label><label>离店日期<input
        v-model="filters.checkoutDate"
        type="date"
        :min="nextDate(filters.checkinDate)"
        :max="context.lastCheckoutDate"
      /></label><label>预订间数<el-input-number
        v-model="filters.roomCount"
        :min="1"
        :max="100"
      /></label><el-button
        type="primary"
        :loading="results.loading.value"
        @click="results.load"
      >
        查询房型
      </el-button>
    </div>
    <p class="footnote">
      入住、离店均按酒店当地时间12:00计算；最晚可在
      {{ context.lastCheckoutDate }} 12:00 离店。
    </p>
  </section>
  <el-alert
    v-if="results.error.value"
    :title="results.error.value"
    type="error"
    :closable="false"
  />
  <div v-if="results.data.value?.signature === signature" class="room-grid">
    <article
      v-for="type in results.data.value.data"
      :key="type.roomTypeId"
      class="room-card"
    >
      <div class="room-cover">
        <img :src="roomImage(type)" :alt="`${type.typeName}默认图片`" />
      </div>
      <div class="room-body">
        <h2>{{ type.typeName }}</h2>
        <p class="muted">
          {{ type.bedType }} · 每间最多 {{ type.maxGuests }} 人
        </p>
        <p class="price">¥{{ type.nightlyPrice }} <small>/ 间 / 晚</small></p>
        <p class="muted">所选行程合计 ¥{{ type.totalAmount }}</p>
        <el-tag
          :type="
            type.inventoryReady
              ? type.bookable
                ? 'success'
                : 'warning'
              : 'info'
          "
        >
          {{
            !type.inventoryReady
              ? "库存待同步"
              : `全程可售 ${type.availableRooms} 间`
          }}
        </el-tag><el-button
          type="primary"
          :disabled="!type.bookable || results.loading.value"
          @click="choose(type)"
        >
          预订此房型
        </el-button>
      </div>
    </article>
  </div>
  <el-empty
    v-else-if="context && !results.loading.value"
    description="日期或间数已变化，请重新查询房型"
  />
  <el-dialog
    v-model="dialog"
    title="确认预订"
    width="540px"
    :close-on-click-modal="false"
    :close-on-press-escape="!pending"
    :show-close="!pending"
  >
    <template v-if="selected">
      <p>
        {{ selected.typeName }} · {{ filters.roomCount }} 间 ·
        {{ filters.checkinDate }} 至 {{ filters.checkoutDate }}
      </p>
      <p>
        订单总价 <strong>¥{{ selected.totalAmount }}</strong>
      </p>
      <el-alert
        v-if="failure"
        :title="failure"
        :type="pending ? 'warning' : 'error'"
        :closable="false"
        show-icon
      /><el-form label-position="top" :disabled="!!pending || busy">
        <el-form-item label="联系人姓名（必填）">
          <el-input v-model="form.bookerName" maxlength="64" />
        </el-form-item><el-form-item label="手机号（必填）">
          <el-input v-model="form.bookerPhone" maxlength="11" />
        </el-form-item><el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <div class="actions">
        <el-button v-if="pending" :disabled="busy" @click="confirmResult">
          查询原结果
        </el-button><el-button v-else @click="dialog = false">返回</el-button><el-button type="primary" :loading="busy" @click="submit">
          {{ pending ? "原请求重试" : "确认预订" }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>
