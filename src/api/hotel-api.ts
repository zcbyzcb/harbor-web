import { get } from "./http";
import { post } from "./auth-api";
export interface HotelContext {
  hotelDate: string;
  serverTime: string;
  lastCheckoutDate: string;
  windowDays: number;
}
export interface RoomType {
  roomTypeId: string;
  typeName: string;
  typeCode: string;
  bedType: string;
  maxGuests: number;
  nightlyPrice: string;
  availableRooms: number;
  inventoryReady: boolean;
  totalAmount: string;
  bookable: boolean;
}
export interface OrderSummary {
  id: string;
  orderNo: string;
  bookerName: string;
  bookerPhone: string;
  status: "PENDING" | "CHECKED_IN" | "CANCELLED";
  roomCount: number;
  roomTypeName: string;
  plannedCheckinTime: string;
  plannedCheckoutTime: string;
  nights: number;
  nightlyPrice: string;
  totalAmount: string;
  remark?: string;
  cancelTime?: string;
  cancelReason?: string;
  maxGuests: number;
}
export interface Guest {
  name: string;
  phone: string;
  identityNo: string;
}
export interface RegisteredRoom {
  roomId: string;
  roomNo: string;
  checkinTime: string;
  guests: Guest[];
}
export interface OrderDetail {
  order: OrderSummary;
  rooms: RegisteredRoom[];
}
export interface Page<T> {
  items: T[];
  total: number;
  pageNo: number;
  pageSize: number;
}
export interface Candidate {
  roomId: string;
  roomNo: string;
  floorLabel?: string;
}
export interface Dashboard {
  checkedInRooms: number;
  pendingCheckInRooms: number;
  availableRooms: number;
  pendingOrders: {
    orderId: string;
    orderNo: string;
    bookerName: string;
    roomCount: number;
    roomTypeName: string;
    plannedCheckinTime: string;
  }[];
}
export interface BookingInput {
  roomTypeId: string;
  checkinDate: string;
  checkoutDate: string;
  roomCount: number;
  bookerName: string;
  bookerPhone: string;
  confirmedPrice: string;
  remark: string;
}
export interface CheckInInput {
  rooms: { roomId: string; guests: Guest[] }[];
}
export interface Mutation {
  orderId: string;
}
export const hotelApi = {
  context: () => get<HotelContext>("/hotel-context"),
  dashboard: () => get<Dashboard>("/dashboard"),
  availability: (
    checkinDate: string,
    checkoutDate: string,
    roomCount: number,
  ) =>
    get<RoomType[]>("/room-types/availability", {
      checkinDate,
      checkoutDate,
      roomCount,
    }),
  orders: (params: object) => get<Page<OrderSummary>>("/orders", params),
  detail: (id: string) => get<OrderDetail>(`/orders/${id}`),
  candidates: (id: string) => get<Candidate[]>(`/orders/${id}/available-rooms`),
  book: (body: BookingInput, key: string) =>
    post<Mutation>("/booking_orders", body, key),
  checkIn: (id: string, body: CheckInInput, key: string) =>
    post<Mutation>(`/booking_orders/${id}/check-in`, body, key),
  cancel: (id: string, body: { reason: string }, key: string) =>
    post<Mutation>(`/booking_orders/${id}/cancel`, body, key),
};
export const statusText = {
  PENDING: "待入住",
  CHECKED_IN: "已入住",
  CANCELLED: "已取消",
};
export function dateTime(value?: string) {
  return value ? value.slice(0, 16).replace("T", " ") : "—";
}
export function nextDate(date: string, days = 1) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function changed() {
  window.dispatchEvent(new Event("hotel:changed"));
}
